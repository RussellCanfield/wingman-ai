/**
 * Cloudflare Worker for Wingman Gateway
 * 
 * This worker provides a WebSocket gateway for AI agent swarming on Cloudflare's edge network.
 * It uses Durable Objects to maintain state across connections.
 */

import type {
	GatewayMessage,
	RegisterPayload,
	JoinGroupPayload,
	BroadcastPayload,
	DirectPayload,
	ErrorPayload,
} from "../src/gateway/types";

/**
 * Durable Object for managing gateway state
 */
export class GatewayState {
	private state: DurableObjectState;
	private nodes: Map<string, WebSocket>;
	private nodeMetadata: Map<string, any>;
	private groups: Map<string, Set<string>>;
	private messagesProcessed: number;
	private startedAt: number;

	constructor(state: DurableObjectState) {
		this.state = state;
		this.nodes = new Map();
		this.nodeMetadata = new Map();
		this.groups = new Map();
		this.messagesProcessed = 0;
		this.startedAt = Date.now();
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// Health check
		if (url.pathname === "/health") {
			return this.handleHealthCheck();
		}

		// Stats endpoint
		if (url.pathname === "/stats") {
			return this.handleStats();
		}

		// WebSocket upgrade
		if (url.pathname === "/ws") {
			const upgradeHeader = request.headers.get("Upgrade");
			if (upgradeHeader !== "websocket") {
				return new Response("Expected WebSocket", { status: 426 });
			}

			const pair = new WebSocketPair();
			const [client, server] = Object.values(pair);

			this.handleWebSocket(server);

			return new Response(null, {
				status: 101,
				webSocket: client,
			});
		}

		return new Response("Not Found", { status: 404 });
	}

	private handleWebSocket(ws: WebSocket): void {
		ws.accept();

		let nodeId: string | null = null;

		ws.addEventListener("message", async (event) => {
			try {
				const msg: GatewayMessage = JSON.parse(event.data as string);
				this.messagesProcessed++;

				switch (msg.type) {
					case "register":
						nodeId = await this.handleRegister(ws, msg);
						break;
					case "unregister":
						if (nodeId) {
							this.handleUnregister(nodeId);
						}
						break;
					case "join_group":
						if (nodeId) {
							this.handleJoinGroup(ws, nodeId, msg);
						}
						break;
					case "leave_group":
						if (nodeId && msg.groupId) {
							this.handleLeaveGroup(nodeId, msg.groupId);
						}
						break;
					case "broadcast":
						if (nodeId) {
							this.handleBroadcast(nodeId, msg);
						}
						break;
					case "direct":
						if (nodeId) {
							this.handleDirect(nodeId, msg);
						}
						break;
					case "ping":
						this.handlePing(ws);
						break;
				}
			} catch (error) {
				this.sendError(ws, "INVALID_MESSAGE", "Invalid message format");
			}
		});

		ws.addEventListener("close", () => {
			if (nodeId) {
				this.handleUnregister(nodeId);
			}
		});
	}

	private async handleRegister(
		ws: WebSocket,
		msg: GatewayMessage,
	): Promise<string> {
		const payload = msg.payload as RegisterPayload;
		const nodeId = crypto.randomUUID();

		this.nodes.set(nodeId, ws);
		this.nodeMetadata.set(nodeId, {
			id: nodeId,
			name: payload.name,
			capabilities: payload.capabilities,
			groups: new Set<string>(),
			connectedAt: Date.now(),
		});

		this.sendMessage(ws, {
			type: "ack",
			nodeId,
			payload: {
				nodeId,
				name: payload.name,
			},
			timestamp: Date.now(),
		});

		return nodeId;
	}

	private handleUnregister(nodeId: string): void {
		const metadata = this.nodeMetadata.get(nodeId);
		if (metadata) {
			// Remove from all groups
			for (const groupId of metadata.groups) {
				const group = this.groups.get(groupId);
				if (group) {
					group.delete(nodeId);
				}
			}
		}

		this.nodes.delete(nodeId);
		this.nodeMetadata.delete(nodeId);
	}

