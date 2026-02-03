import { describe, it, expect } from "vitest";
import {
	matchesToolPattern,
	findMatchingHooks,
} from "../agent/middleware/hooks/matcher";
import type { HookMatcher, Hook } from "../types/hooks";

describe("Hooks Pattern Matching", () => {
	describe("matchesToolPattern", () => {
		describe("Wildcard patterns", () => {
			it("should match all tools with wildcard *", () => {
				expect(matchesToolPattern("write_file", "*")).toBe(true);
				expect(matchesToolPattern("read_file", "*")).toBe(true);
				expect(matchesToolPattern("any_tool", "*")).toBe(true);
			});

			it("should match all tools with empty string", () => {
				expect(matchesToolPattern("write_file", "")).toBe(true);
				expect(matchesToolPattern("read_file", "")).toBe(true);
			});

			it("should match all tools with undefined pattern", () => {
				expect(matchesToolPattern("write_file", undefined)).toBe(true);
				expect(matchesToolPattern("read_file", undefined)).toBe(true);
			});
		});

		describe("Exact match", () => {
			it("should match exact tool name", () => {
				expect(matchesToolPattern("write_file", "write_file")).toBe(true);
				expect(matchesToolPattern("read_file", "read_file")).toBe(true);
			});

			it("should not match different tool names", () => {
				expect(matchesToolPattern("write_file", "read_file")).toBe(false);
				expect(matchesToolPattern("read_file", "write_file")).toBe(false);
			});

			it("should be case-sensitive", () => {
				expect(matchesToolPattern("write_file", "WRITE_FILE")).toBe(false);
				expect(matchesToolPattern("Write_File", "write_file")).toBe(false);
			});
		});

		describe("Pipe-separated lists", () => {
			it("should match any tool in pipe-separated list", () => {
				const pattern = "write_file|read_file|edit_file";

				expect(matchesToolPattern("write_file", pattern)).toBe(true);
				expect(matchesToolPattern("read_file", pattern)).toBe(true);
				expect(matchesToolPattern("edit_file", pattern)).toBe(true);
			});

			it("should not match tools not in the list", () => {
				const pattern = "write_file|read_file";

				expect(matchesToolPattern("delete_file", pattern)).toBe(false);
				expect(matchesToolPattern("search", pattern)).toBe(false);
			});

			it("should handle whitespace around pipe separators", () => {
				const pattern = "write_file | read_file | edit_file";

				expect(matchesToolPattern("write_file", pattern)).toBe(true);
				expect(matchesToolPattern("read_file", pattern)).toBe(true);
				expect(matchesToolPattern("edit_file", pattern)).toBe(true);
			});

			it("should handle single item in pipe-separated list", () => {
				expect(matchesToolPattern("write_file", "write_file|")).toBe(true);
				expect(matchesToolPattern("write_file", "|write_file")).toBe(true);
			});
		});

		describe("Regex patterns", () => {
			it("should match regex patterns", () => {
				expect(matchesToolPattern("write_file", ".*_file")).toBe(true);
				expect(matchesToolPattern("read_file", ".*_file")).toBe(true);
				expect(matchesToolPattern("delete_file", ".*_file")).toBe(true);
			});

			it("should not match when regex doesn't match", () => {
				expect(matchesToolPattern("search", ".*_file")).toBe(false);
				expect(matchesToolPattern("internet_search", ".*_file")).toBe(false);
			});

			it("should handle complex regex patterns", () => {
				expect(matchesToolPattern("write_file", "^write_.*")).toBe(true);
				expect(matchesToolPattern("write_code", "^write_.*")).toBe(true);
				expect(matchesToolPattern("read_file", "^write_.*")).toBe(false);
			});

			it("should handle character classes in regex", () => {
				expect(matchesToolPattern("write1_file", "write[0-9]_file")).toBe(true);
				expect(matchesToolPattern("write2_file", "write[0-9]_file")).toBe(true);
				expect(matchesToolPattern("writeA_file", "write[0-9]_file")).toBe(false);
			});

			it("should fallback to exact match for invalid regex", () => {
				const invalidPattern = "[invalid(regex";

				expect(matchesToolPattern(invalidPattern, invalidPattern)).toBe(true);
				expect(matchesToolPattern("other_tool", invalidPattern)).toBe(false);
			});
		});

		describe("Edge cases", () => {
			it("should handle empty tool name", () => {
				expect(matchesToolPattern("", "*")).toBe(true);
				expect(matchesToolPattern("", "")).toBe(true);
				expect(matchesToolPattern("", "write_file")).toBe(false);
			});

			it("should handle special characters in tool names", () => {
				expect(matchesToolPattern("write_file-v2", "write_file-v2")).toBe(true);
				expect(matchesToolPattern("write.file", "write.file")).toBe(true);
				expect(matchesToolPattern("write$file", "write$file")).toBe(true);
			});
		});
	});

	describe("findMatchingHooks", () => {
		const mockHook1: Hook = {
			type: "command",
			command: "echo 'hook1'",
			timeout: 30,
		};

		const mockHook2: Hook = {
			type: "command",
			command: "echo 'hook2'",
			timeout: 60,
		};

		const mockHook3: Hook = {
			type: "command",
			command: "echo 'hook3'",
		};

		describe("Basic matching", () => {
			it("should return empty array when no matchers provided", () => {
				const result = findMatchingHooks(undefined, "write_file");

				expect(result).toEqual([]);
			});

			it("should return empty array when matchers array is empty", () => {
				const result = findMatchingHooks([], "write_file");

				expect(result).toEqual([]);
			});

			it("should return hooks that match the tool name", () => {
				const matchers: HookMatcher[] = [
					{
						matcher: "write_file",
						hooks: [mockHook1],
					},
				];

				const result = findMatchingHooks(matchers, "write_file");

				expect(result).toHaveLength(1);
				expect(result[0]).toBe(mockHook1);
			});

			it("should return empty array when no matchers match", () => {
				const matchers: HookMatcher[] = [
					{
						matcher: "write_file",
						hooks: [mockHook1],
					},
					{
						matcher: "edit_file",
						hooks: [mockHook2],
					},
				];

				const result = findMatchingHooks(matchers, "read_file");

				expect(result).toEqual([]);
			});
		});

		describe("Multiple matches", () => {
			it("should return hooks from multiple matchers", () => {
				const matchers: HookMatcher[] = [
					{
						matcher: "write_file",
						hooks: [mockHook1],
					},
					{
						matcher: "write_file",
						hooks: [mockHook2],
					},
				];

				const result = findMatchingHooks(matchers, "write_file");

				expect(result).toHaveLength(2);
				expect(result).toContain(mockHook1);
				expect(result).toContain(mockHook2);
			});

			it("should return all hooks from a matcher with multiple hooks", () => {
				const matchers: HookMatcher[] = [
					{
						matcher: "write_file",
						hooks: [mockHook1, mockHook2, mockHook3],
					},
				];

				const result = findMatchingHooks(matchers, "write_file");

				expect(result).toHaveLength(3);
				expect(result).toContain(mockHook1);
				expect(result).toContain(mockHook2);
				expect(result).toContain(mockHook3);
			});

			it("should flatten hooks from multiple matching matchers", () => {
				const matchers: HookMatcher[] = [
					{
						matcher: ".*_file",
						hooks: [mockHook1],
					},
					{
						matcher: "write_file|read_file",
						hooks: [mockHook2],
					},
					{
						matcher: "*",
						hooks: [mockHook3],
					},
				];

				const result = findMatchingHooks(matchers, "write_file");

				expect(result).toHaveLength(3);
				expect(result[0]).toBe(mockHook1);
				expect(result[1]).toBe(mockHook2);
				expect(result[2]).toBe(mockHook3);
			});
		});

		describe("Pattern types", () => {
			it("should match with wildcard pattern", () => {
				const matchers: HookMatcher[] = [
					{
						matcher: "*",
						hooks: [mockHook1],
					},
				];

				expect(findMatchingHooks(matchers, "write_file")).toHaveLength(1);
				expect(findMatchingHooks(matchers, "read_file")).toHaveLength(1);
				expect(findMatchingHooks(matchers, "any_tool")).toHaveLength(1);
			});

			it("should match with pipe-separated list", () => {
				const matchers: HookMatcher[] = [
					{
						matcher: "write_file|read_file|edit_file",
						hooks: [mockHook1],
					},
				];

				expect(findMatchingHooks(matchers, "write_file")).toHaveLength(1);
				expect(findMatchingHooks(matchers, "read_file")).toHaveLength(1);
				expect(findMatchingHooks(matchers, "delete_file")).toHaveLength(0);
			});

			it("should match with regex pattern", () => {
				const matchers: HookMatcher[] = [
					{
						matcher: ".*_file",
						hooks: [mockHook1],
					},
				];

				expect(findMatchingHooks(matchers, "write_file")).toHaveLength(1);
				expect(findMatchingHooks(matchers, "read_file")).toHaveLength(1);
				expect(findMatchingHooks(matchers, "search")).toHaveLength(0);
			});
		});

		describe("Order preservation", () => {
			it("should preserve order of hooks from matchers", () => {
				const matchers: HookMatcher[] = [
					{
						matcher: "*",
						hooks: [mockHook1, mockHook2],
					},
					{
						matcher: "write_file",
						hooks: [mockHook3],
					},
				];

				const result = findMatchingHooks(matchers, "write_file");

				expect(result).toHaveLength(3);
				expect(result[0]).toBe(mockHook1);
				expect(result[1]).toBe(mockHook2);
				expect(result[2]).toBe(mockHook3);
			});
		});

		describe("Empty hook arrays", () => {
			it("should handle matchers with empty hook arrays", () => {
				const matchers: HookMatcher[] = [
					{
						matcher: "write_file",
						hooks: [],
					},
					{
						matcher: "write_file",
						hooks: [mockHook1],
					},
				];

				const result = findMatchingHooks(matchers, "write_file");

				expect(result).toHaveLength(1);
				expect(result[0]).toBe(mockHook1);
			});
		});
	});
});
