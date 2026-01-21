import type { GatewayMessage } from "../types.js";

/**
 * Transport types
 */
export type TransportType = "websocket" | "http";

/**
 * Transport client interface
 */
export interface TransportClient {
	/**
	 * Connect to the gateway
	 */
	connect(): Promise<void>;

	/**
	 * Disconnect from the gateway
	 */
	disconnect(): void;

	/**
	 * Send a message to the gateway
	 */
	send(message: GatewayMessage): void;

	/**
	 * Register message handler
	 */
	onMessage(handler: (message: GatewayMessage) => void): void;

	/**
	 * Check if connected
	 */
	isConnected(): boolean;

	/**
	 * Get transport type
	 */
	getType(): TransportType;
}

/**
 * Transport client options
 */
export interface TransportOptions {
	/**
	 * Authentication token
	 */
	token?: string;

	/**
	 * Reconnect automatically on disconnect
	 */
	autoReconnect?: boolean;

	/**
	 * Maximum reconnection attempts
	 */
	maxReconnectAttempts?: number;

	/**
	 * Reconnect delay in ms
	 */
	reconnectDelay?: number;

	/**
	 * Connection timeout in ms
	 */
	connectionTimeout?: number;
}
