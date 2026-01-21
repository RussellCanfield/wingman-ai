import type { GatewayMessage } from "../types.js";
import type { TransportClient, TransportOptions } from "./types.js";

/**
 * WebSocket transport client
 */
export class WebSocketTransport implements TransportClient {
	private ws: WebSocket | null = null;
	private url: string;
	private options: TransportOptions;
	private messageHandler: ((message: GatewayMessage) => void) | null = null;
	private reconnectAttempts = 0;
	private reconnectTimer: Timer | null = null;

	constructor(url: string, options: TransportOptions = {}) {
		this.url = url;
		this.options = {
			autoReconnect: true,
			maxReconnectAttempts: 5,
			reconnectDelay: 5000,
			connectionTimeout: 10000,
			...options,
		};
	}

	async connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				if (this.ws) {
					this.ws.close();
				}
				reject(new Error("Connection timeout"));
			}, this.options.connectionTimeout);

			try {
				this.ws = new WebSocket(this.url);

				this.ws.onopen = () => {
					clearTimeout(timeout);
					this.reconnectAttempts = 0;
					resolve();
				};

				this.ws.onmessage = (event) => {
					try {
						const message = JSON.parse(event.data) as GatewayMessage;
						if (this.messageHandler) {
							this.messageHandler(message);
						}
					} catch (error) {
						console.error("Failed to parse message:", error);
					}
				};

				this.ws.onerror = (error) => {
					clearTimeout(timeout);
					reject(error);
				};

				this.ws.onclose = () => {
					this.ws = null;
					if (
						this.options.autoReconnect &&
						this.reconnectAttempts < (this.options.maxReconnectAttempts || 5)
					) {
						this.scheduleReconnect();
					}
				};
			} catch (error) {
				clearTimeout(timeout);
				reject(error);
			}
		});
	}

	disconnect(): void {
		this.options.autoReconnect = false;
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
	}

	send(message: GatewayMessage): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			throw new Error("WebSocket not connected");
		}
		this.ws.send(JSON.stringify(message));
	}

	onMessage(handler: (message: GatewayMessage) => void): void {
		this.messageHandler = handler;
	}

	isConnected(): boolean {
		return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
	}

	getType(): "websocket" {
		return "websocket";
	}

	private scheduleReconnect(): void {
		this.reconnectAttempts++;
		this.reconnectTimer = setTimeout(() => {
			this.connect().catch((error) => {
				console.error("Reconnect failed:", error);
			});
		}, this.options.reconnectDelay);
	}
}
