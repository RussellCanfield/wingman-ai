import type { ServerWebSocket } from "bun";
import type { Node, NodeMetadata, GatewayMessage } from "./types.js";
import { randomBytes } from "crypto";
import { createLogger } from "@/logger.js";

const logger = createLogger();

/**
 * Manages connected nodes in the gateway
 */
export class NodeManager {
	private nodes: Map<string, Node>;
	private maxNodes: number;
	private messageRateLimit: number; // Messages per minute
	private messageWindow: number; // Time window in ms

	constructor(
		maxNodes = 1000,
		messageRateLimit = 100,
		messageWindow = 60000,
	) {
		this.nodes = new Map();
		this.maxNodes = maxNodes;
		this.messageRateLimit = messageRateLimit;
		this.messageWindow = messageWindow;
	}

	/**
	 * Register a new node
	 */
	registerNode(
		ws: ServerWebSocket<{ nodeId: string }>,
		name: string,
		capabilities?: string[],
		sessionId?: string,
		agentName?: string,
	): Node | null {
		// Check if we've reached max nodes
		if (this.nodes.size >= this.maxNodes) {
			return null;
		}

		const id = this.generateNodeId();
		const node: Node = {
			id,
			name,
			capabilities,
			groups: new Set(),
			connectedAt: Date.now(),
			ws,
			sessionId,
			agentName,
		};

		// Set the nodeId in the WebSocket data
		ws.data = { nodeId: id };

		this.nodes.set(id, node);
		return node;
	}

	/**
	 * Unregister a node
	 */
	unregisterNode(nodeId: string): boolean {
		const node = this.nodes.get(nodeId);
		if (!node) {
			return false;
		}

		// Close the WebSocket connection
		try {
			node.ws.close();
		} catch (error) {
			// Ignore errors if already closed
		}

		return this.nodes.delete(nodeId);
	}

	/**
	 * Get a node by ID
	 */
	getNode(nodeId: string): Node | undefined {
		return this.nodes.get(nodeId);
	}

	/**
	 * Get all nodes
	 */
	getAllNodes(): Node[] {
		return Array.from(this.nodes.values());
	}

	/**
	 * Get node metadata (without WebSocket)
	 */
	getNodeMetadata(nodeId: string): NodeMetadata | undefined {
		const node = this.nodes.get(nodeId);
		if (!node) {
			return undefined;
		}

		return {
			id: node.id,
			name: node.name,
			capabilities: node.capabilities,
			groups: node.groups,
			connectedAt: node.connectedAt,
			lastPing: node.lastPing,
			sessionId: node.sessionId,
			agentName: node.agentName,
		};
	}

	/**
	 * Update node's last ping time
	 */
	updatePing(nodeId: string): void {
		const node = this.nodes.get(nodeId);
		if (node) {
			node.lastPing = Date.now();
		}
	}

	/**
	 * Check if node is rate limited
	 */
	isRateLimited(nodeId: string): boolean {
		const node = this.nodes.get(nodeId);
		if (!node) {
			return false;
		}

		const now = Date.now();
		const messageCount = node.messageCount || 0;
		const lastMessageTime = node.lastMessageTime || 0;

		// Reset counter if outside time window
		if (now - lastMessageTime > this.messageWindow) {
			node.messageCount = 0;
			return false;
		}

		// Check if exceeded rate limit
		return messageCount >= this.messageRateLimit;
	}

	/**
	 * Record a message from a node
	 */
	recordMessage(nodeId: string): void {
		const node = this.nodes.get(nodeId);
		if (!node) {
			return;
		}

		const now = Date.now();
		const lastMessageTime = node.lastMessageTime || 0;

		// Reset counter if outside time window
		if (now - lastMessageTime > this.messageWindow) {
			node.messageCount = 1;
		} else {
			node.messageCount = (node.messageCount || 0) + 1;
		}

		node.lastMessageTime = now;
	}

	/**
	 * Add a node to a group
	 */
	addNodeToGroup(nodeId: string, groupId: string): boolean {
		const node = this.nodes.get(nodeId);
		if (!node) {
			return false;
		}

		node.groups.add(groupId);
		return true;
	}

