import { describe, it, expect } from "vitest";
import {
	validateAgentConfig,
	AgentConfigSchema,
} from "../config/agentConfig";

describe("Agent Configuration Schema", () => {
	describe("validateAgentConfig", () => {
		it("should validate a valid minimal agent config", () => {
			const config = {
				name: "test-agent",
				description: "A test agent",
				systemPrompt: "You are a test agent",
			};

			const result = validateAgentConfig(config);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.name).toBe("test-agent");
				expect(result.data.description).toBe("A test agent");
				expect(result.data.systemPrompt).toBe("You are a test agent");
			}
		});

		it("should validate a complete agent config with all fields", () => {
			const config = {
				name: "data-analyst",
				description: "Analyzes data",
				systemPrompt: "You are a data analyst",
				tools: ["command_execute", "think"],
				model: "anthropic:claude-opus-4-5",
				blockedCommands: ["rm", "mv"],
				allowScriptExecution: true,
				commandTimeout: 300000,
			};

			const result = validateAgentConfig(config);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.tools).toEqual(["command_execute", "think"]);
				expect(result.data.model).toBe("anthropic:claude-opus-4-5");
				expect(result.data.blockedCommands).toEqual(["rm", "mv"]);
				expect(result.data.allowScriptExecution).toBe(true);
				expect(result.data.commandTimeout).toBe(300000);
			}
		});

		it("should allow subagents to override models", () => {
			const config = {
				name: "parent-agent",
				description: "Parent agent",
				systemPrompt: "You are the parent agent",
				subAgents: [
					{
						name: "research-agent",
						description: "Researches topics",
						systemPrompt: "You are a researcher",
						model: "openai:gpt-4o",
					},
				],
			};

			const result = validateAgentConfig(config);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.subAgents?.[0].model).toBe("openai:gpt-4o");
			}
		});

		it("should fail validation for missing required fields", () => {
			const config = {
				name: "test-agent",
				// missing description and systemPrompt
			};

			const result = validateAgentConfig(config);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("description");
				expect(result.error).toContain("systemPrompt");
			}
		});

		it("should fail validation for invalid tool names", () => {
			const config = {
				name: "test-agent",
				description: "Test",
				systemPrompt: "Test",
				tools: ["invalid_tool"],
			};

			const result = validateAgentConfig(config);
			expect(result.success).toBe(false);
		});

		it("should apply default values for optional fields", () => {
			const config = {
				name: "test-agent",
				description: "Test",
				systemPrompt: "Test",
			};

			const parsed = AgentConfigSchema.parse(config);
			expect(parsed.allowScriptExecution).toBe(true);
			expect(parsed.commandTimeout).toBe(300000);
		});
	});

	describe("Tool names enum", () => {
		it("should accept all valid tool names", () => {
			const validTools = [
				"internet_search",
				"web_crawler",
				"command_execute",
				"think",
				"ui_registry_list",
				"ui_registry_get",
				"ui_present",
			];

			for (const tool of validTools) {
				const config = {
					name: "test",
					description: "test",
					systemPrompt: "test",
					tools: [tool],
				};

				const result = validateAgentConfig(config);
				expect(result.success).toBe(true);
			}
		});
	});
});
