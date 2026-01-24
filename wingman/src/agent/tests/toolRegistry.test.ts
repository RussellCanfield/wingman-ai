import { describe, it, expect } from "vitest";
import { createTool, createTools, getAvailableTools } from "../config/toolRegistry";

describe("Tool Registry", () => {
	describe("createTool", () => {
		it("should create internet_search tool", () => {
			const tool = createTool("internet_search");

			expect(tool).not.toBeNull();
			expect(tool?.name).toBe("internet_search");
		});

		it("should create web_crawler tool", () => {
			const tool = createTool("web_crawler");

			expect(tool).not.toBeNull();
			expect(tool?.name).toBe("web_crawler");
		});

		it("should create command_execute tool with default options", () => {
			const tool = createTool("command_execute");

			expect(tool).not.toBeNull();
			expect(tool?.name).toBe("command_execute");
		});

		it("should create command_execute tool with custom options", () => {
			const tool = createTool("command_execute", {
				workspace: "/custom/path",
				blockedCommands: ["rm", "mv"],
				allowScriptExecution: false,
				timeout: 60000,
			});

			expect(tool).not.toBeNull();
			expect(tool?.name).toBe("command_execute");
		});

		it("should create think tool", () => {
			const tool = createTool("think");

			expect(tool).not.toBeNull();
			expect(tool?.name).toBe("think");
		});

		it("should return null for unknown tool name", () => {
			// @ts-expect-error - Testing invalid input
			const tool = createTool("unknown_tool");

			expect(tool).toBeNull();
		});
	});

	describe("createTools", () => {
		it("should create multiple tools from array", async () => {
			const tools = await createTools(["internet_search", "web_crawler", "think"]);

			expect(tools).toHaveLength(3);
			expect(tools[0].name).toBe("internet_search");
			expect(tools[1].name).toBe("web_crawler");
			expect(tools[2].name).toBe("think");
		});

		it("should create empty array for empty input", async () => {
			const tools = await createTools([]);

			expect(tools).toHaveLength(0);
		});

		it("should skip unknown tool names", async () => {
			const tools = await createTools([
				"internet_search",
				// @ts-expect-error - Testing invalid input
				"unknown_tool",
				"think",
			]);

			expect(tools).toHaveLength(2);
			expect(tools[0].name).toBe("internet_search");
			expect(tools[1].name).toBe("think");
		});

		it("should pass options to all tools", async () => {
			const tools = await createTools(["command_execute"], {
				workspace: "/test/path",
				timeout: 30000,
			});

			expect(tools).toHaveLength(1);
			expect(tools[0].name).toBe("command_execute");
		});

		it("should create all available tools", async () => {
			const availableTools = getAvailableTools();
			const tools = await createTools(availableTools);

			expect(tools).toHaveLength(availableTools.length);
		});
	});

	describe("getAvailableTools", () => {
		it("should return all available tool names", () => {
			const tools = getAvailableTools();

			expect(tools).toEqual([
				"internet_search",
				"web_crawler",
				"command_execute",
				"think",
				"code_search",
				"git_status",
			]);
		});

		it("should return a consistent list", () => {
			const tools1 = getAvailableTools();
			const tools2 = getAvailableTools();

			expect(tools1).toEqual(tools2);
		});
	});
});
