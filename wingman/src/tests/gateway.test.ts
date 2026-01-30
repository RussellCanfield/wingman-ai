import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GatewayServer, GatewayClient } from "../gateway/index.js";

const isBun = typeof (globalThis as any).Bun !== "undefined";
const describeIfBun = isBun ? describe : describe.skip;

describeIfBun("Gateway", () => {
	let server: GatewayServer;
	let port = 0;

	beforeAll(async () => {
		const startPort = 23000;
		const attempts = 50;
		let lastError: unknown = null;
		for (let i = 0; i < attempts; i += 1) {
			const candidate = startPort + i;
			try {
				const instance = new GatewayServer({
					port: candidate,
					host: "localhost",
					requireAuth: false,
					logLevel: "silent",
				});
				await instance.start();
				server = instance;
				port = candidate;
				lastError = null;
				break;
			} catch (error) {
				lastError = error;
			}
		}

		if (!server || !port) {
			throw lastError ?? new Error("Unable to start gateway server for tests");
		}
		// Wait for server to be ready
		await new Promise((resolve) => setTimeout(resolve, 500));
	});

	afterAll(async () => {
		if (server) {
			await server.stop();
		}
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
