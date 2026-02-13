import type { ServerWebSocket } from "bun";

/**
 * Message types for gateway communication
 */
export type MessageType =
	| "connect" // Client handshake
	| "res" // Response to request
	| "req:agent" // Request agent execution
	| "req:agent:cancel" // Cancel in-flight agent execution
	| "event:agent" // Agent stream events
	| "session_subscribe" // Subscribe to session events
	| "session_unsubscribe" // Unsubscribe from session events
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
	id?: string;
	client?: GatewayClientInfo;
	auth?: GatewayAuthPayload;
	ok?: boolean;
	clientId?: string;
	nodeId?: string;
	groupId?: string;
	roomId?: string;
	targetNodeId?: string;
	payload?: unknown;
	timestamp: number;
	messageId?: string;
}

export interface GatewayClientInfo {
	instanceId: string;
	clientType: string;
	version?: string;
}

export interface GatewayAuthPayload {
	token?: string;
	password?: string;
	deviceId?: string;
}

export interface ImageAttachment {
	kind?: "image";
	dataUrl: string;
	mimeType?: string;
	name?: string;
	size?: number;
}

export interface AudioAttachment {
	kind: "audio";
	dataUrl: string;
	mimeType?: string;
	name?: string;
	size?: number;
}

export interface FileAttachment {
	kind: "file";
	dataUrl: string;
	textContent: string;
	mimeType?: string;
	name?: string;
	size?: number;
}

export type MediaAttachment = ImageAttachment | AudioAttachment | FileAttachment;

export interface AgentRequestPayload {
	agentId?: string;
	content?: string;
	attachments?: MediaAttachment[];
	execution?: {
		workspace?: string;
		configDir?: string;
	};
	routing?: RoutingInfo;
	sessionKey?: string;
	queueIfBusy?: boolean;
}

export interface AgentCancelPayload {
	requestId: string;
}

export interface RoutingPeer {
	kind: "dm" | "group" | "channel";
	id: string;
}

export interface RoutingInfo {
	channel: string;
	accountId?: string;
	guildId?: string;
	teamId?: string;
	peer?: RoutingPeer;
	threadId?: string;
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
	sessionId?: string; // Optional session context for session-aware workflows
	agentName?: string; // Agent name for session tracking
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
	requireAuth?: boolean;
	auth?: GatewayAuthConfig;
	stateDir?: string;
	workspace?: string;
	configDir?: string;
	fsRoots?: string[];
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

export interface GatewayAuthConfig {
	mode: "token" | "password" | "none";
	token?: string;
	password?: string;
	allowTailscale?: boolean;
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
	activeSessions?: number; // Count of nodes with active sessions
	sessionNodes?: Array<{ // Nodes grouped by session
		sessionId: string;
		agentName?: string;
		nodeIds: string[];
	}>;
}

/**
 * Registration request payload
 */
export interface RegisterPayload {
	name: string;
	capabilities?: string[];
	token?: string;
	sessionId?: string; // Optional session ID for session-aware workflows
	agentName?: string; // Agent name for session tracking
	metadata?: Record<string, unknown>; // Additional session/agent metadata
}

export interface SessionSubscriptionPayload {
	sessionId: string;
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
