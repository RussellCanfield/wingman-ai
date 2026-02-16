import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GatewayServer } from "../gateway/server.js";

const isBun = typeof (globalThis as any).Bun !== "undefined";
const describeIfBun = isBun ? describe : describe.skip;

describeIfBun("Gateway node enablement", () => {
	let server: GatewayServer;
	let port = 0;
	let workspace: string;

	beforeAll(async () => {
		workspace = mkdtempSync(join(tmpdir(), "wingman-gateway-node-mode-"));
		server = new GatewayServer({
			port: 0,
			host: "localhost",
			requireAuth: false,
			auth: { mode: "none" },
			logLevel: "silent",
			workspace,
			configDir: ".wingman-node-test-config",
			stateDir: ".wingman-node-test-state",
		});
		await server.start();
		port = server.getPort();
		if (!port) {
			throw new Error("Unable to determine gateway port");
		}
	});

	afterAll(async () => {
		await server.stop();
		rmSync(workspace, { recursive: true, force: true });
	});

	const connectClient = (instanceId: string, clientType = "desktop") =>
		new Promise<WebSocket>((resolve, reject) => {
			const ws = new WebSocket(`ws://localhost:${port}/ws`);
			const connectId = `connect-${instanceId}-${Date.now()}`;
			const timeout = setTimeout(
				() => reject(new Error("Connect timeout")),
				5000,
			);

			ws.addEventListener("open", () => {
				ws.send(
					JSON.stringify({
						type: "connect",
						id: connectId,
						client: { instanceId, clientType, version: "test" },
						timestamp: Date.now(),
					}),
				);
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
			const handler = (event: MessageEvent) => {
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

	it("blocks node registration before device enablement", async () => {
		const ws = await connectClient("desktop-node-blocked");
		ws.send(
			JSON.stringify({
				type: "register",
				payload: { name: "Blocked Node", capabilities: ["system.notify"] },
				timestamp: Date.now(),
			}),
		);

		const errorMessage = await waitForMessage(
			ws,
			(msg) => msg.type === "error" && msg.payload?.code === "NODE_NOT_ENABLED",
		);
		expect(errorMessage.payload?.message).toContain("not approved");
		ws.close();
	});

	it("allows enabled devices to register, execute, and revoke", async () => {
		const enableResponse = await fetch(
			`http://localhost:${port}/api/nodes/${encodeURIComponent("desktop-node-enabled")}`,
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					enabled: true,
					name: "Enabled Desktop",
				}),
			},
		);
		expect(enableResponse.ok).toBe(true);

		const nodeWs = await connectClient("desktop-node-enabled");
		nodeWs.send(
			JSON.stringify({
				type: "register",
				payload: { name: "Enabled Desktop", capabilities: ["system.notify"] },
				timestamp: Date.now(),
			}),
		);

		const registrationAck = await waitForMessage(
			nodeWs,
			(msg) => msg.type === "ack" && typeof msg.payload?.nodeId === "string",
		);
		const nodeId = registrationAck.payload.nodeId as string;
		expect(nodeId).toBeTruthy();

		const requesterWs = await connectClient("desktop-requester");
		requesterWs.send(
			JSON.stringify({
				type: "req:node",
				id: "node-req-1",
				targetNodeId: nodeId,
				payload: {
					tool: "system.notify",
					args: { title: "Hello", body: "Node test" },
				},
				timestamp: Date.now(),
			}),
		);

		const forwardedToNode = await waitForMessage(
			nodeWs,
			(msg) => msg.type === "req:node" && msg.id === "node-req-1",
		);
		expect(forwardedToNode.targetNodeId).toBe(nodeId);

		nodeWs.send(
			JSON.stringify({
				type: "res",
				id: "node-req-1",
				ok: true,
				payload: { delivered: true },
				timestamp: Date.now(),
			}),
		);

		const returnedToRequester = await waitForMessage(
			requesterWs,
			(msg) => msg.type === "res" && msg.id === "node-req-1",
		);
		expect(returnedToRequester.ok).toBe(true);
		expect(returnedToRequester.nodeId).toBe(nodeId);

		const closePromise = new Promise<void>((resolve) => {
			nodeWs.addEventListener(
				"close",
				() => {
					resolve();
				},
				{ once: true },
			);
		});

		const revokeResponse = await fetch(
			`http://localhost:${port}/api/nodes/${encodeURIComponent("desktop-node-enabled")}`,
			{
				method: "DELETE",
			},
		);
		expect(revokeResponse.ok).toBe(true);
		await closePromise;

		requesterWs.close();
		nodeWs.close();
	});
});
