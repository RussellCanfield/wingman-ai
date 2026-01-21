import type {
	GatewayMessage,
	RegisterPayload,
	JoinGroupPayload,
	BroadcastPayload,
	DirectPayload,
	ErrorPayload,
} from "./types.js";
import {
	WebSocketTransport,
	HTTPBridgeTransport,
	type TransportClient,
	type TransportType,
} from "./transport/index.js";

/**
 * Event handlers for the gateway client
 */
export interface GatewayClientEvents {
	connected?: () => void;
	disconnected?: () => void;
	registered?: (nodeId: string, name: string) => void;
	joinedGroup?: (groupId: string, groupName: string) => void;
	leftGroup?: (groupId: string) => void;
	broadcast?: (message: unknown, fromNodeId: string, groupId: string) => void;
	direct?: (message: unknown, fromNodeId: string) => void;
	error?: (error: ErrorPayload) => void;
	ping?: () => void;
	pong?: () => void;
}

/**
 * Gateway client options
 */
export interface GatewayClientOptions {
	token?: string;
	capabilities?: string[];
	events?: GatewayClientEvents;
	transport?: TransportType | "auto";
}

/**
 * Gateway client for connecting nodes to the gateway
 */
export class GatewayClient {
	private url: string;
	private transport: TransportClient | null = null;
	private nodeId: string | null = null;
	private nodeName: string;
	private token?: string;
	private capabilities?: string[];
	private events: GatewayClientEvents;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000;
	private pingInterval: Timer | null = null;
	private transportType: TransportType | "auto";

	// Legacy WebSocket support (deprecated, use transport instead)
	private ws: WebSocket | null = null;

	constructor(
		url: string,
		name: string,
		options: GatewayClientOptions = {},
	) {
		this.url = url;
		this.nodeName = name;
		this.token = options.token;
		this.capabilities = options.capabilities;
		this.events = options.events || {};
		this.transportType = options.transport || "auto";
	}

	/**
	 * Connect to the gateway
	 */
	async connect(): Promise<void> {
		// Determine transport type
		const transportType = this.selectTransport();

		// Create transport instance
		this.transport = this.createTransport(transportType);

		// Set up message handler
		this.transport.onMessage((message) => {
			this.handleMessage(message);
		});

		// Connect
		try {
			await this.transport.connect();
			this.reconnectAttempts = 0;
			this.events.connected?.();
			this.register();
		} catch (error) {
			console.error("Transport connection failed:", error);
			throw error;
		}
	}

	/**
	 * Select appropriate transport type
	 */
	private selectTransport(): TransportType {
		if (this.transportType === "auto") {
			// Auto-detect: try WebSocket first, fall back to HTTP
			// For now, prefer WebSocket if URL starts with ws:// or wss://
			if (this.url.startsWith("ws://") || this.url.startsWith("wss://")) {
				return "websocket";
			}
			// If HTTP/HTTPS URL, use HTTP bridge
			return "http";
		}
		return this.transportType;
	}

	/**
	 * Create transport instance
	 */
	private createTransport(type: TransportType): TransportClient {
		const transportOptions = {
			token: this.token,
			autoReconnect: true,
			maxReconnectAttempts: this.maxReconnectAttempts,
			reconnectDelay: this.reconnectDelay,
		};

		if (type === "http") {
			return new HTTPBridgeTransport(this.url, transportOptions);
		}

		return new WebSocketTransport(this.url, transportOptions);
	}

	/**
	 * Disconnect from the gateway
	 */
	disconnect(): void {
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}

		if (this.transport) {
			this.transport.disconnect();
			this.transport = null;
		}

