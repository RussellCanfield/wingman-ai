import { describe, expect, it } from "vitest";
import { AgentConfigSchema, validateAgentConfig } from "../config/agentConfig";

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
				reasoningEffort: "high",
				blockedCommands: ["rm", "mv"],
				allowScriptExecution: true,
				commandTimeout: 300000,
				browserProfile: "trading",
				browserTransport: "relay",
			};

			const result = validateAgentConfig(config);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.tools).toEqual(["command_execute", "think"]);
				expect(result.data.model).toBe("anthropic:claude-opus-4-5");
				expect(result.data.reasoningEffort).toBe("high");
				expect(result.data.blockedCommands).toEqual(["rm", "mv"]);
				expect(result.data.allowScriptExecution).toBe(true);
				expect(result.data.commandTimeout).toBe(300000);
				expect(result.data.browserProfile).toBe("trading");
				expect(result.data.browserTransport).toBe("relay");
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
						reasoningEffort: "low",
					},
				],
			};

			const result = validateAgentConfig(config);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.subAgents?.[0].model).toBe("openai:gpt-4o");
				expect(result.data.subAgents?.[0].reasoningEffort).toBe("low");
			}
		});

		it("should fail when a sub-agent shares the same name as its parent", () => {
			const config = {
				name: "coding",
				description: "Parent coding agent",
				systemPrompt: "You are the parent coding agent",
				subAgents: [
					{
						name: "coding",
						description: "Nested coding worker",
						systemPrompt: "You are a worker",
					},
				],
			};

			const result = validateAgentConfig(config);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain(
					"Sub-agent name must be different from parent agent name",
				);
			}
		});

		it("should fail when sub-agent names are duplicated", () => {
			const config = {
				name: "parent-agent",
				description: "Parent agent",
				systemPrompt: "You are the parent agent",
				subAgents: [
					{
						name: "implementor",
						description: "First implementor",
						systemPrompt: "You implement changes",
					},
					{
						name: "IMPLEMENTOR",
						description: "Duplicate implementor",
						systemPrompt: "You implement more changes",
					},
				],
			};

			const result = validateAgentConfig(config);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain(
					"Sub-agent names must be unique within the same parent agent",
				);
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

		it("should fail validation for invalid reasoning effort", () => {
			const config = {
				name: "test-agent",
				description: "Test",
				systemPrompt: "Test",
				reasoningEffort: "extreme",
			};

			const result = validateAgentConfig(config);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toContain("reasoningEffort");
			}
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

		it("should accept prompt refinement configuration", () => {
			const config = {
				name: "refiner",
				description: "Refines its prompt",
				systemPrompt: "You are a refiner",
				promptRefinement: true,
			};

			const result = validateAgentConfig(config);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.promptRefinement?.enabled).toBe(true);
			}

			const configWithPath = {
				name: "refiner-2",
				description: "Refines its prompt with path",
				systemPrompt: "You are a refiner",
				promptRefinement: {
					instructionsPath: "/memories/agents/refiner-2/instructions.md",
				},
			};

			const resultWithPath = validateAgentConfig(configWithPath);
			expect(resultWithPath.success).toBe(true);
			if (resultWithPath.success) {
				expect(resultWithPath.data.promptRefinement?.instructionsPath).toBe(
					"/memories/agents/refiner-2/instructions.md",
				);
				expect(resultWithPath.data.promptRefinement?.enabled).toBe(true);
			}
		});
	});

	describe("Tool names enum", () => {
		it("should accept all valid tool names", () => {
			const validTools = [
				"internet_search",
				"web_crawler",
				"browser_control",
				"command_execute",
				"background_terminal",
				"think",
				"code_search",
				"git_status",
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
