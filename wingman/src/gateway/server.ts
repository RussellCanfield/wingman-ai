import type { Server, ServerWebSocket } from "bun";
import type {
	GatewayConfig,
	GatewayMessage,
	GatewayStats,
	HealthResponse,
	RegisterPayload,
	JoinGroupPayload,
	BroadcastPayload,
	DirectPayload,
	ErrorPayload,
	AgentRequestPayload,
	GatewayAuthConfig,
} from "./types.js";
import { NodeManager } from "./node.js";
import { BroadcastGroupManager } from "./broadcast.js";
import { GatewayAuth } from "./auth.js";
import {
	validateGatewayMessage,
} from "./validation.js";
import {
	MDNSDiscoveryService,
	TailscaleDiscoveryService,
} from "./discovery/index.js";
import type { DiscoveryService } from "./discovery/types.js";
import { createLogger, type Logger, type LogLevel } from "@/logger.js";
import { WingmanConfigLoader } from "@/cli/config/loader.js";
import type { WingmanConfigType } from "@/cli/config/schema.js";
import { GatewayRouter } from "./router.js";
import { OutputManager } from "@/cli/core/outputManager.js";
import { AgentInvoker } from "@/cli/core/agentInvoker.js";
import { SessionManager } from "@/cli/core/sessionManager.js";
import { AgentLoader } from "@/agent/config/agentLoader.js";
import { getAvailableTools } from "@/agent/config/toolRegistry.js";
import {
	deleteProviderCredentials,
	getCredentialsPath,
	readCredentialsFile,
	resolveProviderToken,
	saveProviderToken,
} from "@/providers/credentials.js";
import { getProviderSpec, listProviderSpecs } from "@/providers/registry.js";
import { homedir } from "node:os";
import { join, isAbsolute, normalize, dirname, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { mkdirSync, existsSync, statSync, readdirSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";

type GatewaySocketData = {
	nodeId: string;
	clientId?: string;
	clientType?: string;
	authenticated?: boolean;
	tailscaleUser?: string;
};

type GatewaySocket = ServerWebSocket<GatewaySocketData>;

/**
 * Wingman Gateway Server
 * Manages WebSocket connections for AI agent swarming
 */
export class GatewayServer {
	private config: GatewayConfig;
	private nodeManager: NodeManager;
	private groupManager: BroadcastGroupManager;
	private auth: GatewayAuth;
	private server: Server<{
		nodeId: string;
		clientId?: string;
		clientType?: string;
		authenticated?: boolean;
		tailscaleUser?: string;
	}> | null = null;
	private startedAt: number = 0;
	private messagesProcessed: number = 0;
	private pingInterval: Timer | null = null;
	private discoveryService: DiscoveryService | null = null;
	private logger: Logger;
	private wingmanConfig: WingmanConfigType;
	private router: GatewayRouter;
	private sessionManagers: Map<string, SessionManager> = new Map();
	private workspace: string;
	private configDir: string;
	private uiServer: Server<Record<string, never>> | null = null;
	private controlUiEnabled: boolean = false;
	private controlUiPort: number = 18790;
	private controlUiSamePort: boolean = false;
	private uiDistDir: string | null = null;

	// HTTP bridge support
	private bridgeQueues: Map<string, GatewayMessage[]> = new Map();
	private bridgePollWaiters: Map<string, (messages: GatewayMessage[]) => void> = new Map();

	constructor(config: Partial<GatewayConfig> = {}) {
		this.workspace = config.workspace || process.cwd();
		this.configDir = config.configDir || ".wingman";

		const configLoader = new WingmanConfigLoader(
			this.configDir,
			this.workspace,
		);
		this.wingmanConfig = configLoader.loadConfig();
		this.router = new GatewayRouter(this.wingmanConfig);

		const gatewayDefaults = this.wingmanConfig.gateway;
		const authConfig: GatewayAuthConfig | undefined = config.auth
			? config.auth
			: config.requireAuth || config.authToken
				? { mode: "token", token: config.authToken }
				: gatewayDefaults.auth;

		this.config = {
			port: config.port || gatewayDefaults.port || 18789,
			host: config.host || gatewayDefaults.host || "127.0.0.1",
			authToken: config.authToken,
			requireAuth: config.requireAuth ?? false,
			auth: authConfig,
			stateDir: config.stateDir || gatewayDefaults.stateDir,
			workspace: this.workspace,
			configDir: this.configDir,
			maxNodes: config.maxNodes || 1000,
			pingInterval: config.pingInterval || 30000, // 30 seconds
			pingTimeout: config.pingTimeout || 60000, // 60 seconds
			logLevel: config.logLevel || "info",
			discovery: config.discovery,
		};

		this.nodeManager = new NodeManager(this.config.maxNodes);
		this.groupManager = new BroadcastGroupManager();
		this.logger = createLogger(this.config.logLevel);

		const initialTokens = this.config.authToken
			? [this.config.authToken]
			: [];
		this.auth = new GatewayAuth(this.config.auth || { mode: "none" }, initialTokens);

		const controlUi = this.wingmanConfig.gateway?.controlUi;
		this.controlUiEnabled = controlUi?.enabled ?? false;
		this.controlUiPort = controlUi?.port || 18790;
		this.controlUiSamePort =
			this.controlUiEnabled && this.controlUiPort === this.config.port;
		this.uiDistDir = this.controlUiEnabled ? this.resolveControlUiDir() : null;
	}

	/**
	 * Start the gateway server
	 */
	async start(): Promise<void> {
		if (typeof (globalThis as any).Bun === "undefined") {
			throw new Error(
				"Gateway server requires Bun runtime. Start with `bun ./bin/wingman gateway start`.",
			);
		}
		this.startedAt = Date.now();

		this.server = Bun.serve({
			port: this.config.port,
			hostname: this.config.host,

			fetch: (req, server) => {
				const url = new URL(req.url);

				// Health check endpoint
				if (url.pathname === "/health") {
					return this.handleHealthCheck();
				}

				// Stats endpoint
				if (url.pathname === "/stats") {
					return this.handleStats();
				}

				// HTTP bridge - send message
				if (url.pathname === "/bridge/send") {
					return this.handleBridgeSend(req);
				}

				// HTTP bridge - long poll for messages
				if (url.pathname === "/bridge/poll") {
					return this.handleBridgePoll(req);
				}

				// WebSocket upgrade
				if (url.pathname === "/ws") {
					const tailscaleUser =
						req.headers.get("tailscale-user-login") ||
						req.headers.get("ts-user-login") ||
						undefined;
					const upgraded = server.upgrade(req, {
						data: { nodeId: "", tailscaleUser },
					});

					if (!upgraded) {
						return new Response("WebSocket upgrade failed", {
							status: 400,
						});
					}

					return undefined;
				}

				if (this.controlUiSamePort) {
					return this.handleUiRequest(req);
				}

				return new Response("Not Found", { status: 404 });
			},

			websocket: {
				open: (ws) => this.handleOpen(ws),
				message: (ws, message) => this.handleMessage(ws, message),
				close: (ws) => this.handleClose(ws),
				drain: (ws) => this.handleDrain(ws),
			},
		});

		// Start ping interval
		this.startPingInterval();

		if (this.controlUiEnabled && !this.controlUiSamePort) {
			if (!this.uiDistDir) {
				this.log(
					"warn",
					"Control UI is enabled but build assets were not found. Run `bun run webui:build`.",
				);
			}
			this.uiServer = Bun.serve({
				port: this.controlUiPort,
				hostname: this.config.host,
				fetch: (req) => this.handleUiRequest(req),
			});
			this.log(
				"info",
				`Control UI started on ${this.config.host}:${this.controlUiPort}`,
			);
		} else if (this.controlUiEnabled) {
			if (!this.uiDistDir) {
				this.log(
					"warn",
					"Control UI is enabled but build assets were not found. Run `bun run webui:build`.",
				);
			}
			this.log(
				"info",
				`Control UI available on ${this.config.host}:${this.config.port}`,
			);
		}

		// Start discovery if enabled
		if (this.config.discovery?.enabled) {
			await this.startDiscovery();
		}

		this.log(
			"info",
			`Gateway started on ${this.config.host}:${this.config.port}`,
		);
	}

	/**
	 * Stop the gateway server
	 */
	async stop(): Promise<void> {
		// Stop discovery
		if (this.discoveryService) {
			await this.discoveryService.stopAnnouncing();
			this.discoveryService = null;
		}

		if (this.pingInterval) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}

		if (this.server) {
			this.server.stop();
			this.server = null;
		}

		if (this.uiServer) {
			this.uiServer.stop();
			this.uiServer = null;
		}

		this.log("info", "Gateway stopped");
	}

	/**
	 * Start discovery service
	 */
	private async startDiscovery(): Promise<void> {
		const discovery = this.config.discovery;
		if (!discovery) return;

		const discoveryConfig = {
			name: discovery.name,
			port: this.config.port,
			requireAuth: this.auth.isAuthRequired(),
			capabilities: ["broadcast", "direct", "groups"],
			version: "1.0.0",
			transport: this.config.host === "0.0.0.0" ? ("ws" as const) : ("wss" as const),
		};

		if (discovery.method === "mdns") {
			this.discoveryService = new MDNSDiscoveryService();
			await this.discoveryService.announce(discoveryConfig);
			this.log("info", `mDNS discovery started: ${discovery.name}`);
		} else if (discovery.method === "tailscale") {
			this.discoveryService = new TailscaleDiscoveryService();
			await this.discoveryService.announce(discoveryConfig);
			this.log("info", `Tailscale discovery started: ${discovery.name}`);
		}
	}

	/**
	 * Handle WebSocket connection open
	 */
	private handleOpen(ws: GatewaySocket): void {
		this.log("debug", "New WebSocket connection");
	}

	/**
	 * Handle WebSocket message
	 */
	private handleMessage(
		ws: GatewaySocket,
		message: string | Buffer,
	): void {
		try {
			// Parse and validate message
			const parsed = JSON.parse(message.toString());
			const validation = validateGatewayMessage(parsed);

			if (!validation.success) {
				this.log("warn", "Invalid message format", validation.error);
				this.sendError(ws, "INVALID_MESSAGE", validation.error);
				return;
			}

			const msg = validation.data;
			const nodeId = ws.data.nodeId;

			if (msg.type === "connect") {
				this.handleConnect(ws, msg);
				return;
			}

			if (msg.type === "req:agent") {
				void this.handleAgentRequest(ws, msg);
				return;
			}

			// Check rate limit (skip for register and ping/pong)
			if (
				nodeId &&
				msg.type !== "register" &&
				msg.type !== "ping" &&
				msg.type !== "pong"
			) {
				if (this.nodeManager.isRateLimited(nodeId)) {
					this.sendError(
						ws,
						"RATE_LIMITED",
						"Too many messages. Please slow down.",
					);
					return;
				}
				this.nodeManager.recordMessage(nodeId);
			}

			this.messagesProcessed++;
			this.log("debug", `Received message: ${msg.type}`, msg);

			switch (msg.type) {
				case "register":
					this.handleRegister(ws, msg);
					break;
				case "unregister":
					this.handleUnregister(ws, msg);
					break;
				case "join_group":
					this.handleJoinGroup(ws, msg);
					break;
				case "leave_group":
					this.handleLeaveGroup(ws, msg);
					break;
				case "broadcast":
					this.handleBroadcast(ws, msg);
					break;
				case "direct":
					this.handleDirect(ws, msg);
					break;
				case "ping":
					this.handlePing(ws, msg);
					break;
				case "pong":
					this.handlePong(ws, msg);
					break;
				default:
					this.sendError(ws, "UNKNOWN_MESSAGE_TYPE", "Unknown message type");
			}
		} catch (error) {
			this.log("error", "Failed to process message", error);
			this.sendError(ws, "INVALID_MESSAGE", "Invalid message format");
		}
	}

	/**
	 * Handle WebSocket connection close
	 */
	private handleClose(ws: GatewaySocket): void {
		const nodeId = ws.data.nodeId;
		if (nodeId) {
			this.groupManager.removeNodeFromAllGroups(nodeId);
			this.nodeManager.unregisterNode(nodeId);
			this.log("info", `Node disconnected: ${nodeId}`);
		}
	}

	/**
	 * Handle WebSocket drain (backpressure)
	 */
	private handleDrain(ws: GatewaySocket): void {
		this.log("debug", "WebSocket drained");
	}

	/**
	 * Handle client connect handshake
	 */
	private handleConnect(
		ws: GatewaySocket,
		msg: GatewayMessage,
	): void {
		if (!msg.id) {
			this.sendError(ws, "INVALID_CONNECT", "Missing connect request id");
			return;
		}

		if (!msg.client) {
			this.sendMessage(ws, {
				type: "res",
				id: msg.id,
				ok: false,
				payload: "missing client info",
				timestamp: Date.now(),
			});
			return;
		}

		const allowed = this.auth.validate(msg.auth, ws.data.tailscaleUser);
		if (!allowed) {
			this.sendMessage(ws, {
				type: "res",
				id: msg.id,
				ok: false,
				payload: "authentication failed",
				timestamp: Date.now(),
			});
			ws.close();
			return;
		}

		ws.data.clientId = msg.client.instanceId;
		ws.data.clientType = msg.client.clientType;
		ws.data.authenticated = true;

		this.sendMessage(ws, {
			type: "res",
			id: msg.id,
			ok: true,
			payload: "gateway-ready",
			timestamp: Date.now(),
		});
	}

	/**
	 * Handle agent execution request
	 */
	private async handleAgentRequest(
		ws: GatewaySocket,
		msg: GatewayMessage,
	): Promise<void> {
		if (!msg.id) {
			this.sendError(ws, "INVALID_REQUEST", "Missing request id");
			return;
		}

		if (!ws.data.authenticated) {
			this.sendAgentError(ws, msg.id, "Client is not authenticated");
			return;
		}

		const payload = msg.payload as AgentRequestPayload;
		if (!payload?.content) {
			this.sendAgentError(ws, msg.id, "Missing agent content");
			return;
		}

		const agentId = this.router.selectAgent(payload.agentId, payload.routing);
		if (!agentId) {
			this.sendAgentError(ws, msg.id, "No agent matched the request");
			return;
		}

		const sessionKey =
			payload.sessionKey || this.router.buildSessionKey(agentId, payload.routing);

		const sessionManager = await this.getSessionManager(agentId);
		const session = sessionManager.getOrCreateSession(sessionKey, agentId);
		const workdir = session.metadata?.workdir ?? null;
		const defaultOutputDir = this.resolveDefaultOutputDir(agentId);
		sessionManager.updateSession(session.id, {
			lastMessagePreview: payload.content.substring(0, 200),
		});

		const outputManager = new OutputManager("interactive");
		const outputHandler = (event: unknown) => {
			this.sendMessage(ws, {
				type: "event:agent",
				id: msg.id,
				clientId: ws.data.clientId,
				payload: event,
				timestamp: Date.now(),
			});
		};

		outputManager.on("output-event", outputHandler);

		const workspace = this.resolveAgentWorkspace(agentId);
		const invoker = new AgentInvoker({
			workspace,
			configDir: this.configDir,
			outputManager,
			logger: this.logger,
			sessionManager,
			workdir,
			defaultOutputDir,
		});

		try {
			await invoker.invokeAgent(agentId, payload.content, sessionKey);

			const updated = sessionManager.getSession(sessionKey);
			if (updated) {
				sessionManager.updateSession(sessionKey, {
					messageCount: updated.messageCount + 1,
				});
			}
		} catch (error) {
			this.logger.error("Agent invocation failed", error);
		} finally {
			outputManager.off("output-event", outputHandler);
		}
	}

	/**
	 * Handle node registration
	 */
	private handleRegister(
		ws: GatewaySocket,
		msg: GatewayMessage,
	): void {
		const payload = msg.payload as RegisterPayload;

		// Validate authentication
		if (!this.auth.validate({ token: payload.token }, ws.data.tailscaleUser)) {
			this.sendError(ws, "AUTH_FAILED", "Authentication failed");
			ws.close();
			return;
		}

		// Register the node with session context
		const node = this.nodeManager.registerNode(
			ws,
			payload.name,
			payload.capabilities,
			payload.sessionId,
			payload.agentName,
		);

		if (!node) {
			this.sendError(ws, "MAX_NODES_REACHED", "Maximum nodes reached");
			ws.close();
			return;
		}

		// Send acknowledgment
		this.sendMessage(ws, {
			type: "ack",
			nodeId: node.id,
			payload: {
				nodeId: node.id,
				name: node.name,
				sessionId: node.sessionId,
				agentName: node.agentName,
			},
			timestamp: Date.now(),
		});

		const sessionInfo = node.sessionId ? ` (session: ${node.sessionId})` : "";
		this.log("info", `Node registered: ${node.id} (${node.name})${sessionInfo}`);
	}

	/**
	 * Handle node unregistration
	 */
	private handleUnregister(
		ws: GatewaySocket,
		msg: GatewayMessage,
	): void {
		const nodeId = ws.data.nodeId;
		if (nodeId) {
			this.groupManager.removeNodeFromAllGroups(nodeId);
			this.nodeManager.unregisterNode(nodeId);
			this.log("info", `Node unregistered: ${nodeId}`);
		}
	}

	/**
	 * Handle join group request
	 */
	private handleJoinGroup(
		ws: GatewaySocket,
		msg: GatewayMessage,
	): void {
		const nodeId = ws.data.nodeId;
		if (!nodeId) {
			this.sendError(ws, "NOT_REGISTERED", "Node not registered");
			return;
		}

		const payload = msg.payload as JoinGroupPayload;
		let group;

		if (payload.groupId) {
			group = this.groupManager.getGroup(payload.groupId);
		} else if (payload.groupName) {
			if (payload.createIfNotExists) {
				group = this.groupManager.getOrCreateGroup(
					payload.groupName,
					nodeId,
					payload.description,
				);
			} else {
				group = this.groupManager.getGroupByName(payload.groupName);
			}
		}

		if (!group) {
			this.sendError(ws, "GROUP_NOT_FOUND", "Group not found");
			return;
		}

		// Add node to group
		this.groupManager.addNodeToGroup(group.id, nodeId);
		this.nodeManager.addNodeToGroup(nodeId, group.id);

		// Send acknowledgment
		this.sendMessage(ws, {
			type: "ack",
			nodeId,
			groupId: group.id,
			payload: {
				groupId: group.id,
				groupName: group.name,
			},
			timestamp: Date.now(),
		});

		this.log("info", `Node ${nodeId} joined group ${group.name}`);
	}

	/**
	 * Handle leave group request
	 */
	private handleLeaveGroup(
		ws: GatewaySocket,
		msg: GatewayMessage,
	): void {
		const nodeId = ws.data.nodeId;
		if (!nodeId || !msg.groupId) {
			this.sendError(ws, "INVALID_REQUEST", "Invalid leave group request");
			return;
		}

		this.groupManager.removeNodeFromGroup(msg.groupId, nodeId);
		this.nodeManager.removeNodeFromGroup(nodeId, msg.groupId);

		// Send acknowledgment
		this.sendMessage(ws, {
			type: "ack",
			nodeId,
			groupId: msg.groupId,
			timestamp: Date.now(),
		});

		this.log("info", `Node ${nodeId} left group ${msg.groupId}`);
	}

	/**
	 * Handle broadcast message
	 */
	private handleBroadcast(
		ws: GatewaySocket,
		msg: GatewayMessage,
	): void {
		const nodeId = ws.data.nodeId;
		if (!nodeId) {
			this.sendError(ws, "NOT_REGISTERED", "Node not registered");
			return;
		}

		const payload = msg.payload as BroadcastPayload;
		const members = this.groupManager.getGroupMembers(payload.groupId);

		// Don't send back to the sender
		const recipients = members.filter((id) => id !== nodeId);

		// Broadcast to all group members
		const broadcastMsg: GatewayMessage = {
			type: "broadcast",
			nodeId,
			groupId: payload.groupId,
			payload: payload.message,
			timestamp: Date.now(),
		};

		const sent = this.nodeManager.broadcastToNodes(recipients, broadcastMsg);
		this.log(
			"debug",
			`Broadcast to ${sent}/${recipients.length} nodes in group ${payload.groupId}`,
		);
	}

	/**
	 * Handle direct message
	 */
	private handleDirect(
		ws: GatewaySocket,
		msg: GatewayMessage,
	): void {
		const nodeId = ws.data.nodeId;
		if (!nodeId) {
			this.sendError(ws, "NOT_REGISTERED", "Node not registered");
			return;
		}

		const payload = msg.payload as DirectPayload;
		const directMsg: GatewayMessage = {
			type: "direct",
			nodeId,
			targetNodeId: payload.targetNodeId,
			payload: payload.message,
			timestamp: Date.now(),
		};

		const sent = this.nodeManager.sendToNode(payload.targetNodeId, directMsg);
		if (!sent) {
			this.sendError(ws, "NODE_NOT_FOUND", "Target node not found");
		}
	}

	/**
	 * Handle ping message
	 */
	private handlePing(
		ws: GatewaySocket,
		msg: GatewayMessage,
	): void {
		const nodeId = ws.data.nodeId;
		if (nodeId) {
			this.nodeManager.updatePing(nodeId);
		}

		// Send pong response
		this.sendMessage(ws, {
			type: "pong",
			timestamp: Date.now(),
		});
	}

	/**
	 * Handle pong message
	 */
	private handlePong(
		ws: GatewaySocket,
		msg: GatewayMessage,
	): void {
		const nodeId = ws.data.nodeId;
		if (nodeId) {
			this.nodeManager.updatePing(nodeId);
		}
	}

	/**
	 * Send a message to a WebSocket
	 */
	private sendMessage(
		ws: GatewaySocket,
		message: GatewayMessage,
	): void {
		try {
			ws.send(JSON.stringify(message));
		} catch (error) {
			this.log("error", "Failed to send message", error);
		}
	}

	/**
	 * Send an error message
	 */
	private sendError(
		ws: GatewaySocket,
		code: string,
		message: string,
	): void {
		const errorPayload: ErrorPayload = {
			code,
			message,
		};

		this.sendMessage(ws, {
			type: "error",
			payload: errorPayload,
			timestamp: Date.now(),
		});
	}

	private sendAgentError(
		ws: GatewaySocket,
		requestId: string,
		message: string,
	): void {
		this.sendMessage(ws, {
			type: "event:agent",
			id: requestId,
			payload: {
				type: "agent-error",
				error: message,
				timestamp: new Date().toISOString(),
			},
			timestamp: Date.now(),
		});
	}

	private resolveStateDir(): string {
		const configured =
			this.config.stateDir || this.wingmanConfig.gateway?.stateDir;
		const fallback = join(homedir(), ".wingman");
		const raw = configured || fallback;

		if (raw.startsWith("~/")) {
			return join(homedir(), raw.slice(2));
		}

		if (isAbsolute(raw)) {
			return raw;
		}

		return join(this.workspace, raw);
	}

	private resolveAgentWorkspace(agentId: string): string {
		const agents = this.wingmanConfig.agents?.list || [];
		const match = agents.find((agent) => agent.id === agentId);
		return match?.workspace || this.workspace;
	}

	private resolveConfigDirPath(): string {
		return isAbsolute(this.configDir)
			? this.configDir
			: join(this.workspace, this.configDir);
	}

	private persistWingmanConfig(): void {
		const configDir = this.resolveConfigDirPath();
		mkdirSync(configDir, { recursive: true });
		const configPath = join(configDir, "wingman.config.json");
		writeFileSync(configPath, JSON.stringify(this.wingmanConfig, null, 2));
	}

	private buildAgentMarkdown(params: {
		id: string;
		description?: string;
		tools: string[];
		model?: string;
		prompt?: string;
	}): string {
		const { id, description, tools, model, prompt } = params;
		const safe = (value: string) => `"${value.replace(/"/g, '\\"')}"`;
		const lines = [
			"---",
			`name: ${safe(id)}`,
			description
				? `description: ${safe(description)}`
				: `description: ${safe("New Wingman agent")}`,
			tools.length > 0
				? `tools:\n${tools.map((tool) => `  - ${tool}`).join("\n")}`
				: "tools: []",
		];
		if (model) {
			lines.push(`model: ${safe(model)}`);
		}
		lines.push("---", "", prompt || "You are a Wingman agent.");
		return lines.join("\n");
	}

	private parseAgentMarkdown(content: string): {
		metadata: Record<string, any>;
		prompt: string;
	} {
		const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
		const match = content.match(frontmatterRegex);
		if (!match) {
			throw new Error("Invalid agent.md format: missing frontmatter");
		}
		const [, rawFrontmatter, prompt] = match;
		const metadata = (yaml.load(rawFrontmatter) as Record<string, any>) || {};
		return { metadata, prompt: prompt?.trim() || "" };
	}

	private serializeAgentMarkdown(
		metadata: Record<string, any>,
		prompt: string,
	): string {
		const frontmatter = yaml.dump(metadata, { lineWidth: 120 });
		const safePrompt = prompt?.trim() || "You are a Wingman agent.";
		return `---\n${frontmatter}---\n\n${safePrompt}\n`;
	}

	private getBuiltInTools(): string[] {
		return ["ls", "read_file", "write_file", "edit_file", "glob", "grep"];
	}

	private resolveOutputRoot(): string {
		const root = join(this.resolveStateDir(), "outputs");
		mkdirSync(root, { recursive: true });
		return root;
	}

	private resolveDefaultOutputDir(agentId: string): string {
		const root = this.resolveOutputRoot();
		const dir = join(root, agentId);
		mkdirSync(dir, { recursive: true });
		return dir;
	}

	private resolveFsRoots(): string[] {
		const configured = this.wingmanConfig.gateway?.fsRoots || [];
		const candidates =
			configured.length > 0 ? configured : [this.resolveOutputRoot()];

		const resolved = candidates
			.map((entry) => this.resolveFsPath(entry))
			.filter((entry) => {
				try {
					return existsSync(entry) && statSync(entry).isDirectory();
				} catch {
					return false;
				}
			});

		return Array.from(new Set(resolved));
	}

	private resolveFsPath(raw: string): string {
		if (raw === "~") {
			return normalize(homedir());
		}
		if (raw.startsWith("~/")) {
			return normalize(join(homedir(), raw.slice(2)));
		}
		if (isAbsolute(raw)) {
			return normalize(raw);
		}
		return normalize(join(this.workspace, raw));
	}

	private isPathWithinRoots(pathname: string, roots: string[]): boolean {
		const normalized = normalize(pathname);
		return roots.some((root) => {
			const normalizedRoot = normalize(root);
			return (
				normalized === normalizedRoot ||
				normalized.startsWith(normalizedRoot + sep)
			);
		});
	}

	private resolveControlUiDir(): string | null {
		const moduleDir = dirname(fileURLToPath(import.meta.url));
		const candidates = [
			join(this.workspace, "dist", "webui"),
			join(moduleDir, "..", "webui"),
			join(moduleDir, "..", "..", "dist", "webui"),
		];

		for (const candidate of candidates) {
			try {
				if (
					existsSync(candidate) &&
					statSync(candidate).isDirectory() &&
					existsSync(join(candidate, "index.html"))
				) {
					return candidate;
				}
			} catch {
				continue;
			}
		}

		return null;
	}

	private async getSessionManager(agentId: string): Promise<SessionManager> {
		const existing = this.sessionManagers.get(agentId);
		if (existing) {
			return existing;
		}

		const stateDir = this.resolveStateDir();
		const sessionsDir = join(stateDir, "agents", agentId, "sessions");
		mkdirSync(sessionsDir, { recursive: true });

		const dbPath = join(sessionsDir, "wingman.db");
		const manager = new SessionManager(dbPath);
		await manager.initialize();
		this.sessionManagers.set(agentId, manager);
		return manager;
	}

	/**
	 * Handle health check request
	 */
	private handleHealthCheck(): Response {
		const stats = this.getStats();
		const health: HealthResponse = {
			status: "healthy",
			version: "1.0.0",
			stats,
			timestamp: Date.now(),
		};

		return new Response(JSON.stringify(health, null, 2), {
			headers: { "Content-Type": "application/json" },
		});
	}

	/**
	 * Handle stats request
	 */
	private handleStats(): Response {
		const stats = {
			gateway: this.getStats(),
			nodes: this.nodeManager.getStats(),
			groups: this.groupManager.getStats(),
		};

		return new Response(JSON.stringify(stats, null, 2), {
			headers: { "Content-Type": "application/json" },
		});
	}

	/**
	 * Get gateway statistics
	 */
	private getStats(): GatewayStats {
		const nodeStats = this.nodeManager.getStats();
		return {
			uptime: Date.now() - this.startedAt,
			totalNodes: nodeStats.totalNodes,
			totalGroups: this.groupManager.getStats().totalGroups,
			messagesProcessed: this.messagesProcessed,
			startedAt: this.startedAt,
			activeSessions: nodeStats.activeSessions,
			sessionNodes: nodeStats.sessionNodes,
		};
	}

	/**
	 * Start ping interval to check for stale connections
	 */
	private startPingInterval(): void {
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
		}

		this.pingInterval = setInterval(() => {
			// Send ping to all nodes
			const nodes = this.nodeManager.getAllNodes();
			for (const node of nodes) {
				this.sendMessage(node.ws, {
					type: "ping",
					timestamp: Date.now(),
				});
			}

			// Remove stale nodes
			const removed = this.nodeManager.removeStaleNodes(
				this.config.pingTimeout!,
			);
			if (removed > 0) {
				this.log("info", `Removed ${removed} stale nodes`);
			}
		}, this.config.pingInterval);
	}

	/**
	 * Log a message
	 */
	private log(level: LogLevel, message: string, data?: unknown): void {
		if (level === "silent") {
			return;
		}

		const args = data === undefined ? [] : [data];

		switch (level) {
			case "debug":
				this.logger.debug(message, ...args);
				break;
			case "info":
				this.logger.info(message, ...args);
				break;
			case "warn":
				this.logger.warn(message, ...args);
				break;
			case "error":
				this.logger.error(message, ...args);
				break;
		}
	}

	private isUiPath(pathname: string): boolean {
		if (
			pathname === "/health" ||
			pathname === "/stats" ||
			pathname.startsWith("/ws") ||
			pathname.startsWith("/bridge")
		) {
			return false;
		}

		return true;
	}

	private async handleUiRequest(req: Request): Promise<Response> {

		const url = new URL(req.url);

		if (url.pathname.startsWith("/api/")) {
			if (url.pathname === "/api/config") {
				const agents =
					this.wingmanConfig.agents?.list?.map((agent) => ({
						id: agent.id,
						name: agent.name,
						default: agent.default,
					})) || [];

				const defaultAgentId = this.router.selectAgent();

				return new Response(
					JSON.stringify(
						{
							gatewayHost: this.config.host,
							gatewayPort: this.config.port,
							requireAuth: this.auth.isAuthRequired(),
							defaultAgentId,
							outputRoot: this.resolveOutputRoot(),
							agents,
						},
						null,
						2,
					),
					{
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			if (url.pathname === "/api/health") {
				return this.handleHealthCheck();
			}

			if (url.pathname === "/api/stats") {
				return this.handleStats();
			}

			if (url.pathname === "/api/fs/roots" && req.method === "GET") {
				const roots = this.resolveFsRoots();
				return new Response(JSON.stringify({ roots }, null, 2), {
					headers: { "Content-Type": "application/json" },
				});
			}

			if (url.pathname === "/api/fs/list" && req.method === "GET") {
				const rawPath = url.searchParams.get("path");
				if (!rawPath) {
					return new Response("path required", { status: 400 });
				}
				const resolved = this.resolveFsPath(rawPath);
				const roots = this.resolveFsRoots();
				if (!this.isPathWithinRoots(resolved, roots)) {
					return new Response("path not allowed", { status: 403 });
				}
				if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
					return new Response("path not found", { status: 404 });
				}

				const entries = readdirSync(resolved, { withFileTypes: true })
					.filter((entry) => entry.isDirectory())
					.map((entry) => ({
						name: entry.name,
						path: join(resolved, entry.name),
					}))
					.sort((a, b) => a.name.localeCompare(b.name));

				const parent = normalize(join(resolved, ".."));
				const parentAllowed =
					parent !== resolved && this.isPathWithinRoots(parent, roots)
						? parent
						: null;

				return new Response(
					JSON.stringify(
						{
							path: resolved,
							parent: parentAllowed,
							entries,
						},
						null,
						2,
					),
					{
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			if (url.pathname === "/api/providers") {
				if (req.method === "GET") {
					const credentials = readCredentialsFile();
					const providers = listProviderSpecs().map((provider) => {
						const resolved = resolveProviderToken(provider.name);
						return {
							name: provider.name,
							label: provider.label,
							type: provider.type,
							envVars: provider.envVars,
							source: resolved.source,
							envVar: resolved.envVar,
						};
					});

					return new Response(
						JSON.stringify(
							{
								providers,
								credentialsPath: getCredentialsPath(),
								updatedAt: credentials?.updatedAt,
							},
							null,
							2,
						),
						{
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				return new Response("Method Not Allowed", { status: 405 });
			}

			const agentDetailMatch = url.pathname.match(/^\/api\/agents\/([^/]+)$/);
			if (agentDetailMatch) {
				const agentId = decodeURIComponent(agentDetailMatch[1]);
				const loader = new AgentLoader(
					this.configDir,
					this.workspace,
					this.wingmanConfig,
				);
				const configs = loader.loadAllAgentConfigs();
				const config = configs.find((item) => item.name === agentId);
				const displayName =
					this.wingmanConfig.agents?.list?.find((agent) => agent.id === agentId)
						?.name || agentId;

				if (req.method === "GET") {
					if (!config) {
						return new Response("Agent not found", { status: 404 });
					}

					return new Response(
						JSON.stringify(
							{
								id: config.name,
								displayName,
								description: config.description,
								tools: config.tools || [],
								model: config.model,
								prompt: config.systemPrompt,
							},
							null,
							2,
						),
						{ headers: { "Content-Type": "application/json" } },
					);
				}

				if (req.method === "PUT") {
					if (!config) {
						return new Response("Agent not found", { status: 404 });
					}

					const body = (await req.json()) as {
						displayName?: string;
						description?: string;
						model?: string;
						tools?: string[];
						prompt?: string;
					};

					const tools = Array.isArray(body.tools)
						? body.tools.filter((tool) =>
								getAvailableTools().includes(tool as any),
							)
						: config.tools || [];

					const nextDescription = body.description ?? config.description;
					const nextModel = body.model ?? config.model;
					const nextPrompt = body.prompt ?? config.systemPrompt;

					const agentsDir = join(this.resolveConfigDirPath(), "agents", agentId);
					const agentJsonPath = join(agentsDir, "agent.json");
					const agentMarkdownPath = join(agentsDir, "agent.md");
					const hasJson = existsSync(agentJsonPath);
					const hasMarkdown = existsSync(agentMarkdownPath);

					if (!hasJson && !hasMarkdown) {
						return new Response("Agent not found", { status: 404 });
					}

					if (hasJson) {
						const raw = readFileSync(agentJsonPath, "utf-8");
						const parsed = JSON.parse(raw) as Record<string, any>;
						parsed.name = agentId;
						parsed.description = nextDescription;
						parsed.tools = tools;
						if (nextModel) {
							parsed.model = nextModel;
						} else {
							delete parsed.model;
						}
						parsed.systemPrompt = nextPrompt;
						writeFileSync(agentJsonPath, JSON.stringify(parsed, null, 2));
					} else if (hasMarkdown) {
						const raw = readFileSync(agentMarkdownPath, "utf-8");
						const { metadata } = this.parseAgentMarkdown(raw);
						metadata.name = agentId;
						metadata.description = nextDescription;
						metadata.tools = tools;
						if (nextModel) {
							metadata.model = nextModel;
						} else {
							delete metadata.model;
						}
						const updatedMarkdown = this.serializeAgentMarkdown(
							metadata,
							nextPrompt,
						);
						writeFileSync(agentMarkdownPath, updatedMarkdown);
					}

					if (this.wingmanConfig.agents?.list) {
						const nextList = this.wingmanConfig.agents.list.map((agent) =>
							agent.id === agentId
								? { ...agent, name: body.displayName || agent.name || agentId }
								: agent,
						);
						this.wingmanConfig = {
							...this.wingmanConfig,
							agents: {
								list: nextList,
								bindings: this.wingmanConfig.agents?.bindings || [],
							},
						};
						this.persistWingmanConfig();
					}

					return new Response(
						JSON.stringify(
							{
								id: agentId,
								displayName: body.displayName || displayName || agentId,
								description: nextDescription,
								tools,
								model: nextModel,
								prompt: nextPrompt,
							},
							null,
							2,
						),
						{ headers: { "Content-Type": "application/json" } },
					);
				}

				return new Response("Method Not Allowed", { status: 405 });
			}

			if (url.pathname === "/api/agents") {
				if (req.method === "GET") {
					const loader = new AgentLoader(
						this.configDir,
						this.workspace,
						this.wingmanConfig,
					);
					const configs = loader.loadAllAgentConfigs();
					const displayNames =
						this.wingmanConfig.agents?.list?.reduce<Record<string, string>>(
							(acc, agent) => {
								if (agent.name) {
									acc[agent.id] = agent.name;
								}
								return acc;
							},
							{},
						) || {};

					const agents = configs.map((config) => ({
						id: config.name,
						displayName: displayNames[config.name] || config.name,
						description: config.description,
						tools: config.tools || [],
						model: config.model,
						subAgents:
							config.subAgents?.map((sub) => ({
								id: sub.name,
								displayName: sub.name,
								description: sub.description,
								tools: sub.tools || [],
								model: sub.model,
							})) || [],
					}));

					return new Response(
						JSON.stringify(
							{
								agents,
								tools: getAvailableTools(),
								builtInTools: this.getBuiltInTools(),
							},
							null,
							2,
						),
						{ headers: { "Content-Type": "application/json" } },
					);
				}

				if (req.method === "POST") {
					const body = (await req.json()) as {
						id?: string;
						displayName?: string;
						description?: string;
						model?: string;
						tools?: string[];
						prompt?: string;
					};

					const id = body?.id?.trim();
					if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
						return new Response("Invalid agent id", { status: 400 });
					}

					const tools = Array.isArray(body.tools)
						? body.tools.filter((tool) =>
								getAvailableTools().includes(tool as any),
							)
						: [];

					const agentsDir = join(this.resolveConfigDirPath(), "agents", id);
					if (existsSync(agentsDir)) {
						return new Response("Agent already exists", { status: 409 });
					}

					mkdirSync(agentsDir, { recursive: true });
					const agentMarkdown = this.buildAgentMarkdown({
						id,
						description: body.description,
						tools,
						model: body.model,
						prompt: body.prompt,
					});
					writeFileSync(join(agentsDir, "agent.md"), agentMarkdown);

					const agentList = this.wingmanConfig.agents?.list || [];
					agentList.push({
						id,
						name: body.displayName || id,
					});
					this.wingmanConfig = {
						...this.wingmanConfig,
						agents: {
							list: agentList,
							bindings: this.wingmanConfig.agents?.bindings || [],
						},
					};
					this.router = new GatewayRouter(this.wingmanConfig);
					this.persistWingmanConfig();

					return new Response(
						JSON.stringify(
							{
								id,
								displayName: body.displayName || id,
								description: body.description,
								tools,
								model: body.model,
							},
							null,
							2,
						),
						{ headers: { "Content-Type": "application/json" } },
					);
				}

				return new Response("Method Not Allowed", { status: 405 });
			}

			const providerMatch = url.pathname.match(/^\/api\/providers\/([^/]+)$/);
			if (providerMatch) {
				const providerName = decodeURIComponent(providerMatch[1]);
				const provider = getProviderSpec(providerName);
				if (!provider) {
					return new Response("Unknown provider", { status: 404 });
				}

				if (req.method === "POST") {
					const body = (await req.json()) as { token?: string; apiKey?: string };
					const token = (body?.token || body?.apiKey || "").trim();
					if (!token) {
						return new Response("Token required", { status: 400 });
					}
					saveProviderToken(provider.name, token);
					const resolved = resolveProviderToken(provider.name);
					return new Response(
						JSON.stringify(
							{
								name: provider.name,
								label: provider.label,
								type: provider.type,
								envVars: provider.envVars,
								source: resolved.source,
								envVar: resolved.envVar,
							},
							null,
							2,
						),
						{
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				if (req.method === "DELETE") {
					deleteProviderCredentials(provider.name);
					const resolved = resolveProviderToken(provider.name);
					return new Response(
						JSON.stringify(
							{
								name: provider.name,
								label: provider.label,
								type: provider.type,
								envVars: provider.envVars,
								source: resolved.source,
								envVar: resolved.envVar,
							},
							null,
							2,
						),
						{
							headers: { "Content-Type": "application/json" },
						},
					);
				}

				return new Response("Method Not Allowed", { status: 405 });
			}

			if (url.pathname === "/api/sessions") {
				if (req.method === "GET") {
					const limit = Number(url.searchParams.get("limit") || "100");
					const status =
						(url.searchParams.get("status") as "active" | "archived" | "deleted" | null) ||
						"active";
					const agentId = url.searchParams.get("agentId") || undefined;
					const agents = agentId
						? [agentId]
						: this.wingmanConfig.agents?.list?.map((agent) => agent.id) || ["main"];

					const sessions: Array<Record<string, unknown>> = [];
					for (const agent of agents) {
						const manager = await this.getSessionManager(agent);
						const list = manager.listSessions({
							status,
							limit,
							agentName: agent,
						});
						for (const session of list) {
							sessions.push({
								id: session.id,
								name: session.name,
								agentId: session.agentName,
								createdAt: session.createdAt.getTime(),
								updatedAt: session.updatedAt.getTime(),
								messageCount: session.messageCount,
								lastMessagePreview: session.lastMessagePreview,
								workdir: session.metadata?.workdir ?? null,
							});
						}
					}

					const sorted = sessions.sort((a, b) => {
						const aUpdated = typeof a.updatedAt === "number" ? a.updatedAt : 0;
						const bUpdated = typeof b.updatedAt === "number" ? b.updatedAt : 0;
						return bUpdated - aUpdated;
					});

					return new Response(JSON.stringify(sorted.slice(0, limit), null, 2), {
						headers: { "Content-Type": "application/json" },
					});
				}

				if (req.method === "POST") {
					const body = (await req.json()) as {
						agentId?: string;
						name?: string;
						sessionId?: string;
					};
					const selectedAgent = this.router.selectAgent(body.agentId);
					if (!selectedAgent) {
						return new Response("Invalid agent", { status: 400 });
					}
					const sessionId =
						body.sessionId ||
						`agent:${selectedAgent}:webui:thread:${randomUUID()}`;

					const manager = await this.getSessionManager(selectedAgent);
					const session = manager.getOrCreateSession(sessionId, selectedAgent, body.name);

					return new Response(
						JSON.stringify(
							{
								id: session.id,
								name: session.name,
								agentId: session.agentName,
								createdAt: session.createdAt.getTime(),
								updatedAt: session.updatedAt.getTime(),
								messageCount: session.messageCount,
								lastMessagePreview: session.lastMessagePreview,
								workdir: session.metadata?.workdir ?? null,
							},
							null,
							2,
						),
						{ headers: { "Content-Type": "application/json" } },
					);
				}

				return new Response("Method Not Allowed", { status: 405 });
			}

			const sessionMessagesMatch = url.pathname.match(
				/^\/api\/sessions\/(.+)\/messages$/,
			);
			if (sessionMessagesMatch && req.method === "GET") {
				const sessionId = decodeURIComponent(sessionMessagesMatch[1]);
				const agentId = url.searchParams.get("agentId");
				if (!agentId) {
					return new Response("agentId required", { status: 400 });
				}
				const manager = await this.getSessionManager(agentId);
				const messages = await manager.listMessages(sessionId);
				return new Response(JSON.stringify(messages, null, 2), {
					headers: { "Content-Type": "application/json" },
				});
			}

			const sessionWorkdirMatch = url.pathname.match(
				/^\/api\/sessions\/(.+)\/workdir$/,
			);
			if (sessionWorkdirMatch && req.method === "POST") {
				const sessionId = decodeURIComponent(sessionWorkdirMatch[1]);
				const agentId = url.searchParams.get("agentId");
				if (!agentId) {
					return new Response("agentId required", { status: 400 });
				}
				const body = (await req.json()) as { workdir?: string | null };
				const manager = await this.getSessionManager(agentId);
				const session = manager.getSession(sessionId);
				if (!session) {
					return new Response("session not found", { status: 404 });
				}

				const rawWorkdir = body?.workdir;
				if (!rawWorkdir) {
					manager.updateSessionMetadata(sessionId, { workdir: null });
					return new Response(
						JSON.stringify(
							{
								id: session.id,
								workdir: null,
							},
							null,
							2,
						),
						{ headers: { "Content-Type": "application/json" } },
					);
				}

				const resolved = this.resolveFsPath(rawWorkdir);
				const roots = this.resolveFsRoots();
				if (!this.isPathWithinRoots(resolved, roots)) {
					return new Response("workdir not allowed", { status: 403 });
				}
				if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
					return new Response("workdir not found", { status: 404 });
				}

				manager.updateSessionMetadata(sessionId, { workdir: resolved });
				return new Response(
					JSON.stringify(
						{
							id: session.id,
							workdir: resolved,
						},
						null,
						2,
					),
					{ headers: { "Content-Type": "application/json" } },
				);
			}

			const sessionDeleteMatch = url.pathname.match(/^\/api\/sessions\/(.+)$/);
			if (sessionDeleteMatch && req.method === "DELETE") {
				const sessionId = decodeURIComponent(sessionDeleteMatch[1]);
				const agentId = url.searchParams.get("agentId");
				if (!agentId) {
					return new Response("agentId required", { status: 400 });
				}
				const manager = await this.getSessionManager(agentId);
				manager.deleteSession(sessionId);
				return new Response(JSON.stringify({ ok: true }), {
					headers: { "Content-Type": "application/json" },
				});
			}

			return new Response("Not Found", { status: 404 });
		}

		if (req.method !== "GET") {
			return new Response("Method Not Allowed", { status: 405 });
		}

		if (url.pathname === "/ui" || url.pathname === "/ui/") {
			return new Response(null, {
				status: 302,
				headers: { Location: "/" },
			});
		}

		if (!this.uiDistDir) {
			return new Response("Control UI build not found", { status: 404 });
		}

		const relativePath =
			url.pathname === "/" || url.pathname === "/index.html"
				? "index.html"
				: url.pathname.replace(/^\/+/, "");

		const candidate = normalize(join(this.uiDistDir, relativePath));
		if (!candidate.startsWith(this.uiDistDir)) {
			return new Response("Invalid path", { status: 400 });
		}

		if (!existsSync(candidate) || !statSync(candidate).isFile()) {
			const isAssetRequest =
				relativePath.startsWith("assets/") || relativePath.includes(".");
			if (!isAssetRequest) {
				const indexPath = normalize(join(this.uiDistDir, "index.html"));
				if (existsSync(indexPath) && statSync(indexPath).isFile()) {
					return new Response(Bun.file(indexPath), {
						headers: {
							"Cache-Control": "no-store",
							"Content-Type": "text/html; charset=utf-8",
						},
					});
				}
			}
			return new Response("Not Found", { status: 404 });
		}

		const file = Bun.file(candidate);
		const headers: Record<string, string> = {
			"Cache-Control": "no-store",
		};
		if (relativePath === "index.html") {
			headers["Content-Type"] = "text/html; charset=utf-8";
		}

		return new Response(file, { headers });
	}

	/**
	 * Get the auth instance
	 */
	getAuth(): GatewayAuth {
		return this.auth;
	}

	/**
	 * Get the server config
	 */
	getConfig(): GatewayConfig {
		return this.config;
	}

	/**
	 * Handle HTTP bridge send request
	 */
	private async handleBridgeSend(req: Request): Promise<Response> {
		try {
			const message = (await req.json()) as GatewayMessage;

			// Validate message
			const validation = validateGatewayMessage(message);
			if (!validation.success) {
				return new Response(
					JSON.stringify({ error: validation.error }),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			const validatedMessage = validation.data;

			// Handle registration specially for HTTP bridge
			if (validatedMessage.type === "register") {
				const payload = validatedMessage.payload as RegisterPayload;
				const nodeId = this.generateNodeId();

				// Store node in bridge queues (without WebSocket)
				this.bridgeQueues.set(nodeId, []);

				// Send registered response
				const response: GatewayMessage = {
					type: "registered",
					nodeId,
					timestamp: Date.now(),
				};

				this.log("info", `HTTP bridge node registered: ${payload.name}`);

				return new Response(JSON.stringify(response), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}

			// For other messages, queue them for the node's poll
			const nodeId = validatedMessage.nodeId;
			if (!nodeId) {
				return new Response(
					JSON.stringify({ error: "nodeId required" }),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			// Process message (similar to WebSocket handling)
			this.messagesProcessed++;

			// Handle different message types
			// For now, just acknowledge
			return new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			return new Response(
				JSON.stringify({
					error: error instanceof Error ? error.message : "Unknown error",
				}),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
	}

	/**
	 * Handle HTTP bridge poll request
	 */
	private async handleBridgePoll(req: Request): Promise<Response> {
		try {
			const nodeId = req.headers.get("X-Node-ID");
			if (!nodeId) {
				return new Response(
					JSON.stringify({ error: "X-Node-ID header required" }),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			// Check if there are queued messages
			const queue = this.bridgeQueues.get(nodeId);
			if (!queue) {
				return new Response(
					JSON.stringify({ error: "Node not registered" }),
					{
						status: 404,
						headers: { "Content-Type": "application/json" },
					},
				);
			}

			// If there are messages, return them immediately
			if (queue.length > 0) {
				const messages = [...queue];
				queue.length = 0; // Clear the queue
				return new Response(JSON.stringify(messages), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}

			// Otherwise, wait for messages (long polling)
			const messages = await new Promise<GatewayMessage[]>((resolve) => {
				// Set a timeout for long polling (30 seconds)
				const timeout = setTimeout(() => {
					this.bridgePollWaiters.delete(nodeId);
					resolve([]);
				}, 30000);

				// Store the waiter
				this.bridgePollWaiters.set(nodeId, (msgs) => {
					clearTimeout(timeout);
					resolve(msgs);
				});
			});

			return new Response(JSON.stringify(messages), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			return new Response(
				JSON.stringify({
					error: error instanceof Error ? error.message : "Unknown error",
				}),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
			);
		}
	}

	/**
	 * Queue a message for an HTTP bridge client
	 */
	private queueBridgeMessage(nodeId: string, message: GatewayMessage): void {
		const queue = this.bridgeQueues.get(nodeId);
		if (queue) {
			queue.push(message);

			// Notify waiting poller if present
			const waiter = this.bridgePollWaiters.get(nodeId);
			if (waiter) {
				this.bridgePollWaiters.delete(nodeId);
				const messages = [...queue];
				queue.length = 0;
				waiter(messages);
			}
		}
	}

	/**
	 * Generate a unique node ID
	 */
	private generateNodeId(): string {
		return `node-${Date.now()}-${Math.random().toString(36).substring(7)}`;
	}
}
