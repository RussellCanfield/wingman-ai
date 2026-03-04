import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { GatewayServer } from "@/gateway/server.js";

type GatewayInternals = {
	handleUiRequest: (req: Request) => Promise<Response>;
	requireHttpAuth: (req: Request) => Response | null;
	handleBridgeSend: (req: Request) => Promise<Response>;
	handleRegister: (ws: TestGatewaySocket, msg: Record<string, unknown>) => void;
	handleNodeRequest: (
		ws: TestGatewaySocket,
		msg: Record<string, unknown>,
	) => void;
};

const tempWorkspaces: string[] = [];

type TestGatewaySocket = {
	data: {
		nodeId?: string;
		clientId?: string;
		clientType?: string;
		authenticated?: boolean;
		tailscaleUser?: string;
	};
	send: (message: string) => number;
	close: () => void;
};

function createGateway(
	config: ConstructorParameters<typeof GatewayServer>[0],
): GatewayServer {
	const workspace = mkdtempSync(
		join(tmpdir(), "wingman-gateway-http-security-"),
	);
	tempWorkspaces.push(workspace);
	return new GatewayServer({
		logLevel: "silent",
		workspace,
		configDir: ".wingman-http-security-config",
		stateDir: ".wingman-http-security-state",
		...config,
	});
}

function getGatewayInternals(server: GatewayServer): GatewayInternals {
	return server as unknown as GatewayInternals;
}

function createTestSocket(initialData?: TestGatewaySocket["data"]): {
	ws: TestGatewaySocket;
	messages: Array<Record<string, unknown>>;
} {
	const messages: Array<Record<string, unknown>> = [];
	const ws: TestGatewaySocket = {
		data: { ...(initialData || {}) },
		send: (serialized) => {
			messages.push(JSON.parse(serialized) as Record<string, unknown>);
			return 1;
		},
		close: () => {},
	};
	return { ws, messages };
}

afterAll(() => {
	for (const workspace of tempWorkspaces) {
		rmSync(workspace, { recursive: true, force: true });
	}
});