	private handleJoinGroup(
		ws: WebSocket,
		nodeId: string,
		msg: GatewayMessage,
	): void {
		const payload = msg.payload as JoinGroupPayload;
		let groupId: string;
		let groupName: string;

		if (payload.groupId) {
			groupId = payload.groupId;
			groupName = payload.groupName || groupId;
		} else if (payload.groupName) {
			groupName = payload.groupName;
			// Find or create group
			groupId = this.findOrCreateGroup(groupName);
		} else {
			this.sendError(ws, "INVALID_REQUEST", "Group ID or name required");
			return;
		}

		// Add node to group
		let group = this.groups.get(groupId);
		if (!group) {
			group = new Set();
			this.groups.set(groupId, group);
		}
		group.add(nodeId);

		// Update node metadata
		const metadata = this.nodeMetadata.get(nodeId);
		if (metadata) {
			metadata.groups.add(groupId);
		}

		this.sendMessage(ws, {
			type: "ack",
			nodeId,
			groupId,
			payload: {
				groupId,
				groupName,
			},
			timestamp: Date.now(),
		});
	}

	private handleLeaveGroup(nodeId: string, groupId: string): void {
		const group = this.groups.get(groupId);
		if (group) {
			group.delete(nodeId);
		}

		const metadata = this.nodeMetadata.get(nodeId);
		if (metadata) {
			metadata.groups.delete(groupId);
		}
	}

	private handleBroadcast(nodeId: string, msg: GatewayMessage): void {
		const payload = msg.payload as BroadcastPayload;
		const group = this.groups.get(payload.groupId);

		if (!group) {
			return;
		}

		const broadcastMsg: GatewayMessage = {
			type: "broadcast",
			nodeId,
			groupId: payload.groupId,
			payload: payload.message,
			timestamp: Date.now(),
		};

		for (const memberId of group) {
			if (memberId !== nodeId) {
				const memberWs = this.nodes.get(memberId);
				if (memberWs) {
					this.sendMessage(memberWs, broadcastMsg);
				}
			}
		}
	}

	private handleDirect(nodeId: string, msg: GatewayMessage): void {
		const payload = msg.payload as DirectPayload;
		const targetWs = this.nodes.get(payload.targetNodeId);

		if (!targetWs) {
			return;
		}

		const directMsg: GatewayMessage = {
			type: "direct",
			nodeId,
			targetNodeId: payload.targetNodeId,
			payload: payload.message,
			timestamp: Date.now(),
		};

		this.sendMessage(targetWs, directMsg);
	}

	private handlePing(ws: WebSocket): void {
		this.sendMessage(ws, {
			type: "pong",
			timestamp: Date.now(),
		});
	}

	private findOrCreateGroup(name: string): string {
		// Simple implementation: use name as ID
		// In production, you might want a more sophisticated approach
		return name;
	}

	private sendMessage(ws: WebSocket, message: GatewayMessage): void {
		try {
			ws.send(JSON.stringify(message));
		} catch (error) {
			console.error("Failed to send message:", error);
		}
	}

	private sendError(ws: WebSocket, code: string, message: string): void {
		const errorPayload: ErrorPayload = {
			code,
			message,
		};

		this.sendMessage(ws, {
			type: "error",
			payload: errorPayload,
			timestamp: Date.now(),
		});
	}

	private handleHealthCheck(): Response {
		const health = {
			status: "healthy",
			version: "1.0.0",
			stats: {
				uptime: Date.now() - this.startedAt,
				totalNodes: this.nodes.size,
				totalGroups: this.groups.size,
				messagesProcessed: this.messagesProcessed,
				startedAt: this.startedAt,
			},
			timestamp: Date.now(),
		};

		return new Response(JSON.stringify(health, null, 2), {
			headers: { "Content-Type": "application/json" },
		});
	}

	private handleStats(): Response {
		const stats = {
			nodes: this.nodes.size,
			groups: this.groups.size,
			messagesProcessed: this.messagesProcessed,
			uptime: Date.now() - this.startedAt,
		};

		return new Response(JSON.stringify(stats, null, 2), {
			headers: { "Content-Type": "application/json" },
		});
	}
}

/**
 * Worker entry point
 */
export default {
	async fetch(
		request: Request,
		env: { GATEWAY_STATE: DurableObjectNamespace },
	): Promise<Response> {
		// Get or create the Durable Object
		const id = env.GATEWAY_STATE.idFromName("global");
		const stub = env.GATEWAY_STATE.get(id);

		// Forward the request to the Durable Object
		return stub.fetch(request);
	},
};
