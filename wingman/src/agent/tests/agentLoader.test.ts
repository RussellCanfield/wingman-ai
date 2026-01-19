import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { AgentLoader } from "../config/agentLoader";

const TEST_CONFIG_DIR = ".wingman-test";

describe("AgentConfigLoader", () => {
	beforeEach(() => {
		// Clean up test directory if it exists
		if (existsSync(TEST_CONFIG_DIR)) {
			rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
		}
	});

	afterEach(() => {
		// Clean up after tests
		if (existsSync(TEST_CONFIG_DIR)) {
			rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
		}
	});

	describe("loadAllAgentConfigs", () => {
		it("should return empty array when no config exists", () => {
			const loader = new AgentLoader(TEST_CONFIG_DIR);
			const agents = loader.loadAllAgentConfigs();

			expect(agents).toEqual([]);
		});

		it("should load agents from single config file", () => {
			mkdirSync(TEST_CONFIG_DIR, { recursive: true });

			const config = {
				agents: [
					{
						name: "test-agent",
						description: "A test agent",
						systemPrompt: "You are a test agent",
						tools: ["think"],
					},
				],
			};

			writeFileSync(
				join(TEST_CONFIG_DIR, "agents.config.json"),
				JSON.stringify(config),
			);

			const loader = new AgentLoader(TEST_CONFIG_DIR);
			const agents = loader.loadAllAgentConfigs();

			expect(agents).toHaveLength(1);
			expect(agents[0].name).toBe("test-agent");
			expect(agents[0].description).toBe("A test agent");
			expect(agents[0].systemPrompt).toBe("You are a test agent");
			expect(agents[0].tools).toHaveLength(1);
		});

		it("should load agents from directory of JSON files", () => {
			const agentsDir = join(TEST_CONFIG_DIR, "agents");
			mkdirSync(agentsDir, { recursive: true });

			const agent1 = {
				name: "agent-1",
				description: "First agent",
				systemPrompt: "You are agent 1",
			};

			const agent2 = {
				name: "agent-2",
				description: "Second agent",
				systemPrompt: "You are agent 2",
				tools: ["web_crawler"],
			};

			writeFileSync(join(agentsDir, "agent1.json"), JSON.stringify(agent1));
			writeFileSync(join(agentsDir, "agent2.json"), JSON.stringify(agent2));

			const loader = new AgentLoader(TEST_CONFIG_DIR);
			const agents = loader.loadAllAgentConfigs();

			expect(agents).toHaveLength(2);
			expect(agents[0].name).toBe("agent-1");
			expect(agents[1].name).toBe("agent-2");
			expect(agents[1].tools).toHaveLength(1);
		});

		it("should prioritize single file over directory", () => {
			mkdirSync(TEST_CONFIG_DIR, { recursive: true });
			const agentsDir = join(TEST_CONFIG_DIR, "agents");
			mkdirSync(agentsDir, { recursive: true });

			// Create both single file and directory
			const singleFileConfig = {
				agents: [
					{
						name: "from-single-file",
						description: "From single file",
						systemPrompt: "Single file agent",
					},
				],
			};

			const dirConfig = {
				name: "from-directory",
				description: "From directory",
				systemPrompt: "Directory agent",
			};

			writeFileSync(
				join(TEST_CONFIG_DIR, "agents.config.json"),
				JSON.stringify(singleFileConfig),
			);
			writeFileSync(join(agentsDir, "agent.json"), JSON.stringify(dirConfig));

			const loader = new AgentLoader(TEST_CONFIG_DIR);
			const agents = loader.loadAllAgentConfigs();

			// Should only load from single file
			expect(agents).toHaveLength(1);
			expect(agents[0].name).toBe("from-single-file");
		});

		it("should handle malformed JSON gracefully", () => {
			mkdirSync(TEST_CONFIG_DIR, { recursive: true });

			writeFileSync(
				join(TEST_CONFIG_DIR, "agents.config.json"),
				"{ invalid json",
			);

			const loader = new AgentLoader(TEST_CONFIG_DIR);
			const agents = loader.loadAllAgentConfigs();

			expect(agents).toEqual([]);
		});

		it("should skip invalid agent configs in directory", () => {
			const agentsDir = join(TEST_CONFIG_DIR, "agents");
			mkdirSync(agentsDir, { recursive: true });

			const validAgent = {
				name: "valid-agent",
				description: "Valid agent",
				systemPrompt: "Valid",
			};

			const invalidAgent = {
				name: "invalid-agent",
				// missing required fields
			};

			writeFileSync(join(agentsDir, "valid.json"), JSON.stringify(validAgent));
			writeFileSync(
				join(agentsDir, "invalid.json"),
				JSON.stringify(invalidAgent),
			);

			const loader = new AgentLoader(TEST_CONFIG_DIR);
			const agents = loader.loadAllAgentConfigs();

			// Should only load valid agent
			expect(agents).toHaveLength(1);
			expect(agents[0].name).toBe("valid-agent");
		});

		it("should create agent with model override", () => {
			mkdirSync(TEST_CONFIG_DIR, { recursive: true });

			const config = {
				agents: [
					{
						name: "custom-model-agent",
						description: "Agent with custom model",
						systemPrompt: "You are a custom agent",
						model: "anthropic:claude-opus-4-5",
					},
				],
			};

			writeFileSync(
				join(TEST_CONFIG_DIR, "agents.config.json"),
				JSON.stringify(config),
			);

			const loader = new AgentLoader(TEST_CONFIG_DIR);
			const agents = loader.loadAllAgentConfigs();

			expect(agents).toHaveLength(1);
			expect(agents[0].model).toBeDefined();
		});

		it("should create agent with command_execute tool and custom options", () => {
			mkdirSync(TEST_CONFIG_DIR, { recursive: true });

			const config = {
				agents: [
					{
						name: "executor-agent",
						description: "Executes commands",
						systemPrompt: "You execute commands",
						tools: ["command_execute"],
						blockedCommands: ["rm", "mv"],
						allowScriptExecution: false,
						commandTimeout: 60000,
					},
				],
			};

			writeFileSync(
				join(TEST_CONFIG_DIR, "agents.config.json"),
				JSON.stringify(config),
			);

			const loader = new AgentLoader(TEST_CONFIG_DIR);
			const agents = loader.loadAllAgentConfigs();

			expect(agents).toHaveLength(1);
			expect(agents[0].tools).toHaveLength(1);
			expect(agents[0].tools?.[0]).toBe("command_execute");
		});

		it("should ignore non-JSON files in directory", () => {
			const agentsDir = join(TEST_CONFIG_DIR, "agents");
			mkdirSync(agentsDir, { recursive: true });

			const validAgent = {
				name: "valid-agent",
				description: "Valid",
				systemPrompt: "Valid",
			};

			writeFileSync(join(agentsDir, "valid.json"), JSON.stringify(validAgent));
			writeFileSync(join(agentsDir, "readme.md"), "# README");
			writeFileSync(join(agentsDir, "notes.txt"), "Some notes");

			const loader = new AgentLoader(TEST_CONFIG_DIR);
			const agents = loader.loadAllAgentConfigs();

			expect(agents).toHaveLength(1);
			expect(agents[0].name).toBe("valid-agent");
		});
	});
});