	/**
	 * Remove a node from a group
	 */
	removeNodeFromGroup(nodeId: string, groupId: string): boolean {
		const node = this.nodes.get(nodeId);
		if (!node) {
			return false;
		}

		return node.groups.delete(groupId);
	}

	/**
	 * Send a message to a specific node
	 */
	sendToNode(nodeId: string, message: GatewayMessage): boolean {
		const node = this.nodes.get(nodeId);
		if (!node) {
			return false;
		}

		try {
			node.ws.send(JSON.stringify(message));
			return true;
		} catch (error) {
			logger.error(`Failed to send message to node ${nodeId}`, error);
			return false;
		}
	}

	/**
	 * Broadcast a message to multiple nodes
	 */
	broadcastToNodes(nodeIds: string[], message: GatewayMessage): number {
		let successCount = 0;
		for (const nodeId of nodeIds) {
			if (this.sendToNode(nodeId, message)) {
				successCount++;
			}
		}
		return successCount;
	}

	/**
	 * Broadcast a message to all nodes
	 */
	broadcastToAll(message: GatewayMessage): number {
		const nodeIds = Array.from(this.nodes.keys());
		return this.broadcastToNodes(nodeIds, message);
	}

	/**
	 * Get nodes by group
	 */
	getNodesByGroup(groupId: string): Node[] {
		const nodes: Node[] = [];
		for (const node of this.nodes.values()) {
			if (node.groups.has(groupId)) {
				nodes.push(node);
			}
		}
		return nodes;
	}

	/**
	 * Check for stale nodes (no ping in timeout period)
	 */
	getStaleNodes(timeoutMs: number): Node[] {
		const now = Date.now();
		const staleNodes: Node[] = [];

		for (const node of this.nodes.values()) {
			if (node.lastPing && now - node.lastPing > timeoutMs) {
				staleNodes.push(node);
			}
		}

		return staleNodes;
	}

	/**
	 * Remove stale nodes
	 */
	removeStaleNodes(timeoutMs: number): number {
		const staleNodes = this.getStaleNodes(timeoutMs);
		let removed = 0;

		for (const node of staleNodes) {
			if (this.unregisterNode(node.id)) {
				removed++;
			}
		}

		return removed;
	}

	/**
	 * Generate a unique node ID
	 */
	private generateNodeId(): string {
		return randomBytes(16).toString("hex");
	}

	/**
	 * Get nodes by session ID
	 */
	getNodesBySession(sessionId: string): Node[] {
		const nodes: Node[] = [];
		for (const node of this.nodes.values()) {
			if (node.sessionId === sessionId) {
				nodes.push(node);
			}
		}
		return nodes;
	}

	/**
	 * Get all active sessions with their nodes
	 */
	getSessionNodes(): Map<string, Node[]> {
		const sessionMap = new Map<string, Node[]>();

		for (const node of this.nodes.values()) {
			if (node.sessionId) {
				if (!sessionMap.has(node.sessionId)) {
					sessionMap.set(node.sessionId, []);
				}
				sessionMap.get(node.sessionId)!.push(node);
			}
		}

		return sessionMap;
	}

	/**
	 * Get statistics
	 */
	getStats() {
		const sessionMap = this.getSessionNodes();

		return {
			totalNodes: this.nodes.size,
			maxNodes: this.maxNodes,
			activeSessions: sessionMap.size,
			sessionNodes: Array.from(sessionMap.entries()).map(([sessionId, nodes]) => ({
				sessionId,
				agentName: nodes[0]?.agentName,
				nodeIds: nodes.map(n => n.id),
			})),
			nodes: Array.from(this.nodes.values()).map((n) => ({
				id: n.id,
				name: n.name,
				groupCount: n.groups.size,
				connectedAt: n.connectedAt,
				lastPing: n.lastPing,
				sessionId: n.sessionId,
				agentName: n.agentName,
			})),
		};
	}
}