describe("gateway HTTP security", () => {
	it("requires auth for /api routes when token auth is enabled", async () => {
		const server = createGateway({
			host: "127.0.0.1",
			port: 18789,
			auth: { mode: "token", token: "test-token" },
			requireAuth: true,
		});
		const internals = getGatewayInternals(server);

		const unauthenticated = await internals.handleUiRequest(
			new Request("http://127.0.0.1:18789/api/providers"),
		);
		expect(unauthenticated.status).toBe(401);

		const authenticated = await internals.handleUiRequest(
			new Request("http://127.0.0.1:18789/api/providers", {
				headers: {
					Authorization: "Bearer test-token",
				},
			}),
		);
		expect(authenticated.status).toBe(200);
	});

	it("returns summarization settings from /api/config without auth", async () => {
		const server = createGateway({
			host: "127.0.0.1",
			port: 18789,
			auth: { mode: "token", token: "test-token" },
			requireAuth: true,
		});
		const internals = getGatewayInternals(server);

		const response = await internals.handleUiRequest(
			new Request("http://127.0.0.1:18789/api/config"),
		);
		expect(response.status).toBe(200);
		const payload = (await response.json()) as {
			summarization?: {
				enabled?: boolean;
				maxTokensBeforeSummary?: number;
				messagesToKeep?: number;
			};
		};
		expect(payload.summarization).toMatchObject({
			enabled: true,
			maxTokensBeforeSummary: 12000,
			messagesToKeep: 8,
		});
	});

	it("rejects disallowed origins and allows loopback development preflight", async () => {
		const server = createGateway({
			host: "127.0.0.1",
			port: 18789,
			auth: { mode: "token", token: "test-token" },
			requireAuth: true,
		});
		const internals = getGatewayInternals(server);

		const denied = await internals.handleUiRequest(
			new Request("http://127.0.0.1:18789/api/providers", {
				method: "OPTIONS",
				headers: {
					Origin: "https://evil.example",
					"Access-Control-Request-Method": "GET",
				},
			}),
		);
		expect(denied.status).toBe(403);

		const allowed = await internals.handleUiRequest(
			new Request("http://127.0.0.1:18789/api/providers", {
				method: "OPTIONS",
				headers: {
					Origin: "http://localhost:5173",
					"Access-Control-Request-Method": "GET",
				},
			}),
		);
		expect(allowed.status).toBe(204);
		expect(allowed.headers.get("access-control-allow-origin")).toBe(
			"http://localhost:5173",
		);
	});

	it("allows tauri loopback origin preflight for desktop clients", async () => {
		const server = createGateway({
			host: "127.0.0.1",
			port: 18789,
			auth: { mode: "token", token: "test-token" },
			requireAuth: true,
		});
		const internals = getGatewayInternals(server);

		const allowed = await internals.handleUiRequest(
			new Request("http://127.0.0.1:18789/api/providers", {
				method: "OPTIONS",
				headers: {
					Origin: "tauri://localhost",
					"Access-Control-Request-Method": "GET",
				},
			}),
		);
		expect(allowed.status).toBe(204);
		expect(allowed.headers.get("access-control-allow-origin")).toBe(
			"tauri://localhost",
		);
	});

	it("does not trust tailscale identity headers on non-loopback hosts", () => {
		const server = createGateway({
			host: "0.0.0.0",
			port: 18789,
			auth: {
				mode: "token",
				token: "tailscale-token",
				allowTailscale: true,
			},
			requireAuth: true,
		});
		const internals = getGatewayInternals(server);

		const bypassAttempt = internals.requireHttpAuth(
			new Request("http://127.0.0.1:18789/api/providers", {
				headers: {
					"tailscale-user-login": "attacker@example.com",
				},
			}),
		);
		expect(bypassAttempt?.status).toBe(401);

		const authenticated = internals.requireHttpAuth(
			new Request("http://127.0.0.1:18789/api/providers", {
				headers: {
					Authorization: "Bearer tailscale-token",
					"tailscale-user-login": "attacker@example.com",
				},
			}),
		);
		expect(authenticated).toBeNull();
	});

	it("enforces bridge node capacity limits", async () => {
		const server = createGateway({
			host: "127.0.0.1",
			port: 18789,
			auth: { mode: "none" },
			requireAuth: false,
			maxNodes: 1,
		});
		const internals = getGatewayInternals(server);

		const registerBody = JSON.stringify({
			type: "register",
			payload: { name: "bridge-node" },
			timestamp: Date.now(),
		});

		const first = await internals.handleBridgeSend(
			new Request("http://127.0.0.1:18789/bridge/send", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: registerBody,
			}),
		);
		expect(first.status).toBe(200);

		const second = await internals.handleBridgeSend(
			new Request("http://127.0.0.1:18789/bridge/send", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: registerBody,
			}),
		);
		expect(second.status).toBe(429);
	});

	it("rejects malformed /api/nodes client IDs with 400", async () => {
		const server = createGateway({
			host: "127.0.0.1",
			port: 18789,
			auth: { mode: "none" },
			requireAuth: false,
		});
		const internals = getGatewayInternals(server);

		const res = await internals.handleUiRequest(
			new Request("http://127.0.0.1:18789/api/nodes/%E0%A4%A", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ enabled: true }),
			}),
		);
		expect(res.status).toBe(400);
	});

	it("requires approved client identity for node execution capabilities", () => {
		const server = createGateway({
			host: "127.0.0.1",
			port: 18789,
			auth: { mode: "none" },
			requireAuth: false,
		});
		const internals = getGatewayInternals(server);

		const blocked = createTestSocket({ authenticated: true });
		internals.handleRegister(blocked.ws, {
			type: "register",
			payload: { name: "unpaired-node", capabilities: ["system.run"] },
			timestamp: Date.now(),
		});
		expect(
			blocked.messages.some(
				(message) =>
					message.type === "error" &&
					(message.payload as { code?: string })?.code === "NODE_NOT_ENABLED",
			),
		).toBe(true);
	});

	it("rejects duplicate pending node request IDs", async () => {
		const server = createGateway({
			host: "127.0.0.1",
			port: 18789,
			auth: { mode: "none" },
			requireAuth: false,
		});
		const internals = getGatewayInternals(server);

		const enableTarget = await internals.handleUiRequest(
			new Request("http://127.0.0.1:18789/api/nodes/desktop-target", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ enabled: true, name: "Desktop Target" }),
			}),
		);
		expect(enableTarget.status).toBe(200);

		const target = createTestSocket({
			authenticated: true,
			clientId: "desktop-target",
			clientType: "desktop",
		});
		internals.handleRegister(target.ws, {
			type: "register",
			payload: { name: "target-node", capabilities: ["system.notify"] },
			timestamp: Date.now(),
		});
		const nodeId = (
			target.messages.find(
				(message) =>
					message.type === "ack" &&
					typeof (message.payload as { nodeId?: unknown })?.nodeId === "string",
			)?.payload as { nodeId?: string } | undefined
		)?.nodeId;
		expect(nodeId).toBeTruthy();

		const requester = createTestSocket({
			authenticated: true,
			clientId: "desktop-requester",
			clientType: "desktop",
		});
		const duplicateRequestId = "dup-node-request-id";
		internals.handleNodeRequest(requester.ws, {
			type: "req:node",
			id: duplicateRequestId,
			targetNodeId: nodeId,
			payload: { tool: "system.notify", args: { title: "test" } },
			timestamp: Date.now(),
		});
		internals.handleNodeRequest(requester.ws, {
			type: "req:node",
			id: duplicateRequestId,
			targetNodeId: nodeId,
			payload: { tool: "system.notify", args: { title: "test" } },
			timestamp: Date.now(),
		});

		expect(
			requester.messages.some(
				(message) =>
					message.type === "error" &&
					(message.payload as { code?: string })?.code ===
						"DUPLICATE_REQUEST_ID",
			),
		).toBe(true);
	});
});
