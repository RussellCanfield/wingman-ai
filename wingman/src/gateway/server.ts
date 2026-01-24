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

/**
 * Wingman Gateway Server
 * Manages WebSocket connections for AI agent swarming
 */
export class GatewayServer {
	private config: GatewayConfig;
	private nodeManager: NodeManager;
	private groupManager: BroadcastGroupManager;
	private auth: GatewayAuth;
	private server: Server<{ nodeId: string }> | null = null;
	private startedAt: number = 0;
	private messagesProcessed: number = 0;
	private pingInterval: Timer | null = null;
	private discoveryService: DiscoveryService | null = null;
	private logger: Logger;

	// HTTP bridge support
	private bridgeQueues: Map<string, GatewayMessage[]> = new Map();
	private bridgePollWaiters: Map<string, (messages: GatewayMessage[]) => void> = new Map();

	constructor(config: Partial<GatewayConfig> = {}) {
		this.config = {
			port: config.port || 3000,
			host: config.host || "0.0.0.0",
			requireAuth: config.requireAuth ?? false,
			authToken: config.authToken,
			maxNodes: config.maxNodes || 1000,
			pingInterval: config.pingInterval || 30000, // 30 seconds
			pingTimeout: config.pingTimeout || 60000, // 60 seconds
			logLevel: config.logLevel || "info",
			discovery: config.discovery,
		};

		this.nodeManager = new NodeManager(this.config.maxNodes);
		this.groupManager = new BroadcastGroupManager();
		this.logger = createLogger(this.config.logLevel);

		// Initialize auth with token if provided
		const initialTokens = this.config.authToken
			? [this.config.authToken]
			: [];
		this.auth = new GatewayAuth(this.config.requireAuth, initialTokens);
	}

	/**
	 * Start the gateway server
	 */
	async start(): Promise<void> {
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
					const upgraded = server.upgrade(req, {
						data: { nodeId: "" },
					});

					if (!upgraded) {
						return new Response("WebSocket upgrade failed", {
							status: 400,
						});
					}

					return undefined;
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
			requireAuth: this.config.requireAuth,
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
	private handleOpen(ws: ServerWebSocket<{ nodeId: string }>): void {
		this.log("debug", "New WebSocket connection");
	}

	/**
	 * Handle WebSocket message
	 */
	private handleMessage(
		ws: ServerWebSocket<{ nodeId: string }>,
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
	private handleClose(ws: ServerWebSocket<{ nodeId: string }>): void {
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
	private handleDrain(ws: ServerWebSocket<{ nodeId: string }>): void {
		this.log("debug", "WebSocket drained");
	}

	/**
	 * Handle node registration
	 */
	private handleRegister(
		ws: ServerWebSocket<{ nodeId: string }>,
		msg: GatewayMessage,
	): void {
		const payload = msg.payload as RegisterPayload;

		// Validate authentication
		if (!this.auth.validateToken(payload.token)) {
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
		ws: ServerWebSocket<{ nodeId: string }>,
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
		ws: ServerWebSocket<{ nodeId: string }>,
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
		ws: ServerWebSocket<{ nodeId: string }>,
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
		ws: ServerWebSocket<{ nodeId: string }>,
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
		ws: ServerWebSocket<{ nodeId: string }>,
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
		ws: ServerWebSocket<{ nodeId: string }>,
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
		ws: ServerWebSocket<{ nodeId: string }>,
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
		ws: ServerWebSocket<{ nodeId: string }>,
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
		ws: ServerWebSocket<{ nodeId: string }>,
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
			case "silent":
				break;
		}
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
