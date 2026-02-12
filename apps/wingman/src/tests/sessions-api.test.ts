import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SessionManager } from "../cli/core/sessionManager.js";
import { handleSessionsApi } from "../gateway/http/sessions.js";

const isBunRuntime = typeof (globalThis as any).Bun !== "undefined";
const describeIfBun = isBunRuntime ? describe : describe.skip;

describeIfBun("sessions API", () => {
	let manager: SessionManager;
	let tempDir: string;

	beforeEach(async () => {
		tempDir = mkdtempSync(join(tmpdir(), "wingman-sessions-"));
		const dbPath = join(tempDir, "sessions.db");
		manager = new SessionManager(dbPath);
		await manager.initialize();
	});

	afterEach(() => {
		manager.close();
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("clears persisted session messages", async () => {
		const ctx = {
			getSessionManager: async () => manager,
			router: {
				selectAgent: (agentId?: string) => agentId || "main",
			},
		};

		const createReq = new Request("http://localhost/api/sessions", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ agentId: "main", name: "Clear Test" }),
		});
		const createRes = await handleSessionsApi(
			ctx as any,
			createReq,
			new URL(createReq.url),
		);
		expect(createRes).not.toBeNull();
		expect(createRes?.ok).toBe(true);
		const created = (await createRes!.json()) as { id: string };

		manager.updateSession(created.id, {
			messageCount: 2,
			lastMessagePreview: "Hello",
		});

		const deleteReq = new Request(
			`http://localhost/api/sessions/${encodeURIComponent(created.id)}/messages?agentId=main`,
			{ method: "DELETE" },
		);
		const deleteRes = await handleSessionsApi(
			ctx as any,
			deleteReq,
			new URL(deleteReq.url),
		);
		expect(deleteRes).not.toBeNull();
		expect(deleteRes?.ok).toBe(true);
		const payload = (await deleteRes!.json()) as { messageCount: number };
		expect(payload.messageCount).toBe(0);

		const updated = manager.getSession(created.id);
		expect(updated?.messageCount).toBe(0);
		expect(updated?.lastMessagePreview).toBeNull();
	});

	it("returns pending messages and clears them via DELETE", async () => {
		const ctx = {
			getSessionManager: async () => manager,
			router: {
				selectAgent: (agentId?: string) => agentId || "main",
			},
		};

		const createReq = new Request("http://localhost/api/sessions", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ agentId: "main", name: "Pending Test" }),
		});
		const createRes = await handleSessionsApi(
			ctx as any,
			createReq,
			new URL(createReq.url),
		);
		expect(createRes).not.toBeNull();
		expect(createRes?.ok).toBe(true);
		const created = (await createRes!.json()) as { id: string };

		manager.persistPendingMessage({
			sessionId: created.id,
			requestId: "req-pending-test",
			message: {
				id: "user-req-pending-test",
				role: "user",
				content: "Persist me",
				createdAt: Date.now(),
			},
		});

		const getReq = new Request(
			`http://localhost/api/sessions/${encodeURIComponent(created.id)}/messages?agentId=main`,
			{ method: "GET" },
		);
		const getRes = await handleSessionsApi(
			ctx as any,
			getReq,
			new URL(getReq.url),
		);
		expect(getRes).not.toBeNull();
		expect(getRes?.ok).toBe(true);
		const pendingMessages = (await getRes!.json()) as Array<{
			role: "user" | "assistant";
			content: string;
		}>;
		expect(
			pendingMessages.some(
				(message) =>
					message.role === "user" && message.content.includes("Persist me"),
			),
		).toBe(true);

		const deleteReq = new Request(
			`http://localhost/api/sessions/${encodeURIComponent(created.id)}/messages?agentId=main`,
			{ method: "DELETE" },
		);
		const deleteRes = await handleSessionsApi(
			ctx as any,
			deleteReq,
			new URL(deleteReq.url),
		);
		expect(deleteRes).not.toBeNull();
		expect(deleteRes?.ok).toBe(true);

		const afterClearGetReq = new Request(
			`http://localhost/api/sessions/${encodeURIComponent(created.id)}/messages?agentId=main`,
			{ method: "GET" },
		);
		const afterClearGetRes = await handleSessionsApi(
			ctx as any,
			afterClearGetReq,
			new URL(afterClearGetReq.url),
		);
		expect(afterClearGetRes).not.toBeNull();
		expect(afterClearGetRes?.ok).toBe(true);
		const afterClearMessages =
			(await afterClearGetRes!.json()) as Array<unknown>;
		expect(afterClearMessages).toHaveLength(0);
	});

	it("lists sessions for discovered agents not present in config", async () => {
		const configDir = join(tempDir, ".wingman");
		const discoveredAgentId = "local-helper";
		const discoveredAgentDir = join(configDir, "agents", discoveredAgentId);
		mkdirSync(discoveredAgentDir, { recursive: true });
		writeFileSync(
			join(discoveredAgentDir, "agent.json"),
			JSON.stringify(
				{
					name: discoveredAgentId,
					description: "Local helper agent",
					systemPrompt: "You are a local helper.",
				},
				null,
				2,
			),
		);

		const ctx = {
			workspace: tempDir,
			configDir,
			getWingmanConfig: () => ({
				agents: { list: [{ id: "main", model: "openai:gpt-4.1-mini" }] },
			}),
			getSessionManager: async () => manager,
			router: {
				selectAgent: (agentId?: string) => agentId || "main",
			},
			logger: {
				debug: () => {},
				info: () => {},
				warn: () => {},
				error: () => {},
			},
		};

		const createReq = new Request("http://localhost/api/sessions", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				agentId: discoveredAgentId,
				name: "Discovered Agent Thread",
			}),
		});
		const createRes = await handleSessionsApi(
			ctx as any,
			createReq,
			new URL(createReq.url),
		);
		expect(createRes).not.toBeNull();
		expect(createRes?.ok).toBe(true);
		const created = (await createRes!.json()) as {
			id: string;
			agentId: string;
		};
		expect(created.agentId).toBe(discoveredAgentId);

		const listReq = new Request("http://localhost/api/sessions?limit=100", {
			method: "GET",
		});
		const listRes = await handleSessionsApi(
			ctx as any,
			listReq,
			new URL(listReq.url),
		);
		expect(listRes).not.toBeNull();
		expect(listRes?.ok).toBe(true);
		const sessions = (await listRes!.json()) as Array<{
			id: string;
			agentId: string;
		}>;
		expect(
			sessions.some(
				(session) =>
					session.id === created.id && session.agentId === discoveredAgentId,
			),
		).toBe(true);
	});
});
