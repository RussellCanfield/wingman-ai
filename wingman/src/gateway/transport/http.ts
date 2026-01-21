import type { GatewayMessage } from "../types.js";
import type { TransportClient, TransportOptions } from "./types.js";

/**
 * HTTP bridge transport client
 * Uses long-polling for receiving messages and POST for sending
 */
export class HTTPBridgeTransport implements TransportClient {
	private baseUrl: string;
	private options: TransportOptions;
	private messageHandler: ((message: GatewayMessage) => void) | null = null;
	private nodeId: string | null = null;
	private connected = false;
	private polling = false;
	private pollAbortController: AbortController | null = null;

	constructor(url: string, options: TransportOptions = {}) {
		// Convert ws:// or wss:// to http:// or https://
		this.baseUrl = url.replace(/^ws:/, "http:").replace(/^wss:/, "https:");
		// Remove /ws suffix if present
		this.baseUrl = this.baseUrl.replace(/\/ws$/, "");

		this.options = {
			autoReconnect: true,
			maxReconnectAttempts: 5,
			reconnectDelay: 5000,
			connectionTimeout: 10000,
			...options,
		};
	}

	async connect(): Promise<void> {
		if (this.connected) {
			throw new Error("Already connected");
		}

		// Initial connection is established when we receive the first registered response
		this.connected = true;
		this.startPolling();
	}

	disconnect(): void {
		this.connected = false;
		this.stopPolling();

		// Send unregister if we have a nodeId
		if (this.nodeId) {
			this.send({
				type: "unregister",
				nodeId: this.nodeId,
				timestamp: Date.now(),
			}).catch(() => {
				// Ignore errors on disconnect
			});
		}

		this.nodeId = null;
	}

	async send(message: GatewayMessage): Promise<void> {
		if (!this.connected) {
			throw new Error("Not connected");
		}

		const response = await fetch(`${this.baseUrl}/bridge/send`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(this.options.token && {
					Authorization: `Bearer ${this.options.token}`,
				}),
			},
			body: JSON.stringify(message),
			signal: AbortSignal.timeout(this.options.connectionTimeout || 10000),
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		// Check if this is a registration response
		if (message.type === "register") {
			const data = (await response.json()) as GatewayMessage;
			if (data.type === "registered" && "nodeId" in data) {
				this.nodeId = data.nodeId as string;
				if (this.messageHandler) {
					this.messageHandler(data);
				}
			}
		}
	}

	onMessage(handler: (message: GatewayMessage) => void): void {
		this.messageHandler = handler;
	}

	isConnected(): boolean {
		return this.connected;
	}

	getType(): "http" {
		return "http";
	}

	private startPolling(): void {
		if (this.polling) {
			return;
		}

		this.polling = true;
		this.poll();
	}

	private stopPolling(): void {
		this.polling = false;
		if (this.pollAbortController) {
			this.pollAbortController.abort();
			this.pollAbortController = null;
		}
	}

	private async poll(): Promise<void> {
		while (this.polling && this.connected) {
			try {
				this.pollAbortController = new AbortController();

				const response = await fetch(`${this.baseUrl}/bridge/poll`, {
					method: "GET",
					headers: {
						...(this.options.token && {
							Authorization: `Bearer ${this.options.token}`,
						}),
						...(this.nodeId && { "X-Node-ID": this.nodeId }),
					},
					signal: this.pollAbortController.signal,
				});

				if (!response.ok) {
					if (response.status === 401) {
						throw new Error("Authentication failed");
					}
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				const messages = (await response.json()) as GatewayMessage[];

				// Process received messages
				if (this.messageHandler && messages.length > 0) {
					for (const message of messages) {
						this.messageHandler(message);
					}
				}
			} catch (error) {
				if (error instanceof Error && error.name === "AbortError") {
					// Poll was cancelled, this is normal
					break;
				}

				console.error("Polling error:", error);

				// Wait before retrying
				if (this.polling && this.connected) {
					await new Promise((resolve) =>
						setTimeout(resolve, this.options.reconnectDelay || 5000),
					);
				}
			}
		}

		this.pollAbortController = null;
	}
}
