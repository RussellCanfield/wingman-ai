import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { handleSessionsApi } from "../gateway/http/sessions.js";
import { SessionManager } from "../cli/core/sessionManager.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("sessions API", () => {
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
		const createRes = await handleSessionsApi(ctx as any, createReq, new URL(createReq.url));
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
		const deleteRes = await handleSessionsApi(ctx as any, deleteReq, new URL(deleteReq.url));
		expect(deleteRes).not.toBeNull();
		expect(deleteRes?.ok).toBe(true);
		const payload = (await deleteRes!.json()) as { messageCount: number };
		expect(payload.messageCount).toBe(0);

		const updated = manager.getSession(created.id);
		expect(updated?.messageCount).toBe(0);
		expect(updated?.lastMessagePreview).toBeNull();
	});
});
