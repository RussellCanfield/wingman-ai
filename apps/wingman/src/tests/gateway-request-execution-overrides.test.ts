import { describe, expect, it } from "vitest";
import {
	resolveExecutionConfigDirOverride,
	resolveExecutionWorkspaceOverride,
} from "@/gateway/server.js";

describe("gateway request execution overrides", () => {
	it("accepts absolute execution workspace overrides", () => {
		const value = resolveExecutionWorkspaceOverride({
			execution: {
				workspace: " /tmp/wingman/workspace ",
			},
		});

		expect(value).toBe("/tmp/wingman/workspace");
	});

	it("rejects relative execution workspace overrides", () => {
		const value = resolveExecutionWorkspaceOverride({
			execution: {
				workspace: "./apps/wingman",
			},
		});

		expect(value).toBeNull();
	});

	it("parses config-dir execution override when present", () => {
		const value = resolveExecutionConfigDirOverride({
			execution: {
				configDir: " .wingman-dev ",
			},
		});

		expect(value).toBe(".wingman-dev");
	});

	it("ignores empty config-dir execution override", () => {
		const value = resolveExecutionConfigDirOverride({
			execution: {
				configDir: "   ",
			},
		});

		expect(value).toBeNull();
	});
});
