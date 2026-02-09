import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { GatewayServer, GatewayClient } from "../gateway/index.js";

const isBun = typeof (globalThis as any).Bun !== "undefined";
const describeIfBun = isBun ? describe : describe.skip;

vi.mock("@/cli/core/agentInvoker.js", () => ({
	AgentInvoker: class {
		private outputManager: any;
		constructor(options: { outputManager?: any }) {
			this.outputManager = options?.outputManager;
		}
		async invokeAgent(
			_agentId: string,
			_content: string,
			_sessionId?: string,
			_attachments?: any[],
			options?: { signal?: AbortSignal },
		) {
			const signal = options?.signal;
			await new Promise<void>((resolve) => {
				const timer = setTimeout(resolve, 75);
				if (signal) {
					const onAbort = () => {
						clearTimeout(timer);
						resolve();
					};
					if (signal.aborted) {
						onAbort();
						return;
					}
					signal.addEventListener("abort", onAbort, { once: true });
				}
			});
			if (signal?.aborted) {
				this.outputManager?.emitAgentError?.("Request cancelled");
				return { cancelled: true };
			}
			this.outputManager?.emitAgentComplete?.({ streaming: true });
			return { streaming: true };
		}
	},
}));

describeIfBun("Gateway", () => {
	let server: GatewayServer;
	let port = 0;

	beforeAll(async () => {
		const instance = new GatewayServer({
			port: 0,
			host: "localhost",
			requireAuth: false,
			auth: { mode: "none" },
			logLevel: "silent",
		});
		await instance.start();
		server = instance;
		port = server.getPort();
		if (!port) {
			throw new Error("Unable to determine gateway server port");
		}
		// Wait for server to be ready
		await new Promise((resolve) => setTimeout(resolve, 500));
	});

	afterAll(async () => {
		if (server) {
			await server.stop();
		}
	});

	const connectClient = (instanceId: string, clientType = "test") =>
		new Promise<WebSocket>((resolve, reject) => {
			const ws = new WebSocket(`ws://localhost:${port}/ws`);
			const connectId = `connect-${instanceId}-${Date.now()}`;
			const timeout = setTimeout(
				() => reject(new Error("Connect timeout")),
				5000,
			);

			ws.addEventListener("open", () => {
				const message = {
					type: "connect",
					id: connectId,
					client: { instanceId, clientType },
					timestamp: Date.now(),
				};
				ws.send(JSON.stringify(message));
			});

			ws.addEventListener("message", (event) => {
				const msg = JSON.parse(event.data as string) as {
					type?: string;
					id?: string;
					ok?: boolean;
				};
				if (msg.type === "res" && msg.id === connectId && msg.ok) {
					clearTimeout(timeout);
					resolve(ws);
				}
			});

			ws.addEventListener("error", () => {
				clearTimeout(timeout);
				reject(new Error("WebSocket error"));
			});
		});

	const waitForMessage = (
		ws: WebSocket,
		predicate: (msg: any) => boolean,
		timeoutMs = 5000,
	) =>
		new Promise<any>((resolve, reject) => {
			const timeout = setTimeout(
				() => reject(new Error("Message timeout")),
				timeoutMs,
			);
			const handler = (event: any) => {
				let msg: any;
				try {
					msg = JSON.parse(event.data as string);
				} catch {
					return;
				}
				if (!predicate(msg)) return;
				clearTimeout(timeout);
				ws.removeEventListener("message", handler);
				resolve(msg);
			};
			ws.addEventListener("message", handler);
		});

	it("should start the gateway server", async () => {
		const response = await fetch(`http://localhost:${port}/health`);
		expect(response.ok).toBe(true);

		const health = await response.json() as { status: string };
		expect(health.status).toBe("healthy");
	});

	it("should connect a client", async () => {
		return new Promise<void>((resolve, reject) => {
			const client = new GatewayClient(
				`ws://localhost:${port}/ws`,
				"test-client",
				{
					events: {
						connected: () => {
							client.disconnect();
							resolve();
						},
						error: (error) => {
							reject(new Error(error.message));
						},
					},
				},
			);

			client.connect().catch(reject);

			// Timeout after 5 seconds
			setTimeout(() => reject(new Error("Connection timeout")), 5000);
		});
	});

	it("should register a client and receive node ID", async () => {
		return new Promise<void>((resolve, reject) => {
			const client = new GatewayClient(
				`ws://localhost:${port}/ws`,
				"test-client-2",
				{
					events: {
						registered: (nodeId, name) => {
							expect(nodeId).toBeTruthy();
							expect(name).toBe("test-client-2");
							client.disconnect();
							resolve();
						},
						error: (error) => {
							reject(new Error(error.message));
						},
					},
				},
			);

			client.connect().catch(reject);

			setTimeout(() => reject(new Error("Registration timeout")), 5000);
		});
	});

	it("should join a broadcast group", async () => {
		return new Promise<void>((resolve, reject) => {
			const client = new GatewayClient(
				`ws://localhost:${port}/ws`,
				"test-client-3",
				{
					events: {
						registered: async () => {
							await client.joinGroup("test-group");
						},
						joinedGroup: (groupId, groupName) => {
							expect(groupName).toBe("test-group");
							client.disconnect();
							resolve();
						},
						error: (error) => {
							reject(new Error(error.message));
						},
					},
				},
			);

			client.connect().catch(reject);

			setTimeout(() => reject(new Error("Join group timeout")), 5000);
		});
	});

	it("should broadcast messages to group members", async () => {
		return new Promise<void>((resolve, reject) => {
			let client1NodeId: string | null = null;
			let messagesReceived = 0;

			const client1 = new GatewayClient(
				`ws://localhost:${port}/ws`,
				"broadcaster",
				{
					events: {
						registered: async (nodeId) => {
							client1NodeId = nodeId;
							await client1.joinGroup("broadcast-test");
						},
						joinedGroup: () => {
							// Client 1 joined, now connect client 2
							client2.connect().catch(reject);
						},
					},
				},
			);

			const client2 = new GatewayClient(
				`ws://localhost:${port}/ws`,
				"receiver",
				{
					events: {
						registered: async () => {
							await client2.joinGroup("broadcast-test");
						},
						joinedGroup: () => {
							// Both clients in group, send broadcast
							client1.broadcast("broadcast-test", {
								message: "Hello from client 1",
							});
						},
						broadcast: (message: any, fromNodeId) => {
							expect(fromNodeId).toBe(client1NodeId);
							expect(message.message).toBe("Hello from client 1");
							messagesReceived++;

							// Cleanup
							client1.disconnect();
							client2.disconnect();
							resolve();
						},
						error: (error) => {
							reject(new Error(error.message));
						},
					},
				},
			);

			client1.connect().catch(reject);

			setTimeout(
				() => reject(new Error("Broadcast test timeout")),
				10000,
			);
		});
	});

	it("should handle ping/pong", async () => {
		return new Promise<void>((resolve, reject) => {
			const client = new GatewayClient(
				`ws://localhost:${port}/ws`,
				"ping-test",
				{
					events: {
						registered: () => {
							client.ping();
						},
						pong: () => {
							client.disconnect();
							resolve();
						},
						error: (error) => {
							reject(new Error(error.message));
						},
					},
				},
			);

			client.connect().catch(reject);

			setTimeout(() => reject(new Error("Ping/pong timeout")), 5000);
		});
	});

	it("should stream agent events to session subscribers", async () => {
		const subscriber = await connectClient("session-subscriber");
		const sessionId = "session-test";

		subscriber.send(
			JSON.stringify({
				type: "session_subscribe",
				payload: { sessionId },
				timestamp: Date.now(),
			}),
		);

		await waitForMessage(
			subscriber,
			(msg) =>
				msg.type === "ack" &&
				msg.payload?.action === "session_subscribe" &&
				msg.payload?.sessionId === sessionId,
		);

		const eventPromise = waitForMessage(
			subscriber,
			(msg) => msg.type === "event:agent" && msg.id === "req-session",
		);

		const sent = (server as any).broadcastSessionEvent(sessionId, {
			type: "event:agent",
			id: "req-session",
			payload: {
				type: "agent-stream",
				sessionId,
				agentId: "main",
				chunk: { content: "hello" },
			},
			timestamp: Date.now(),
		});

		expect(sent).toBe(1);

		const eventMsg = await eventPromise;
		expect(eventMsg.payload?.sessionId).toBe(sessionId);

		subscriber.close();
	});

	it("should broadcast user messages to session subscribers", async () => {
		const subscriber = await connectClient("session-input-subscriber");
		const requester = await connectClient("session-input-requester");
		const sessionId = "session-input-test";

		subscriber.send(
			JSON.stringify({
				type: "session_subscribe",
				payload: { sessionId },
				timestamp: Date.now(),
			}),
		);

		await waitForMessage(
			subscriber,
			(msg) =>
				msg.type === "ack" &&
				msg.payload?.action === "session_subscribe" &&
				msg.payload?.sessionId === sessionId,
		);

		const eventPromise = waitForMessage(
			subscriber,
			(msg) =>
				msg.type === "event:agent" &&
				msg.payload?.type === "session-message" &&
				msg.payload?.role === "user",
		);

		requester.send(
			JSON.stringify({
				type: "req:agent",
				id: "req-session-input",
				payload: {
					agentId: "main",
					sessionKey: sessionId,
					content: "Hello from test",
				},
				timestamp: Date.now(),
			}),
		);

		const eventMsg = await eventPromise;
		expect(eventMsg.payload?.content).toBe("Hello from test");
		expect(eventMsg.payload?.sessionId).toBe(sessionId);
		expect(eventMsg.payload?.agentId).toBe("main");

		subscriber.close();
		requester.close();
	});

	it("should broadcast user messages to webui clients without session subscribe", async () => {
		const webuiClient = await connectClient("session-webui-listener", "webui");
		const requester = await connectClient("session-webui-requester");
		const sessionId = "session-webui-test";

		const eventPromise = waitForMessage(
			webuiClient,
			(msg) =>
				msg.type === "event:agent" &&
				msg.payload?.type === "session-message" &&
				msg.payload?.role === "user" &&
				msg.payload?.sessionId === sessionId,
		);

		requester.send(
			JSON.stringify({
				type: "req:agent",
				id: "req-session-webui",
				payload: {
					agentId: "main",
					sessionKey: sessionId,
					content: "Hello webui",
				},
				timestamp: Date.now(),
			}),
		);

		const eventMsg = await eventPromise;
		expect(eventMsg.payload?.content).toBe("Hello webui");
		expect(eventMsg.payload?.agentId).toBe("main");

		webuiClient.close();
		requester.close();
	});

	it("should broadcast user messages to desktop clients without session subscribe", async () => {
		const desktopClient = await connectClient("session-desktop-listener", "desktop");
		const requester = await connectClient("session-desktop-requester");
		const sessionId = "session-desktop-test";

		const eventPromise = waitForMessage(
			desktopClient,
			(msg) =>
				msg.type === "event:agent" &&
				msg.payload?.type === "session-message" &&
				msg.payload?.role === "user" &&
				msg.payload?.sessionId === sessionId,
		);

		requester.send(
			JSON.stringify({
				type: "req:agent",
				id: "req-session-desktop",
				payload: {
					agentId: "main",
					sessionKey: sessionId,
					content: "Hello desktop",
				},
				timestamp: Date.now(),
			}),
		);

		const eventMsg = await eventPromise;
		expect(eventMsg.payload?.content).toBe("Hello desktop");
		expect(eventMsg.payload?.agentId).toBe("main");

		desktopClient.close();
		requester.close();
	});

	it("should cancel an in-flight agent request", async () => {
		const requester = await connectClient("session-cancel-requester");
		const requestId = "req-cancel-test";

		requester.send(
			JSON.stringify({
				type: "req:agent",
				id: requestId,
				payload: {
					agentId: "main",
					sessionKey: "session-cancel-test",
					content: "cancel me",
				},
				timestamp: Date.now(),
			}),
		);

		requester.send(
			JSON.stringify({
				type: "req:agent:cancel",
				id: "cancel-req-cancel-test",
				payload: { requestId },
				timestamp: Date.now(),
			}),
		);

		const ack = await waitForMessage(
			requester,
			(msg) =>
				msg.type === "ack" &&
				msg.payload?.action === "req:agent:cancel" &&
				msg.payload?.requestId === requestId,
		);
		expect(["cancelled", "not_found"]).toContain(ack.payload?.status);

		requester.close();
	});

	it("should clear session messages via API", async () => {
		const createRes = await fetch(`http://localhost:${port}/api/sessions`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ agentId: "main", name: "Clear Test" }),
		});
		expect(createRes.ok).toBe(true);
		const session = (await createRes.json()) as { id: string };

		const manager = await (server as any).getSessionManager("main");
		manager.updateSession(session.id, {
			messageCount: 3,
			lastMessagePreview: "Hello",
		});

		const clearRes = await fetch(
			`http://localhost:${port}/api/sessions/${encodeURIComponent(session.id)}/messages?agentId=main`,
			{ method: "DELETE" },
		);
		expect(clearRes.ok).toBe(true);
		const cleared = (await clearRes.json()) as { messageCount: number };
		expect(cleared.messageCount).toBe(0);

		const updated = manager.getSession(session.id);
		expect(updated?.messageCount).toBe(0);
		expect(updated?.lastMessagePreview).toBeNull();
	});
});
