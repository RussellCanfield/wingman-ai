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

		it("should load agent from a single agent directory", () => {
			const agentDir = join(TEST_CONFIG_DIR, "agents", "test-agent");
			mkdirSync(agentDir, { recursive: true });

			const config = {
				name: "test-agent",
				description: "A test agent",
				systemPrompt: "You are a test agent",
				tools: ["think"],
			};

			writeFileSync(join(agentDir, "agent.json"), JSON.stringify(config));

			const loader = new AgentLoader(TEST_CONFIG_DIR);
			const agents = loader.loadAllAgentConfigs();

			expect(agents).toHaveLength(1);
			expect(agents[0].name).toBe("test-agent");
			expect(agents[0].description).toBe("A test agent");
			expect(agents[0].systemPrompt).toBe("You are a test agent");
			expect(agents[0].tools).toHaveLength(1);
		});

		it("should load agents from a directory of agent.json files", () => {
			const agent1Dir = join(TEST_CONFIG_DIR, "agents", "agent-1");
			const agent2Dir = join(TEST_CONFIG_DIR, "agents", "agent-2");
			mkdirSync(agent1Dir, { recursive: true });
			mkdirSync(agent2Dir, { recursive: true });

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

			writeFileSync(join(agent1Dir, "agent.json"), JSON.stringify(agent1));
			writeFileSync(join(agent2Dir, "agent.json"), JSON.stringify(agent2));

			const loader = new AgentLoader(TEST_CONFIG_DIR);
			const agents = loader.loadAllAgentConfigs();

			expect(agents).toHaveLength(2);
			expect(agents.map((agent) => agent.name)).toContain("agent-1");
			expect(agents.map((agent) => agent.name)).toContain("agent-2");
			const agentWithTools = agents.find((agent) => agent.name === "agent-2");
			expect(agentWithTools?.tools).toHaveLength(1);
		});

		it("should prioritize agent.json over agent.md", () => {
			const agentDir = join(TEST_CONFIG_DIR, "agents", "mixed-agent");
			mkdirSync(agentDir, { recursive: true });

			const jsonConfig = {
				name: "from-json",
				description: "From JSON",
				systemPrompt: "JSON agent",
			};

			const markdownConfig = `---
name: from-markdown
description: From Markdown
---
Markdown agent`;

			writeFileSync(join(agentDir, "agent.json"), JSON.stringify(jsonConfig));
			writeFileSync(join(agentDir, "agent.md"), markdownConfig);

			const loader = new AgentLoader(TEST_CONFIG_DIR);
			const agents = loader.loadAllAgentConfigs();

			expect(agents).toHaveLength(1);
			expect(agents[0].name).toBe("from-json");
		});

		it("should handle malformed JSON gracefully", () => {
			const agentDir = join(TEST_CONFIG_DIR, "agents", "bad-agent");
			mkdirSync(agentDir, { recursive: true });

			writeFileSync(join(agentDir, "agent.json"), "{ invalid json");

			const loader = new AgentLoader(TEST_CONFIG_DIR);
			const agents = loader.loadAllAgentConfigs();

			expect(agents).toEqual([]);
		});

		it("should skip invalid agent configs in directory", () => {
			const validDir = join(TEST_CONFIG_DIR, "agents", "valid-agent");
			const invalidDir = join(TEST_CONFIG_DIR, "agents", "invalid-agent");
			mkdirSync(validDir, { recursive: true });
			mkdirSync(invalidDir, { recursive: true });

			const validAgent = {
				name: "valid-agent",
				description: "Valid agent",
				systemPrompt: "Valid",
			};

			const invalidAgent = {
				name: "invalid-agent",
				// missing required fields
			};

			writeFileSync(join(validDir, "agent.json"), JSON.stringify(validAgent));
			writeFileSync(join(invalidDir, "agent.json"), JSON.stringify(invalidAgent));

			const loader = new AgentLoader(TEST_CONFIG_DIR);
			const agents = loader.loadAllAgentConfigs();

			// Should only load valid agent
			expect(agents).toHaveLength(1);
			expect(agents[0].name).toBe("valid-agent");
		});

		it("should create agent with model override", () => {
			const config = {
				name: "custom-model-agent",
				description: "Agent with custom model",
				systemPrompt: "You are a custom agent",
				model: "anthropic:claude-opus-4-5",
			};

			const agentDir = join(TEST_CONFIG_DIR, "agents", "custom-model-agent");
			mkdirSync(agentDir, { recursive: true });
			writeFileSync(join(agentDir, "agent.json"), JSON.stringify(config));

			const loader = new AgentLoader(TEST_CONFIG_DIR);
			const agents = loader.loadAllAgentConfigs();

			expect(agents).toHaveLength(1);
			expect(agents[0].model).toBeDefined();
		});

		it("should create agent with command_execute tool and custom options", () => {
			const config = {
				name: "executor-agent",
				description: "Executes commands",
				systemPrompt: "You execute commands",
				tools: ["command_execute"],
				blockedCommands: ["rm", "mv"],
				allowScriptExecution: false,
				commandTimeout: 60000,
			};

			const agentDir = join(TEST_CONFIG_DIR, "agents", "executor-agent");
			mkdirSync(agentDir, { recursive: true });
			writeFileSync(join(agentDir, "agent.json"), JSON.stringify(config));

			const loader = new AgentLoader(TEST_CONFIG_DIR);
			const agents = loader.loadAllAgentConfigs();

			expect(agents).toHaveLength(1);
			expect(agents[0].tools).toHaveLength(1);
			expect(agents[0].tools?.[0]).toBe("command_execute");
		});

		it("should ignore non-JSON files in directory", () => {
			const agentDir = join(TEST_CONFIG_DIR, "agents", "valid-agent");
			mkdirSync(agentDir, { recursive: true });

			const validAgent = {
				name: "valid-agent",
				description: "Valid",
				systemPrompt: "Valid",
			};

			writeFileSync(join(agentDir, "agent.json"), JSON.stringify(validAgent));
			writeFileSync(join(agentDir, "readme.md"), "# README");
			writeFileSync(join(agentDir, "notes.txt"), "Some notes");

			const loader = new AgentLoader(TEST_CONFIG_DIR);
			const agents = loader.loadAllAgentConfigs();

			expect(agents).toHaveLength(1);
			expect(agents[0].name).toBe("valid-agent");
		});
	});

	describe("loadAgent", () => {
		it("should hydrate subagent tools for runtime use", async () => {
			const agentDir = join(TEST_CONFIG_DIR, "agents", "parent-agent");
			mkdirSync(agentDir, { recursive: true });

			const config = {
				name: "parent-agent",
				description: "Parent agent",
				systemPrompt: "You are the parent",
				subAgents: [
					{
						name: "researcher",
						description: "Research subagent",
						systemPrompt: "You research things",
						tools: ["think"],
					},
				],
			};

			writeFileSync(join(agentDir, "agent.json"), JSON.stringify(config));

			const loader = new AgentLoader(TEST_CONFIG_DIR);
			const agent = await loader.loadAgent("parent-agent");

			expect(agent).toBeDefined();
			expect(agent?.subagents).toBeDefined();
			expect(agent?.subagents?.length).toBe(1);
			const sub = agent?.subagents?.[0] as any;
			expect(Array.isArray(sub.tools)).toBe(true);
			expect(sub.tools?.[0]).toHaveProperty("name", "think");
		});
	});
});
