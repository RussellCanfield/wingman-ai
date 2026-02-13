import type { Server, ServerWebSocket } from "bun";
import type { Logger } from "@/logger.js";

export interface BrowserRelayConfig {
	enabled: boolean;
	host: string;
	port: number;
	requireAuth: boolean;
	authToken?: string;
	maxMessageBytes: number;
}

type RelaySocketData = {
	kind: "extension" | "cdp";
	authenticated: boolean;
	helloComplete?: boolean;
	token?: string;
};

type RelaySocket = ServerWebSocket<RelaySocketData>;

type CdpRequestMessage = {
	id?: number;
	method?: string;
	params?: Record<string, unknown>;
	sessionId?: string;
};

const RELAY_INFO = {
	product: "Wingman Browser Relay",
	protocolVersion: "1.3",
	userAgent: "WingmanRelay/0.2.0",
	jsVersion: "wingman-relay",
} as const;

const SESSION_OPTIONAL_METHODS = new Set([
	"Browser.getVersion",
	"Target.setDiscoverTargets",
	"Target.setAutoAttach",
	"Target.getTargets",
	"Target.attachToTarget",
	"Target.detachFromTarget",
	"Target.activateTarget",
]);

export function isLoopbackHost(host: string): boolean {
	const normalized = host.trim().toLowerCase();
	return (
		normalized === "127.0.0.1" ||
		normalized === "localhost" ||
		normalized === "::1"
	);
}

