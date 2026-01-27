import { v4 as uuidv4 } from "uuid";
import { createLogger, type Logger } from "@/logger.js";
import type { GatewayMessage, AgentRequestPayload } from "./types.js";
import { WebSocketTransport } from "./transport/websocket.js";

export interface GatewayRpcClientOptions {
	token?: string;
	password?: string;
	clientType?: string;
	instanceId?: string;
	version?: string;
}

type PendingResponse = {
	resolve: (value: GatewayMessage) => void;
	reject: (error: Error) => void;
};

type PendingAgentRequest = {
	resolve: () => void;
	reject: (error: Error) => void;
	onEvent?: (event: unknown) => void;
};

export class GatewayRpcClient {
	private url: string;
	private logger: Logger;
	private transport: WebSocketTransport | null = null;
	private pendingResponses: Map<string, PendingResponse> = new Map();
	private pendingAgentRequests: Map<string, PendingAgentRequest> = new Map();
	private clientInfo: {
		instanceId: string;
		clientType: string;
		version?: string;
	};
	private auth: { token?: string; password?: string };

	constructor(url: string, options: GatewayRpcClientOptions = {}) {
		this.url = url;
		this.logger = createLogger();
		this.clientInfo = {
			instanceId: options.instanceId || `cli-${Date.now()}`,
			clientType: options.clientType || "cli",
			version: options.version,
		};
		this.auth = {
			token: options.token,
			password: options.password,
		};
	}

	async connect(): Promise<void> {
		this.transport = new WebSocketTransport(this.url, {
			autoReconnect: false,
		});
		this.transport.onMessage((message) => this.handleMessage(message));
		await this.transport.connect();

		const connectId = uuidv4();
		const connectMessage: GatewayMessage = {
			type: "connect",
			id: connectId,
			client: this.clientInfo,
			auth: this.auth,
			timestamp: Date.now(),
		};

		const response = await this.sendRequest(connectId, connectMessage);
		if (!response.ok) {
			throw new Error(
				typeof response.payload === "string"
					? response.payload
					: "Gateway authentication failed",
			);
		}
	}

	async requestAgent(
		payload: AgentRequestPayload,
		onEvent?: (event: unknown) => void,
	): Promise<void> {
		const requestId = uuidv4();
		const message: GatewayMessage = {
			type: "req:agent",
			id: requestId,
			payload,
			timestamp: Date.now(),
		};

		const completion = new Promise<void>((resolve, reject) => {
			this.pendingAgentRequests.set(requestId, { resolve, reject, onEvent });
		});

		this.send(message);
		return completion;
	}

	disconnect(): void {
		if (this.transport) {
			this.transport.disconnect();
			this.transport = null;
		}
	}

	private handleMessage(msg: GatewayMessage): void {
		if (msg.type === "res" && msg.id) {
			const pending = this.pendingResponses.get(msg.id);
			if (pending) {
				this.pendingResponses.delete(msg.id);
				pending.resolve(msg);
				return;
			}
		}

		if (msg.type === "event:agent" && msg.id) {
			const pending = this.pendingAgentRequests.get(msg.id);
			if (!pending) {
				return;
			}

			pending.onEvent?.(msg.payload);

			const payload = msg.payload as any;
			if (payload?.type === "agent-complete") {
				this.pendingAgentRequests.delete(msg.id);
				pending.resolve();
			}

			if (payload?.type === "agent-error") {
				this.pendingAgentRequests.delete(msg.id);
				const error = new Error(payload.error || "Agent failed");
				(error as any).isAgentError = true;
				pending.reject(error);
			}
			return;
		}

		if (msg.type === "error") {
			this.logger.error("Gateway error", msg.payload);
		}
	}

	private sendRequest(id: string, message: GatewayMessage): Promise<GatewayMessage> {
		return new Promise((resolve, reject) => {
			this.pendingResponses.set(id, { resolve, reject });
			this.send(message);
		});
	}

	private send(message: GatewayMessage): void {
		if (!this.transport) {
			throw new Error("Gateway transport not connected");
		}
		this.transport.send(message);
	}
}
