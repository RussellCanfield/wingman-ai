import { describe, expect, it, beforeEach, vi } from "vitest";

const { mockSpawnSync } = vi.hoisted(() => ({
	mockSpawnSync: vi.fn(),
}));

vi.mock("node:child_process", () => ({
	spawnSync: mockSpawnSync,
}));

import { commandRequiresUv, ensureUvAvailableForFeature } from "@/utils/uv.js";

describe("uv feature gating", () => {
	beforeEach(() => {
		mockSpawnSync.mockReset();
	});

	it("detects uv and uvx commands", () => {
		expect(commandRequiresUv("uv")).toBe(true);
		expect(commandRequiresUv("uvx")).toBe(true);
		expect(commandRequiresUv("/usr/local/bin/uvx")).toBe(true);
		expect(commandRequiresUv("C:/tools/uv.exe")).toBe(true);
		expect(commandRequiresUv("node")).toBe(false);
	});

	it("skips checks when command does not require uv", () => {
		expect(() =>
			ensureUvAvailableForFeature("node", "gateway.mcpProxy.enabled"),
		).not.toThrow();
		expect(mockSpawnSync).not.toHaveBeenCalled();
	});

	it("passes when uv is available", () => {
		mockSpawnSync.mockReturnValue({ status: 0 });

		expect(() =>
			ensureUvAvailableForFeature("uvx", "skills.security.scanOnInstall"),
		).not.toThrow();
		expect(mockSpawnSync).toHaveBeenCalledWith("uv", ["--version"], {
			stdio: "ignore",
		});
	});

	it("throws when uv is required but unavailable", () => {
		mockSpawnSync.mockReturnValue({ status: 1 });

		expect(() =>
			ensureUvAvailableForFeature("uv", "gateway.mcpProxy.enabled"),
		).toThrow(/requires uv/i);
	});
});
