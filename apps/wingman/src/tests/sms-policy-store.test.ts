import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSmsPolicyStore } from "@/gateway/sms/policyStore.js";

const requireTempDir = (value: string | null): string => {
	if (!value) {
		throw new Error("temp dir not initialized");
	}
	return value;
};

describe("sms policy store", () => {
	let tempDir: string | null = null;

	afterEach(() => {
		if (!tempDir) return;
		rmSync(tempDir, { recursive: true, force: true });
		tempDir = null;
	});

	it("creates defaults for unknown targets without persisting", () => {
		tempDir = mkdtempSync(join(tmpdir(), "wingman-sms-policy-"));
		const store = createSmsPolicyStore(() => requireTempDir(tempDir));

		const record = store.resolve("sms-macos:+15555550000", 1_000);
		expect(record.target).toBe("sms-macos:+15555550000");
		expect(record.paused).toBe(false);
		expect(record.stopEnabled).toBe(false);
		expect(store.list()).toHaveLength(0);
	});

	it("persists updates and clears expired pauses on resolve", () => {
		tempDir = mkdtempSync(join(tmpdir(), "wingman-sms-policy-"));
		const store = createSmsPolicyStore(() => requireTempDir(tempDir));
		const target = "sms-macos:+15555550000";

		const saved = store.upsert(
			target,
			{
				paused: true,
				pausedUntil: 50_000,
				stopEnabled: true,
			},
			1_000,
		);
		expect(saved.paused).toBe(true);
		expect(saved.pausedUntil).toBe(50_000);
		expect(saved.stopEnabled).toBe(true);

		const active = store.resolve(target, 49_000);
		expect(active.paused).toBe(true);

		const expired = store.resolve(target, 50_000);
		expect(expired.paused).toBe(false);
		expect(expired.pausedUntil).toBeNull();
		expect(expired.stopEnabled).toBe(true);
	});

	it("resets policies back to defaults", () => {
		tempDir = mkdtempSync(join(tmpdir(), "wingman-sms-policy-"));
		const store = createSmsPolicyStore(() => requireTempDir(tempDir));
		const target = "sms-macos:+15555550000";

		store.upsert(
			target,
			{
				paused: true,
				stopEnabled: true,
			},
			1_000,
		);
		expect(store.list()).toHaveLength(1);

		store.reset(target);
		expect(store.list()).toHaveLength(0);
		const defaultRecord = store.resolve(target, 2_000);
		expect(defaultRecord.paused).toBe(false);
		expect(defaultRecord.stopEnabled).toBe(false);
	});
});
