import type { GatewayMessage } from "../types.js";
import type { TransportClient, TransportOptions } from "./types.js";
import { createLogger } from "@/logger.js";

const logger = createLogger();

export function describeWebSocketError(
	error: unknown,
	url: string,
): string {
	if (error instanceof Error) {
		const message = error.message.trim();
		return message
			? `WebSocket connection failed to ${url}: ${message}`
			: `WebSocket connection failed to ${url}.`;
	}

	if (typeof error === "string" && error.trim()) {
		return `WebSocket connection failed to ${url}: ${error.trim()}`;
	}

	if (error && typeof error === "object") {
		const typed = error as Record<string, unknown>;
		const eventType =
			typeof typed.type === "string" && typed.type.trim()
				? typed.type.trim()
				: "error";
		const message =
			typeof typed.message === "string" && typed.message.trim()
				? typed.message.trim()
				: null;
		const reason =
			typeof typed.reason === "string" && typed.reason.trim()
				? typed.reason.trim()
				: null;
		const detail = message || reason;
		return detail
			? `WebSocket ${eventType} while connecting to ${url}: ${detail}`
			: `WebSocket ${eventType} while connecting to ${url}.`;
	}

	return `WebSocket connection failed to ${url}.`;
}

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
			let settled = false;
			const rejectOnce = (reason: Error) => {
				if (settled) return;
				settled = true;
				clearTimeout(timeout);
				reject(reason);
			};
			const resolveOnce = () => {
				if (settled) return;
				settled = true;
				clearTimeout(timeout);
				resolve();
			};

			const timeout = setTimeout(() => {
				if (this.ws) {
					this.ws.close();
				}
				rejectOnce(
					new Error(
						`WebSocket connection timeout after ${this.options.connectionTimeout}ms (${this.url}).`,
					),
				);
			}, this.options.connectionTimeout);

			try {
				this.ws = new WebSocket(this.url);

				this.ws.onopen = () => {
					this.reconnectAttempts = 0;
					resolveOnce();
				};

				this.ws.onmessage = (event) => {
					try {
						const message = JSON.parse(event.data) as GatewayMessage;
						if (this.messageHandler) {
							this.messageHandler(message);
						}
					} catch (error) {
						logger.error("Failed to parse message", error);
					}
				};

				this.ws.onerror = (error) => {
					rejectOnce(new Error(describeWebSocketError(error, this.url)));
				};

				this.ws.onclose = (event) => {
					if (!settled) {
						const code =
							event && typeof event.code === "number"
								? String(event.code)
								: "unknown";
						const reason =
							event &&
							typeof event.reason === "string" &&
							event.reason.trim()
								? ` (${event.reason.trim()})`
								: "";
						rejectOnce(
							new Error(
								`WebSocket closed before connection was established (${this.url}, code=${code})${reason}.`,
							),
						);
						return;
					}
					this.ws = null;
					if (
						this.options.autoReconnect &&
						this.reconnectAttempts < (this.options.maxReconnectAttempts || 5)
					) {
						this.scheduleReconnect();
					}
				};
			} catch (error) {
				rejectOnce(new Error(describeWebSocketError(error, this.url)));
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
				logger.error("Reconnect failed", error);
			});
		}, this.options.reconnectDelay);
	}
}
