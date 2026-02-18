import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSmsPolicyStateStore, handleSmsApi } from "@/gateway/http/sms.js";
import type { GatewayHttpContext } from "@/gateway/http/types.js";

const requireTempDir = (value: string | null): string => {
	if (!value) {
		throw new Error("temp dir not initialized");
	}
	return value;
};

describe("sms policy api", () => {
	let tempDir: string | null = null;

	afterEach(() => {
		if (!tempDir) return;
		rmSync(tempDir, { recursive: true, force: true });
		tempDir = null;
	});

	it("updates, fetches, and resets policy records", async () => {
		tempDir = mkdtempSync(join(tmpdir(), "wingman-sms-api-"));
		const store = createSmsPolicyStateStore(() => requireTempDir(tempDir));
		const target = encodeURIComponent("sms-macos:+15555550000");
		const ctx = {} as unknown as GatewayHttpContext;

		const updateReq = new Request(
			`http://localhost/api/sms/policies/${target}`,
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					stopEnabled: true,
					pauseForMs: 120_000,
					alertMode: "all",
				}),
			},
		);
		const updateRes = await handleSmsApi(
			ctx,
			store,
			updateReq,
			new URL(updateReq.url),
		);
		expect(updateRes?.status).toBe(200);
		const updated = (await updateRes?.json()) as {
			paused: boolean;
			stopEnabled: boolean;
			alertMode: string;
			pausedUntil: number | null;
		};
		expect(updated.paused).toBe(true);
		expect(updated.pausedUntil).toBeTypeOf("number");
		expect(updated.stopEnabled).toBe(true);
		expect(updated.alertMode).toBe("all");

		const getRes = await handleSmsApi(
			ctx,
			store,
			new Request(`http://localhost/api/sms/policies/${target}`, {
				method: "GET",
			}),
			new URL(`http://localhost/api/sms/policies/${target}`),
		);
		expect(getRes?.status).toBe(200);

		const listRes = await handleSmsApi(
			ctx,
			store,
			new Request("http://localhost/api/sms/policies", {
				method: "GET",
			}),
			new URL("http://localhost/api/sms/policies"),
		);
		expect(listRes?.status).toBe(200);
		const listPayload = (await listRes?.json()) as {
			policies: Array<{ target: string }>;
		};
		expect(listPayload.policies).toHaveLength(1);

		const deleteRes = await handleSmsApi(
			ctx,
			store,
			new Request(`http://localhost/api/sms/policies/${target}`, {
				method: "DELETE",
			}),
			new URL(`http://localhost/api/sms/policies/${target}`),
		);
		expect(deleteRes?.status).toBe(200);
		const reset = (await deleteRes?.json()) as {
			paused: boolean;
			stopEnabled: boolean;
		};
		expect(reset.paused).toBe(false);
		expect(reset.stopEnabled).toBe(false);
	});

	it("applies control commands and leaves non-commands as pass-through text", async () => {
		tempDir = mkdtempSync(join(tmpdir(), "wingman-sms-api-"));
		const store = createSmsPolicyStateStore(() => requireTempDir(tempDir));
		const target = encodeURIComponent("sms-macos:+15555550000");
		const ctx = {
			router: {
				selectAgent: () => "main",
				buildSessionKey: () => "agent:main:sms-macos:dm:+15555550000",
			},
		} as unknown as GatewayHttpContext;

		const pauseReq = new Request(
			`http://localhost/api/sms/policies/${target}/command`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					text: "PAUSE 2h",
					nowMs: 10_000,
				}),
			},
		);
		const pauseRes = await handleSmsApi(
			ctx,
			store,
			pauseReq,
			new URL(pauseReq.url),
		);
		expect(pauseRes?.status).toBe(200);
		const pausedPayload = (await pauseRes?.json()) as {
			handled: boolean;
			command?: { name: string };
			policy: { paused: boolean };
		};
		expect(pausedPayload.handled).toBe(true);
		expect(pausedPayload.command?.name).toBe("pause");
		expect(pausedPayload.policy.paused).toBe(true);

		const textReq = new Request(
			`http://localhost/api/sms/policies/${target}/command`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					text: "deploy this now",
				}),
			},
		);
		const textRes = await handleSmsApi(
			ctx,
			store,
			textReq,
			new URL(textReq.url),
		);
		expect(textRes?.status).toBe(200);
		const textPayload = (await textRes?.json()) as {
			handled: boolean;
			passThroughText?: string;
		};
		expect(textPayload.handled).toBe(false);
		expect(textPayload.passThroughText).toBe("deploy this now");
	});

	it("normalizes inbound messages into command, stopped, or agent results", async () => {
		tempDir = mkdtempSync(join(tmpdir(), "wingman-sms-api-"));
		const store = createSmsPolicyStateStore(() => requireTempDir(tempDir));
		const ctx = {
			router: {
				selectAgent: () => "main",
				buildSessionKey: () => "agent:main:sms-macos:dm:+15555550000",
			},
		} as unknown as GatewayHttpContext;

		const commandReq = new Request("http://localhost/api/sms/messages", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				target: "sms-macos:+15555550000",
				text: "HELP",
			}),
		});
		const commandRes = await handleSmsApi(
			ctx,
			store,
			commandReq,
			new URL(commandReq.url),
		);
		expect(commandRes?.status).toBe(200);
		const commandPayload = (await commandRes?.json()) as {
			kind: string;
			handled: boolean;
		};
		expect(commandPayload.kind).toBe("command");
		expect(commandPayload.handled).toBe(true);

		const stopReq = new Request("http://localhost/api/sms/messages", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				target: "sms-macos:+15555550000",
				text: "STOP",
			}),
		});
		const stopRes = await handleSmsApi(
			ctx,
			store,
			stopReq,
			new URL(stopReq.url),
		);
		expect(stopRes?.status).toBe(200);

		const blockedReq = new Request("http://localhost/api/sms/messages", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				target: "sms-macos:+15555550000",
				text: "summarize my build failures",
			}),
		});
		const blockedRes = await handleSmsApi(
			ctx,
			store,
			blockedReq,
			new URL(blockedReq.url),
		);
		expect(blockedRes?.status).toBe(200);
		const blockedPayload = (await blockedRes?.json()) as {
			kind: string;
			responseText: string;
		};
		expect(blockedPayload.kind).toBe("stopped");
		expect(blockedPayload.responseText).toContain("stopped");

		store.upsert("sms-macos:+15555550000", { stopEnabled: false });
		const agentReq = new Request("http://localhost/api/sms/messages", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				target: "sms-macos:+15555550000",
				text: "summarize my build failures",
				queueIfBusy: true,
			}),
		});
		const agentRes = await handleSmsApi(
			ctx,
			store,
			agentReq,
			new URL(agentReq.url),
		);
		expect(agentRes?.status).toBe(200);
		const agentPayload = (await agentRes?.json()) as {
			kind: string;
			request: {
				agentId?: string;
				content?: string;
				sessionKey?: string;
				routing?: { channel?: string };
				queueIfBusy?: boolean;
			};
		};
		expect(agentPayload.kind).toBe("agent");
		expect(agentPayload.request.agentId).toBe("main");
		expect(agentPayload.request.content).toBe("summarize my build failures");
		expect(agentPayload.request.sessionKey).toBe(
			"agent:main:sms-macos:dm:+15555550000",
		);
		expect(agentPayload.request.routing?.channel).toBe("sms-macos");
		expect(agentPayload.request.queueIfBusy).toBe(true);
	});
});