function parseJsonMessage(raw: string): unknown | null {
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function safeErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export class BrowserRelayServer {
	private readonly config: BrowserRelayConfig;
	private readonly logger: Logger;
	private server: Server<RelaySocketData> | null = null;
	private extensionSocket: RelaySocket | null = null;
	private cdpSockets: Set<RelaySocket> = new Set();
	private latestSessionId: string | null = null;
	private sessionByTargetId: Map<string, string> = new Map();
	private targetBySessionId: Map<string, string> = new Map();

	constructor(config: BrowserRelayConfig, logger: Logger) {
		this.config = config;
		this.logger = logger;
	}

	get running(): boolean {
		return this.server !== null;
	}

	get wsEndpoint(): string {
		return this.buildWsUrl("/cdp");
	}

	get healthEndpoint(): string {
		return `http://${this.config.host}:${this.config.port}/health`;
	}

	private buildWsUrl(pathname: string): string {
		const tokenParam = this.config.requireAuth
			? `?token=${encodeURIComponent(this.config.authToken || "")}`
			: "";
		return `ws://${this.config.host}:${this.config.port}${pathname}${tokenParam}`;
	}

	private validateStartupConfig(): void {
		if (!this.config.enabled) {
			return;
		}
		if (!isLoopbackHost(this.config.host)) {
			throw new Error(
				`Browser relay host must be loopback for security. Received "${this.config.host}".`,
			);
		}
		if (this.config.requireAuth && !(this.config.authToken || "").trim()) {
			throw new Error(
				"Browser relay auth is enabled but no token is configured. Run `wingman browser extension pair`.",
			);
		}
	}

	start(): void {
		if (!this.config.enabled || this.server) {
			return;
		}

		this.validateStartupConfig();

		this.server = Bun.serve({
			hostname: this.config.host,
			port: this.config.port,
			fetch: (req, server) => this.handleFetch(req, server),
			websocket: {
				open: (ws) => this.handleOpen(ws),
				message: (ws, message) => this.handleMessage(ws, message),
				close: (ws) => this.handleClose(ws),
			},
		});

		this.logger.info(
			`Browser relay started on ${this.config.host}:${this.config.port}`,
		);
	}

	stop(): void {
		if (!this.server) {
			return;
		}
		this.server.stop();
		this.server = null;
		this.extensionSocket = null;
		this.cdpSockets.clear();
		this.latestSessionId = null;
		this.sessionByTargetId.clear();
		this.targetBySessionId.clear();
		this.logger.info("Browser relay stopped");
	}

	private handleFetch(
		req: Request,
		server: Server<RelaySocketData>,
	): Response | undefined {
		const url = new URL(req.url);
		const token = url.searchParams.get("token") || undefined;
		if (url.pathname === "/" || url.pathname === "/health") {
			return new Response("ok");
		}

		if (url.pathname === "/json/version") {
			return Response.json({
				Browser: RELAY_INFO.product,
				"Protocol-Version": RELAY_INFO.protocolVersion,
				"User-Agent": RELAY_INFO.userAgent,
				"V8-Version": RELAY_INFO.jsVersion,
				webSocketDebuggerUrl: this.buildWsUrl("/cdp"),
			});
		}

		if (url.pathname === "/extension" || url.pathname === "/cdp") {
			const kind = url.pathname === "/extension" ? "extension" : "cdp";
			const upgraded = server.upgrade(req, {
				data: {
					kind,
					token,
					authenticated: false,
					helloComplete: kind === "cdp" ? true : false,
				},
			});
			if (!upgraded) {
				return new Response("Relay upgrade failed", { status: 400 });
			}
			return undefined;
		}

		return new Response("Not Found", { status: 404 });
	}

	private authenticateSocket(socket: RelaySocket): boolean {
		if (!this.config.requireAuth) {
			socket.data.authenticated = true;
			return true;
		}
		const configured = (this.config.authToken || "").trim();
		if (!configured || socket.data.token !== configured) {
			socket.close(4401, "Unauthorized");
			return false;
		}
		socket.data.authenticated = true;
		return true;
	}

	private handleOpen(socket: RelaySocket): void {
		if (!this.authenticateSocket(socket)) {
			return;
		}

		if (socket.data.kind === "extension") {
			if (this.extensionSocket && this.extensionSocket !== socket) {
				this.extensionSocket.close(4409, "Extension replaced");
			}
			this.extensionSocket = socket;
			return;
		}

		this.cdpSockets.add(socket);
	}

	private handleClose(socket: RelaySocket): void {
		if (socket.data.kind === "extension") {
			if (this.extensionSocket === socket) {
				this.extensionSocket = null;
			}
			this.latestSessionId = null;
			this.sessionByTargetId.clear();
			this.targetBySessionId.clear();
			return;
		}

		this.cdpSockets.delete(socket);
	}

	private handleMessage(socket: RelaySocket, message: string | Buffer): void {
		const raw = message.toString();
		if (Buffer.byteLength(raw, "utf8") > this.config.maxMessageBytes) {
			socket.close(1009, "Message too large");
			return;
		}

		const parsed = parseJsonMessage(raw);
		if (!parsed || typeof parsed !== "object") {
			return;
		}

		if (socket.data.kind === "extension") {
			this.handleExtensionMessage(socket, parsed as Record<string, unknown>);
			return;
		}

		this.handleCdpMessage(socket, parsed as CdpRequestMessage);
	}

	private handleExtensionMessage(
		socket: RelaySocket,
		message: Record<string, unknown>,
	): void {
		if (!socket.data.helloComplete) {
			const method = typeof message.method === "string" ? message.method : "";
			const token = (message.params as Record<string, unknown> | undefined)
				?.token;
			if (method !== "hello") {
				socket.close(4403, "Expected hello handshake");
				return;
			}
			if (
				this.config.requireAuth &&
				(typeof token !== "string" || token !== this.config.authToken)
			) {
				socket.close(4401, "Invalid extension token");
				return;
			}
			socket.data.helloComplete = true;
			this.sendJson(socket, { method: "hello_ack", params: { ok: true } });
			return;
		}

		if (typeof message.id === "number" && ("result" in message || "error" in message)) {
			this.broadcastToCdp(message);
			return;
		}

		if (message.method === "forwardCDPEvent" && message.params) {
			const event = message.params as Record<string, unknown>;
			const method = typeof event.method === "string" ? event.method : "";
			const params = (event.params as Record<string, unknown> | undefined) || {};
			this.trackTargetSessions(method, params);
			this.broadcastToCdp(event);
		}
	}

	private handleCdpMessage(socket: RelaySocket, message: CdpRequestMessage): void {
		const id = message.id;
		const method = message.method;
		if (typeof id !== "number" || typeof method !== "string") {
			return;
		}

		if (method === "Browser.getVersion") {
			this.sendJson(socket, {
				id,
				result: {
					product: RELAY_INFO.product,
					protocolVersion: RELAY_INFO.protocolVersion,
					userAgent: RELAY_INFO.userAgent,
					jsVersion: RELAY_INFO.jsVersion,
					revision: "wingman",
				},
			});
			return;
		}

		if (method === "Target.setDiscoverTargets" || method === "Target.setAutoAttach") {
			this.sendJson(socket, { id, result: {} });
			return;
		}

		if (method === "Target.getTargets") {
			const targetInfos = Array.from(this.sessionByTargetId.keys()).map((targetId) => ({
				targetId,
				type: "page",
				attached: true,
			}));
			this.sendJson(socket, { id, result: { targetInfos } });
			return;
		}

		if (method === "Target.attachToTarget") {
			const targetId = String((message.params || {}).targetId || "");
			const sessionId = this.sessionByTargetId.get(targetId) || this.latestSessionId;
			if (!sessionId) {
				this.sendJson(socket, {
					id,
					error: { message: "No attached target is available" },
				});
				return;
			}
			this.sendJson(socket, { id, result: { sessionId } });
			return;
		}

		if (method === "Target.detachFromTarget" || method === "Target.activateTarget") {
			this.sendJson(socket, { id, result: {} });
			return;
		}

		const extension = this.extensionSocket;
		if (!extension || !extension.data.helloComplete) {
			this.sendJson(socket, {
				id,
				error: { message: "No extension is connected to browser relay" },
			});
			return;
		}

		const sessionId =
			(typeof message.sessionId === "string" && message.sessionId) ||
			(typeof (message.params || {}).sessionId === "string"
				? String((message.params || {}).sessionId)
				: undefined) ||
			this.latestSessionId ||
			undefined;

		if (!sessionId && !SESSION_OPTIONAL_METHODS.has(method)) {
			this.sendJson(socket, {
				id,
				error: { message: `No active tab session for method "${method}"` },
			});
			return;
		}

		this.sendJson(extension, {
			id,
			method: "forwardCDPCommand",
			params: {
				sessionId,
				method,
				params: message.params || {},
			},
		});
	}

	private trackTargetSessions(
		method: string,
		params: Record<string, unknown>,
	): void {
		if (method === "Target.attachedToTarget") {
			const sessionId =
				typeof params.sessionId === "string" ? params.sessionId : null;
			const targetId =
				typeof (params.targetInfo as Record<string, unknown> | undefined)?.targetId ===
				"string"
					? String(
							(params.targetInfo as Record<string, unknown> | undefined)
								?.targetId,
						)
					: null;
			if (sessionId) {
				this.latestSessionId = sessionId;
			}
			if (sessionId && targetId) {
				this.sessionByTargetId.set(targetId, sessionId);
				this.targetBySessionId.set(sessionId, targetId);
			}
			return;
		}

		if (method === "Target.detachedFromTarget") {
			const sessionId =
				typeof params.sessionId === "string" ? params.sessionId : null;
			if (!sessionId) {
				return;
			}
			const targetId = this.targetBySessionId.get(sessionId);
			if (targetId) {
				this.sessionByTargetId.delete(targetId);
				this.targetBySessionId.delete(sessionId);
			}
			if (this.latestSessionId === sessionId) {
				this.latestSessionId =
					this.targetBySessionId.size > 0
						? Array.from(this.targetBySessionId.keys())[0]
						: null;
			}
		}
	}

	private broadcastToCdp(payload: unknown): void {
		for (const socket of this.cdpSockets) {
			this.sendJson(socket, payload);
		}
	}

	private sendJson(socket: RelaySocket, payload: unknown): void {
		try {
			socket.send(JSON.stringify(payload));
		} catch (error) {
			this.logger.debug(`Browser relay send failed: ${safeErrorMessage(error)}`);
		}
	}
}

