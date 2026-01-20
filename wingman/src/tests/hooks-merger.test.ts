import { describe, it, expect } from "vitest";
import { mergeHooks } from "../agent/middleware/hooks/merger";
import type { HooksConfig, Hook, HookMatcher, StopHook } from "../types/hooks";

describe("Hooks Configuration Merger", () => {
	const mockHook1: Hook = {
		type: "command",
		command: "echo 'global'",
		timeout: 30,
	};

	const mockHook2: Hook = {
		type: "command",
		command: "echo 'agent'",
		timeout: 60,
	};

	const mockHook3: Hook = {
		type: "command",
		command: "echo 'extra'",
	};

	describe("Empty configurations", () => {
		it("should return undefined when both are undefined", () => {
			const result = mergeHooks(undefined, undefined);

			expect(result).toBeUndefined();
		});

		it("should return global hooks when agent hooks is undefined", () => {
			const globalHooks: HooksConfig = {
				PreToolUse: [{ matcher: "*", hooks: [mockHook1] }],
			};

			const result = mergeHooks(globalHooks, undefined);

			expect(result).toBe(globalHooks);
		});

		it("should return agent hooks when global hooks is undefined", () => {
			const agentHooks: HooksConfig = {
				PreToolUse: [{ matcher: "*", hooks: [mockHook1] }],
			};

			const result = mergeHooks(undefined, agentHooks);

			expect(result).toBe(agentHooks);
		});
	});

	describe("PreToolUse hooks merging", () => {
		it("should merge PreToolUse hooks from both configs", () => {
			const globalHooks: HooksConfig = {
				PreToolUse: [{ matcher: "*", hooks: [mockHook1] }],
			};

			const agentHooks: HooksConfig = {
				PreToolUse: [{ matcher: "write_file", hooks: [mockHook2] }],
			};

			const result = mergeHooks(globalHooks, agentHooks);

			expect(result?.PreToolUse).toHaveLength(2);
			expect(result?.PreToolUse?.[0]).toBe(globalHooks.PreToolUse?.[0]);
			expect(result?.PreToolUse?.[1]).toBe(agentHooks.PreToolUse?.[0]);
		});

		it("should include PreToolUse hooks from global only", () => {
			const globalHooks: HooksConfig = {
				PreToolUse: [{ matcher: "*", hooks: [mockHook1] }],
			};

			const agentHooks: HooksConfig = {};

			const result = mergeHooks(globalHooks, agentHooks);

			expect(result?.PreToolUse).toHaveLength(1);
			expect(result?.PreToolUse?.[0]).toBe(globalHooks.PreToolUse?.[0]);
		});

		it("should include PreToolUse hooks from agent only", () => {
			const globalHooks: HooksConfig = {};

			const agentHooks: HooksConfig = {
				PreToolUse: [{ matcher: "write_file", hooks: [mockHook2] }],
			};

			const result = mergeHooks(globalHooks, agentHooks);

			expect(result?.PreToolUse).toHaveLength(1);
			expect(result?.PreToolUse?.[0]).toBe(agentHooks.PreToolUse?.[0]);
		});

		it("should preserve order: global hooks first, then agent hooks", () => {
			const globalMatcher: HookMatcher = {
				matcher: "*",
				hooks: [mockHook1],
			};

			const agentMatcher: HookMatcher = {
				matcher: "write_file",
				hooks: [mockHook2],
			};

			const globalHooks: HooksConfig = {
				PreToolUse: [globalMatcher],
			};

			const agentHooks: HooksConfig = {
				PreToolUse: [agentMatcher],
			};

			const result = mergeHooks(globalHooks, agentHooks);

			expect(result?.PreToolUse?.[0]).toBe(globalMatcher);
			expect(result?.PreToolUse?.[1]).toBe(agentMatcher);
		});
	});

	describe("PostToolUse hooks merging", () => {
		it("should merge PostToolUse hooks from both configs", () => {
			const globalHooks: HooksConfig = {
				PostToolUse: [{ matcher: "*", hooks: [mockHook1] }],
			};

			const agentHooks: HooksConfig = {
				PostToolUse: [{ matcher: "write_file", hooks: [mockHook2] }],
			};

			const result = mergeHooks(globalHooks, agentHooks);

			expect(result?.PostToolUse).toHaveLength(2);
			expect(result?.PostToolUse?.[0]).toBe(globalHooks.PostToolUse?.[0]);
			expect(result?.PostToolUse?.[1]).toBe(agentHooks.PostToolUse?.[0]);
		});

		it("should include PostToolUse hooks from global only", () => {
			const globalHooks: HooksConfig = {
				PostToolUse: [{ matcher: "*", hooks: [mockHook1] }],
			};

			const agentHooks: HooksConfig = {};

			const result = mergeHooks(globalHooks, agentHooks);

			expect(result?.PostToolUse).toHaveLength(1);
			expect(result?.PostToolUse?.[0]).toBe(globalHooks.PostToolUse?.[0]);
		});

		it("should include PostToolUse hooks from agent only", () => {
			const globalHooks: HooksConfig = {};

			const agentHooks: HooksConfig = {
				PostToolUse: [{ matcher: "write_file", hooks: [mockHook2] }],
			};

			const result = mergeHooks(globalHooks, agentHooks);

			expect(result?.PostToolUse).toHaveLength(1);
			expect(result?.PostToolUse?.[0]).toBe(agentHooks.PostToolUse?.[0]);
		});

		it("should preserve order: global hooks first, then agent hooks", () => {
			const globalMatcher: HookMatcher = {
				matcher: "*",
				hooks: [mockHook1],
			};

			const agentMatcher: HookMatcher = {
				matcher: "write_file",
				hooks: [mockHook2],
			};

			const globalHooks: HooksConfig = {
				PostToolUse: [globalMatcher],
			};

			const agentHooks: HooksConfig = {
				PostToolUse: [agentMatcher],
			};

			const result = mergeHooks(globalHooks, agentHooks);

			expect(result?.PostToolUse?.[0]).toBe(globalMatcher);
			expect(result?.PostToolUse?.[1]).toBe(agentMatcher);
		});
	});

	describe("Stop hooks merging", () => {
		it("should merge Stop hooks from both configs", () => {
			const globalHooks: HooksConfig = {
				Stop: [{ hooks: [mockHook1] }],
			};

			const agentHooks: HooksConfig = {
				Stop: [{ hooks: [mockHook2] }],
			};

			const result = mergeHooks(globalHooks, agentHooks);

			expect(result?.Stop).toHaveLength(2);
			expect(result?.Stop?.[0]).toBe(globalHooks.Stop?.[0]);
			expect(result?.Stop?.[1]).toBe(agentHooks.Stop?.[0]);
		});

		it("should include Stop hooks from global only", () => {
			const globalHooks: HooksConfig = {
				Stop: [{ hooks: [mockHook1] }],
			};

			const agentHooks: HooksConfig = {};

			const result = mergeHooks(globalHooks, agentHooks);

			expect(result?.Stop).toHaveLength(1);
			expect(result?.Stop?.[0]).toBe(globalHooks.Stop?.[0]);
		});

		it("should include Stop hooks from agent only", () => {
			const globalHooks: HooksConfig = {};

			const agentHooks: HooksConfig = {
				Stop: [{ hooks: [mockHook2] }],
			};

			const result = mergeHooks(globalHooks, agentHooks);

			expect(result?.Stop).toHaveLength(1);
			expect(result?.Stop?.[0]).toBe(agentHooks.Stop?.[0]);
		});

		it("should preserve order: global hooks first, then agent hooks", () => {
			const globalStop: StopHook = { hooks: [mockHook1] };
			const agentStop: StopHook = { hooks: [mockHook2] };

			const globalHooks: HooksConfig = {
				Stop: [globalStop],
			};

			const agentHooks: HooksConfig = {
				Stop: [agentStop],
			};

			const result = mergeHooks(globalHooks, agentHooks);

			expect(result?.Stop?.[0]).toBe(globalStop);
			expect(result?.Stop?.[1]).toBe(agentStop);
		});
	});

	describe("Multi-event merging", () => {
		it("should merge all hook types when both have all types", () => {
			const globalHooks: HooksConfig = {
				PreToolUse: [{ matcher: "*", hooks: [mockHook1] }],
				PostToolUse: [{ matcher: "*", hooks: [mockHook1] }],
				Stop: [{ hooks: [mockHook1] }],
			};

			const agentHooks: HooksConfig = {
				PreToolUse: [{ matcher: "write_file", hooks: [mockHook2] }],
				PostToolUse: [{ matcher: "write_file", hooks: [mockHook2] }],
				Stop: [{ hooks: [mockHook2] }],
			};

			const result = mergeHooks(globalHooks, agentHooks);

			expect(result?.PreToolUse).toHaveLength(2);
			expect(result?.PostToolUse).toHaveLength(2);
			expect(result?.Stop).toHaveLength(2);
		});

		it("should merge only the hook types that are defined", () => {
			const globalHooks: HooksConfig = {
				PreToolUse: [{ matcher: "*", hooks: [mockHook1] }],
			};

			const agentHooks: HooksConfig = {
				PostToolUse: [{ matcher: "write_file", hooks: [mockHook2] }],
				Stop: [{ hooks: [mockHook3] }],
			};

			const result = mergeHooks(globalHooks, agentHooks);

			expect(result?.PreToolUse).toHaveLength(1);
			expect(result?.PostToolUse).toHaveLength(1);
			expect(result?.Stop).toHaveLength(1);
		});

		it("should handle complex multi-matcher scenario", () => {
			const globalHooks: HooksConfig = {
				PreToolUse: [
					{ matcher: "*", hooks: [mockHook1] },
					{ matcher: ".*_file", hooks: [mockHook2] },
				],
				PostToolUse: [{ matcher: "write_file|read_file", hooks: [mockHook1] }],
			};

			const agentHooks: HooksConfig = {
				PreToolUse: [{ matcher: "write_file", hooks: [mockHook3] }],
				Stop: [{ hooks: [mockHook2, mockHook3] }],
			};

			const result = mergeHooks(globalHooks, agentHooks);

			expect(result?.PreToolUse).toHaveLength(3);
			expect(result?.PostToolUse).toHaveLength(1);
			expect(result?.Stop).toHaveLength(1);
		});
	});

	describe("No duplication handling", () => {
		it("should not deduplicate identical hooks", () => {
			const sharedHook: Hook = {
				type: "command",
				command: "echo 'shared'",
			};

			const globalHooks: HooksConfig = {
				PreToolUse: [{ matcher: "*", hooks: [sharedHook] }],
			};

			const agentHooks: HooksConfig = {
				PreToolUse: [{ matcher: "*", hooks: [sharedHook] }],
			};

			const result = mergeHooks(globalHooks, agentHooks);

			expect(result?.PreToolUse).toHaveLength(2);
		});
	});

	describe("Empty arrays", () => {
		it("should handle empty hook arrays in global config", () => {
			const globalHooks: HooksConfig = {
				PreToolUse: [],
			};

			const agentHooks: HooksConfig = {
				PreToolUse: [{ matcher: "*", hooks: [mockHook1] }],
			};

			const result = mergeHooks(globalHooks, agentHooks);

			expect(result?.PreToolUse).toHaveLength(1);
		});

		it("should handle empty hook arrays in agent config", () => {
			const globalHooks: HooksConfig = {
				PreToolUse: [{ matcher: "*", hooks: [mockHook1] }],
			};

			const agentHooks: HooksConfig = {
				PreToolUse: [],
			};

			const result = mergeHooks(globalHooks, agentHooks);

			expect(result?.PreToolUse).toHaveLength(1);
		});

		it("should handle both having empty arrays", () => {
			const globalHooks: HooksConfig = {
				PreToolUse: [],
			};

			const agentHooks: HooksConfig = {
				PreToolUse: [],
			};

			const result = mergeHooks(globalHooks, agentHooks);

			expect(result?.PreToolUse).toHaveLength(0);
		});
	});
});
