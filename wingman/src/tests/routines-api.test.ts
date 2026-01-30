import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createRoutineStore, handleRoutinesApi } from "../gateway/http/routines.js";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const isBunRuntime = typeof (globalThis as any).Bun !== "undefined";
const describeIfBun = isBunRuntime ? describe : describe.skip;

describeIfBun("routines API", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "wingman-routines-"));
		const agentDir = join(tempDir, "agents", "main");
		mkdirSync(agentDir, { recursive: true });
		writeFileSync(
			join(agentDir, "agent.json"),
			JSON.stringify(
				{
					name: "main",
					description: "Main agent",
					systemPrompt: "You are the main agent",
				},
				null,
				2,
			),
		);
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("creates, lists, and deletes routines", async () => {
		const ctx = {
			configDir: tempDir,
			workspace: tempDir,
			getWingmanConfig: () => ({}),
			getSessionManager: async () => {
				throw new Error("SessionManager not used in this test");
			},
		};

		const store = createRoutineStore(() => tempDir);

		const createReq = new Request("http://localhost/api/routines", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Daily Check-in",
				agentId: "main",
				cron: "0 9 * * *",
				prompt: "Summarize today's tasks.",
				enabled: true,
			}),
		});
		const createRes = await handleRoutinesApi(
			ctx as any,
			store,
			createReq,
			new URL(createReq.url),
		);
		expect(createRes).not.toBeNull();
		expect(createRes?.ok).toBe(true);
		const created = (await createRes!.json()) as { id: string };
		expect(created.id).toMatch(/^routine-/);

		const listReq = new Request("http://localhost/api/routines", { method: "GET" });
		const listRes = await handleRoutinesApi(
			ctx as any,
			store,
			listReq,
			new URL(listReq.url),
		);
		expect(listRes).not.toBeNull();
		const list = (await listRes!.json()) as Array<{ id: string }>;
		expect(list).toHaveLength(1);
		expect(list[0].id).toBe(created.id);

		const deleteReq = new Request(
			`http://localhost/api/routines/${encodeURIComponent(created.id)}`,
			{ method: "DELETE" },
		);
		const deleteRes = await handleRoutinesApi(
			ctx as any,
			store,
			deleteReq,
			new URL(deleteReq.url),
		);
		expect(deleteRes).not.toBeNull();
		expect(deleteRes?.ok).toBe(true);

		const listResAfter = await handleRoutinesApi(
			ctx as any,
			store,
			listReq,
			new URL(listReq.url),
		);
		const listAfter = (await listResAfter!.json()) as Array<{ id: string }>;
		expect(listAfter).toHaveLength(0);
	});

	it("rejects invalid cron expressions", async () => {
		const ctx = {
			configDir: tempDir,
			workspace: tempDir,
			getWingmanConfig: () => ({}),
			getSessionManager: async () => {
				throw new Error("SessionManager not used in this test");
			},
		};

		const store = createRoutineStore(() => tempDir);

		const createReq = new Request("http://localhost/api/routines", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Invalid Cron",
				agentId: "main",
				cron: "bad cron",
				prompt: "Hello",
				enabled: true,
			}),
		});
		const createRes = await handleRoutinesApi(
			ctx as any,
			store,
			createReq,
			new URL(createReq.url),
		);
		expect(createRes).not.toBeNull();
		expect(createRes?.status).toBe(400);
	});
});