		// Legacy WebSocket support
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}

		this.nodeId = null;
	}

	/**
	 * Register with the gateway
	 */
	private register(): void {
		const payload: RegisterPayload = {
			name: this.nodeName,
			capabilities: this.capabilities,
			token: this.token,
		};

		this.send({
			type: "register",
			payload,
			timestamp: Date.now(),
		});
	}

	/**
	 * Join a broadcast group
	 */
	async joinGroup(
		groupName: string,
		options: {
			createIfNotExists?: boolean;
			description?: string;
		} = {},
	): Promise<void> {
		const payload: JoinGroupPayload = {
			groupName,
			createIfNotExists: options.createIfNotExists ?? true,
			description: options.description,
		};

		this.send({
			type: "join_group",
			nodeId: this.nodeId || undefined,
			payload,
			timestamp: Date.now(),
		});
	}

	/**
	 * Leave a broadcast group
	 */
	async leaveGroup(groupId: string): Promise<void> {
		this.send({
			type: "leave_group",
			nodeId: this.nodeId || undefined,
			groupId,
			timestamp: Date.now(),
		});
	}

	/**
	 * Broadcast a message to a group
	 */
	broadcast(groupId: string, message: unknown): void {
		const payload: BroadcastPayload = {
			groupId,
			message,
		};

		this.send({
			type: "broadcast",
			nodeId: this.nodeId || undefined,
			payload,
			timestamp: Date.now(),
		});
	}

	/**
	 * Send a direct message to another node
	 */
	sendDirect(targetNodeId: string, message: unknown): void {
		const payload: DirectPayload = {
			targetNodeId,
			message,
		};

		this.send({
			type: "direct",
			nodeId: this.nodeId || undefined,
			payload,
			timestamp: Date.now(),
		});
	}

	/**
	 * Send a ping to the gateway
	 */
	ping(): void {
		this.send({
			type: "ping",
			nodeId: this.nodeId || undefined,
			timestamp: Date.now(),
		});
	}

	/**
	 * Handle incoming messages
	 */
	private handleMessage(msg: GatewayMessage): void {
		try {
			switch (msg.type) {
				case "registered":
					// Handle registration confirmation
					if ("nodeId" in msg && msg.nodeId) {
						this.nodeId = msg.nodeId;
						this.events.registered?.(msg.nodeId, this.nodeName);
						this.startPingInterval();
					}
					break;
				case "ack":
					this.handleAck(msg);
					break;
				case "broadcast":
					this.handleBroadcast(msg);
					break;
				case "direct":
					this.handleDirect(msg);
					break;
				case "ping":
					this.handlePing(msg);
					break;
				case "pong":
					this.handlePong(msg);
					break;
				case "error":
					this.handleError(msg);
					break;
			}
		} catch (error) {
			console.error("Failed to handle message:", error);
		}
	}

	/**
	 * Handle acknowledgment message
	 */
	private handleAck(msg: GatewayMessage): void {
		const payload = msg.payload as any;

		// Registration acknowledgment
		if (payload.nodeId && !this.nodeId) {
			this.nodeId = payload.nodeId;
			this.events.registered?.(payload.nodeId, payload.name);
			this.startPingInterval();
		}

		// Join group acknowledgment
		if (payload.groupId && payload.groupName) {
			this.events.joinedGroup?.(payload.groupId, payload.groupName);
		}

		// Leave group acknowledgment
		if (msg.groupId && !payload.groupName) {
			this.events.leftGroup?.(msg.groupId);
		}
	}

	/**
	 * Handle broadcast message
	 */
	private handleBroadcast(msg: GatewayMessage): void {
		if (msg.nodeId && msg.groupId) {
			this.events.broadcast?.(msg.payload, msg.nodeId, msg.groupId);
		}
	}

	/**
	 * Handle direct message
	 */
	private handleDirect(msg: GatewayMessage): void {
		if (msg.nodeId) {
			this.events.direct?.(msg.payload, msg.nodeId);
		}
	}

	/**
	 * Handle ping message
	 */
	private handlePing(msg: GatewayMessage): void {
		// Send pong response
		this.send({
			type: "pong",
			nodeId: this.nodeId || undefined,
			timestamp: Date.now(),
		});
		this.events.ping?.();
	}

	/**
	 * Handle pong message
	 */
	private handlePong(msg: GatewayMessage): void {
		this.events.pong?.();
	}

	/**
	 * Handle error message
	 */
	private handleError(msg: GatewayMessage): void {
		const error = msg.payload as ErrorPayload;
		this.events.error?.(error);
		console.error(`Gateway error: ${error.code} - ${error.message}`);
	}

	/**
	 * Handle disconnect
	 */
	private handleDisconnect(): void {
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}

		this.events.disconnected?.();

		// Attempt to reconnect
		if (this.reconnectAttempts < this.maxReconnectAttempts) {
			this.reconnectAttempts++;
			const delay = this.reconnectDelay * this.reconnectAttempts;
			console.log(
				`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
			);
			setTimeout(() => this.connect(), delay);
		} else {
			console.error("Max reconnection attempts reached");
		}
	}

	/**
	 * Start ping interval
	 */
	private startPingInterval(): void {
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
		}

		// Send ping every 30 seconds
		this.pingInterval = setInterval(() => {
			this.ping();
		}, 30000);
	}

	/**
	 * Send a message to the gateway
	 */
	private send(message: GatewayMessage): void {
		if (this.transport && this.transport.isConnected()) {
			this.transport.send(message);
			return;
		}

		// Legacy WebSocket support
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
			return;
		}

		console.error("No transport is connected");
	}

	/**
	 * Get the node ID
	 */
	getNodeId(): string | null {
		return this.nodeId;
	}

	/**
	 * Get the node name
	 */
	getNodeName(): string {
		return this.nodeName;
	}

	/**
	 * Check if connected
	 */
	isConnected(): boolean {
		return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
	}
}
