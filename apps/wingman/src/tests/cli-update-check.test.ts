import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	checkForCliUpdate,
	compareCliVersions,
	resolveCliUpdateCheckCachePath,
} from "@/cli/services/updateCheck.js";

describe("CLI update check", () => {
	let workspace: string;

	beforeEach(() => {
		workspace = mkdtempSync(join(tmpdir(), "wingman-update-check-"));
	});

	afterEach(() => {
		vi.restoreAllMocks();
		if (existsSync(workspace)) {
			rmSync(workspace, { recursive: true, force: true });
		}
	});

	it("compares semantic versions including prerelease identifiers", () => {
		expect(compareCliVersions("0.6.0", "0.6.1")).toBeLessThan(0);
		expect(compareCliVersions("0.6.1", "0.6.0")).toBeGreaterThan(0);
		expect(compareCliVersions("1.0.0-beta.1", "1.0.0-beta.2")).toBeLessThan(0);
		expect(compareCliVersions("1.0.0", "1.0.0-beta.2")).toBeGreaterThan(0);
		expect(compareCliVersions("1.0.0", "1.0.0")).toBe(0);
	});

	it("uses a fresh cached result without hitting the registry", async () => {
		mkdirSync(join(workspace, ".wingman", "cache"), { recursive: true });
		writeFileSync(
			join(workspace, ".wingman", "cache", "update-check.json"),
			JSON.stringify({
				packageName: "@wingman-ai/gateway",
				currentVersion: "0.6.0",
				latestVersion: "0.6.1",
				checkedAt: "2026-03-07T12:00:00.000Z",
			}),
		);

		const fetchMock = vi.fn();
		const notice = await checkForCliUpdate({
			workspace,
			configDir: ".wingman",
			packageMetadata: {
				name: "@wingman-ai/gateway",
				version: "0.6.0",
			},
			now: new Date("2026-03-07T13:00:00.000Z"),
			cacheTtlMs: 12 * 60 * 60 * 1_000,
			fetchImpl: fetchMock as unknown as typeof fetch,
		});

		expect(notice).toEqual({
			packageName: "@wingman-ai/gateway",
			currentVersion: "0.6.0",
			latestVersion: "0.6.1",
			command: "npm install -g @wingman-ai/gateway@latest",
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("fetches the latest version and writes it to cache", async () => {
		mkdirSync(join(workspace, ".wingman"), { recursive: true });

		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				new Response(JSON.stringify({ version: "0.6.2" }), { status: 200 }),
			);
		const notice = await checkForCliUpdate({
			workspace,
			configDir: ".wingman",
			packageMetadata: {
				name: "@wingman-ai/gateway",
				version: "0.6.0",
			},
			now: new Date("2026-03-07T12:00:00.000Z"),
			fetchImpl: fetchMock as unknown as typeof fetch,
		});

		expect(notice).toEqual({
			packageName: "@wingman-ai/gateway",
			currentVersion: "0.6.0",
			latestVersion: "0.6.2",
			command: "npm install -g @wingman-ai/gateway@latest",
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0]?.[0]).toBe(
			"https://registry.npmjs.org/%40wingman-ai%2Fgateway/latest",
		);

		const cache = JSON.parse(
			readFileSync(
				join(workspace, ".wingman", "cache", "update-check.json"),
				"utf-8",
			),
		);
		expect(cache).toMatchObject({
			packageName: "@wingman-ai/gateway",
			currentVersion: "0.6.0",
			latestVersion: "0.6.2",
			checkedAt: "2026-03-07T12:00:00.000Z",
		});
	});

	it("returns null when the installed version is current", async () => {
		mkdirSync(join(workspace, ".wingman"), { recursive: true });

		const fetchMock = vi
			.fn()
			.mockResolvedValue(
				new Response(JSON.stringify({ version: "0.6.0" }), { status: 200 }),
			);
		const notice = await checkForCliUpdate({
			workspace,
			configDir: ".wingman",
			packageMetadata: {
				name: "@wingman-ai/gateway",
				version: "0.6.0",
			},
			now: new Date("2026-03-07T12:00:00.000Z"),
			fetchImpl: fetchMock as unknown as typeof fetch,
		});

		expect(notice).toBeNull();
	});

	it("falls back to cached update data when the registry lookup fails", async () => {
		mkdirSync(join(workspace, ".wingman", "cache"), { recursive: true });
		writeFileSync(
			join(workspace, ".wingman", "cache", "update-check.json"),
			JSON.stringify({
				packageName: "@wingman-ai/gateway",
				currentVersion: "0.6.0",
				latestVersion: "0.6.1",
				checkedAt: "2026-03-01T12:00:00.000Z",
			}),
		);

		const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
		const notice = await checkForCliUpdate({
			workspace,
			configDir: ".wingman",
			packageMetadata: {
				name: "@wingman-ai/gateway",
				version: "0.6.0",
			},
			now: new Date("2026-03-07T12:00:00.000Z"),
			cacheTtlMs: 1,
			fetchImpl: fetchMock as unknown as typeof fetch,
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(notice).toEqual({
			packageName: "@wingman-ai/gateway",
			currentVersion: "0.6.0",
			latestVersion: "0.6.1",
			command: "npm install -g @wingman-ai/gateway@latest",
		});
	});

	it("falls back to a temp cache path when the workspace config dir is missing", () => {
		const cachePath = resolveCliUpdateCheckCachePath("@wingman-ai/gateway", {
			workspace,
			configDir: ".wingman",
		});

		expect(cachePath).toContain("wingman-update-check");
		expect(cachePath).toContain("wingman-ai-gateway");
	});
});
