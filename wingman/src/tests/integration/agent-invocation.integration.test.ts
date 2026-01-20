import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { AgentLoader } from "../../agent/config/agentLoader";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("Agent Invocation Integration", () => {
	let testDir: string;
	let configDir: string;
	let agentsDir: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `wingman-integration-${Date.now()}`);
		configDir = join(testDir, ".wingman");
		agentsDir = join(configDir, "agents");
		mkdirSync(agentsDir, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe("Agent Loading", () => {
		it("should load agent with tools", () => {
			const agentConfig = {
				name: "test-agent",
				description: "Test agent for integration testing",
				systemPrompt: "You are a test agent",
				tools: ["think", "internet_search"],
			};

			const agentDir = join(agentsDir, "test-agent");
			mkdirSync(agentDir, { recursive: true });
			writeFileSync(
				join(agentDir, "agent.json"),
				JSON.stringify(agentConfig)
			);

			const loader = new AgentLoader(configDir, testDir);
			const agents = loader.loadAllAgentConfigs();

			expect(agents).toHaveLength(1);
			expect(agents[0].name).toBe("test-agent");
			expect(agents[0].tools).toEqual(["think", "internet_search"]);
		});

		it("should load multiple agents", () => {
			const agent1Config = {
				name: "agent1",
				description: "First test agent",
				systemPrompt: "You are agent 1",
				tools: ["think"],
			};

			const agent2Config = {
				name: "agent2",
				description: "Second test agent",
				systemPrompt: "You are agent 2",
				tools: ["internet_search"],
			};

			const agent1Dir = join(agentsDir, "agent1");
			const agent2Dir = join(agentsDir, "agent2");
			mkdirSync(agent1Dir, { recursive: true });
			mkdirSync(agent2Dir, { recursive: true });

			writeFileSync(
				join(agent1Dir, "agent.json"),
				JSON.stringify(agent1Config)
			);
			writeFileSync(
				join(agent2Dir, "agent.json"),
				JSON.stringify(agent2Config)
			);

			const loader = new AgentLoader(configDir, testDir);
			const agents = loader.loadAllAgentConfigs();

			expect(agents).toHaveLength(2);
			expect(agents.map((a) => a.name)).toContain("agent1");
			expect(agents.map((a) => a.name)).toContain("agent2");
		});

		it("should create agent with command_execute tool and safety options", () => {
			const agentConfig = {
				name: "coder-agent",
				description: "Agent with command execution",
				systemPrompt: "You are a coding agent",
				tools: ["command_execute"],
				blockedCommands: ["rm", "sudo"],
				allowScriptExecution: false,
				commandTimeout: 30000,
			};

			const agentDir = join(agentsDir, "coder-agent");
			mkdirSync(agentDir, { recursive: true });
			writeFileSync(
				join(agentDir, "agent.json"),
				JSON.stringify(agentConfig)
			);

			const loader = new AgentLoader(configDir, testDir);
			const agents = loader.loadAllAgentConfigs();

			expect(agents).toHaveLength(1);
			expect(agents[0].name).toBe("coder-agent");
			expect(agents[0].tools).toEqual(["command_execute"]);
			expect(agents[0].blockedCommands).toEqual(["rm", "sudo"]);
			expect(agents[0].allowScriptExecution).toBe(false);
			expect(agents[0].commandTimeout).toBe(30000);
		});

		it("should find specific agent by name", async () => {
			const agentConfig = {
				name: "specific-agent",
				description: "Specific test agent",
				systemPrompt: "You are a specific agent",
			};

			const agentDir = join(agentsDir, "specific-agent");
			mkdirSync(agentDir, { recursive: true });
			writeFileSync(
				join(agentDir, "agent.json"),
				JSON.stringify(agentConfig)
			);

			const loader = new AgentLoader(configDir, testDir);
			const agent = await loader.loadAgent("specific-agent");

			expect(agent).toBeDefined();
			expect(agent?.name).toBe("specific-agent");
		});

		it("should return undefined for non-existent agent", async () => {
			const loader = new AgentLoader(configDir, testDir);
			const agent = await loader.loadAgent("non-existent-agent");

			expect(agent).toBeUndefined();
		});
	});

	describe("Agent Configuration Validation", () => {
		it("should skip agents with invalid configuration", () => {
			const validConfig = {
				name: "valid-agent",
				description: "Valid agent",
				systemPrompt: "You are valid",
			};

			const invalidConfig = {
				name: "invalid-agent",
				// missing required fields
			};

			const validDir = join(agentsDir, "valid-agent");
			const invalidDir = join(agentsDir, "invalid-agent");
			mkdirSync(validDir, { recursive: true });
			mkdirSync(invalidDir, { recursive: true });

			writeFileSync(join(validDir, "agent.json"), JSON.stringify(validConfig));
			writeFileSync(
				join(invalidDir, "agent.json"),
				JSON.stringify(invalidConfig)
			);

			const loader = new AgentLoader(configDir, testDir);
			const agents = loader.loadAllAgentConfigs();

			expect(agents).toHaveLength(1);
			expect(agents[0].name).toBe("valid-agent");
		});

		it("should skip agents with invalid tool names", () => {
			const agentConfig = {
				name: "test-agent",
				description: "Test agent with invalid tool",
				systemPrompt: "You are a test agent",
				tools: ["invalid_tool"],
			};

			const agentDir = join(agentsDir, "test-agent");
			mkdirSync(agentDir, { recursive: true });
			writeFileSync(
				join(agentDir, "agent.json"),
				JSON.stringify(agentConfig)
			);

			const loader = new AgentLoader(configDir, testDir);
			const agents = loader.loadAllAgentConfigs();

			// Agent config validation will fail for invalid tool names
			expect(agents).toHaveLength(0);
		});
	});

	describe("Agent with Model Override", () => {
		it("should support model override", () => {
			const agentConfig = {
				name: "custom-model-agent",
				description: "Agent with custom model",
				systemPrompt: "You are an agent with custom model",
				model: "anthropic:claude-opus-4-5",
			};

			const agentDir = join(agentsDir, "custom-model-agent");
			mkdirSync(agentDir, { recursive: true });
			writeFileSync(
				join(agentDir, "agent.json"),
				JSON.stringify(agentConfig)
			);

			const loader = new AgentLoader(configDir, testDir);
			const agents = loader.loadAllAgentConfigs();

			expect(agents).toHaveLength(1);
			expect(agents[0].name).toBe("custom-model-agent");
			expect(agents[0].model).toBeDefined();
		});
	});

	describe("Subagent Loading", () => {
		it("should load agent with subagents", () => {
			const agentConfig = {
				name: "parent-agent",
				description: "Parent agent with subagents",
				systemPrompt: "You are a parent agent",
				subagents: [
					{
						name: "subagent1",
						description: "First subagent",
						systemPrompt: "You are subagent 1",
						tools: ["think"],
					},
					{
						name: "subagent2",
						description: "Second subagent",
						systemPrompt: "You are subagent 2",
						tools: ["internet_search"],
					},
				],
			};

			const agentDir = join(agentsDir, "parent-agent");
			mkdirSync(agentDir, { recursive: true });
			writeFileSync(
				join(agentDir, "agent.json"),
				JSON.stringify(agentConfig)
			);

			const loader = new AgentLoader(configDir, testDir);
			const agents = loader.loadAllAgentConfigs();

			expect(agents).toHaveLength(1);
			expect(agents[0].name).toBe("parent-agent");
			expect(agents[0].subAgents).toBeDefined();
			expect(agents[0].subAgents?.length).toBe(2);
			expect(agents[0].subAgents?.[0].name).toBe("subagent1");
			expect(agents[0].subAgents?.[1].name).toBe("subagent2");
		});
	});

	describe("Empty Workspace", () => {
		it("should return empty array when no agents exist", () => {
			const loader = new AgentLoader(configDir, testDir);
			const agents = loader.loadAllAgentConfigs();

			expect(agents).toEqual([]);
		});

		it("should return empty array when agents directory doesn't exist", () => {
			rmSync(agentsDir, { recursive: true, force: true });

			const loader = new AgentLoader(configDir, testDir);
			const agents = loader.loadAllAgentConfigs();

			expect(agents).toEqual([]);
		});
	});
});
