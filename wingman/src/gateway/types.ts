import type { ServerWebSocket } from "bun";

/**
 * Message types for gateway communication
 */
export type MessageType =
	| "register" // Node registration
	| "registered" // Registration confirmation
	| "unregister" // Node leaving
	| "join_group" // Join broadcast group
	| "leave_group" // Leave broadcast group
	| "broadcast" // Send to group
	| "direct" // Send to specific node
	| "ping" // Heartbeat
	| "pong" // Heartbeat response
	| "error" // Error message
	| "ack" // Acknowledgment
	| "upgrade"; // Connection upgrade

/**
 * Gateway message structure
 */
export interface GatewayMessage {
	type: MessageType;
	nodeId?: string;
	groupId?: string;
	targetNodeId?: string;
	payload?: unknown;
	timestamp: number;
	messageId?: string;
}

/**
 * Node metadata
 */
export interface NodeMetadata {
	id: string;
	name: string;
	capabilities?: string[];
	groups: Set<string>;
	connectedAt: number;
	lastPing?: number;
	messageCount?: number; // Total messages sent
	lastMessageTime?: number; // Timestamp of last message
}

/**
 * Node with WebSocket connection
 */
export interface Node extends NodeMetadata {
	ws: ServerWebSocket<{ nodeId: string }>;
}

/**
 * Broadcast processing strategy
 */
export type BroadcastStrategy = "parallel" | "sequential";

/**
 * Broadcast group
 */
export interface BroadcastGroup {
	id: string;
	name: string;
	description?: string;
	createdAt: number;
	createdBy: string;
	members: Set<string>; // Node IDs
	strategy: BroadcastStrategy; // Processing strategy
	metadata?: Record<string, unknown>;
}

/**
 * Gateway configuration
 */
export interface GatewayConfig {
	port: number;
	host: string;
	authToken?: string;
	requireAuth: boolean;
	maxNodes?: number;
	pingInterval?: number;
	pingTimeout?: number;
	logLevel?: "debug" | "info" | "warn" | "error" | "silent";
	discovery?: {
		enabled: boolean;
		method: "mdns" | "tailscale";
		name: string;
	};
}

/**
 * Gateway statistics
 */
export interface GatewayStats {
	uptime: number;
	totalNodes: number;
	totalGroups: number;
	messagesProcessed: number;
	startedAt: number;
}

/**
 * Registration request payload
 */
export interface RegisterPayload {
	name: string;
	capabilities?: string[];
	token?: string;
}

/**
 * Join group request payload
 */
export interface JoinGroupPayload {
	groupId?: string;
	groupName?: string;
	createIfNotExists?: boolean;
	description?: string;
}

/**
 * Broadcast message payload
 */
export interface BroadcastPayload {
	groupId: string;
	message: unknown;
}

/**
 * Direct message payload
 */
export interface DirectPayload {
	targetNodeId: string;
	message: unknown;
}

/**
 * Error payload
 */
export interface ErrorPayload {
	code: string;
	message: string;
	details?: unknown;
}

/**
 * Health check response
 */
export interface HealthResponse {
	status: "healthy" | "degraded" | "unhealthy";
	version: string;
	stats: GatewayStats;
	timestamp: number;
}

/**
 * Daemon status
 */
export interface DaemonStatus {
	running: boolean;
	pid?: number;
	uptime?: number;
	config?: GatewayConfig;
}
