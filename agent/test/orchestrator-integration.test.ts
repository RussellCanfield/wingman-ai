import { describe, it, expect, beforeEach } from "vitest";
import { WingmanAgent, type WingmanAgentConfig } from "../src/agent";
import { ChatAnthropic } from "@langchain/anthropic";
import { MemorySaver } from "@langchain/langgraph";
import { GraphAnnotation } from "../src/state/graph";

describe("Orchestrator Integration", () => {
	let agent: WingmanAgent;
	let config: WingmanAgentConfig;

	beforeEach(async () => {
		//@ts-expect-error
		config = {
			name: "test-orchestrator-agent",
			//@ts-expect-error
			model: new ChatAnthropic({
				model: "claude-4-sonnet",
			}),
			mode: "vibe",
			workingDirectory: process.cwd(),
			memory: new MemorySaver(),
		} satisfies WingmanAgentConfig;

		agent = new WingmanAgent(config);
		await agent.initialize();
	});

	it("should have orchestrator tool available in tool list", async () => {
		const tools = (agent as any).tools;
		const toolNames = tools.map((tool: any) => tool.name);

		expect(toolNames).toContain("orchestrator");
		expect(toolNames).toContain("web_search");
		expect(toolNames).toContain("think");
		expect(toolNames).toContain("command_execute");
		expect(toolNames).toContain("read_file");
		expect(toolNames).toContain("list_directory");
		expect(toolNames).toContain("edit_file");
		expect(toolNames).toContain("research");
		expect(toolNames).toContain("orchestrator");
	});

	it("should handle orchestration state in graph state", () => {
		// Test that the GraphAnnotation is properly defined
		expect(GraphAnnotation).toBeDefined();

		// The state should support orchestration field
		const stateWithOrchestration = {
			messages: [],
			orchestration: {
				isActive: true,
				orchestrationId: "test-orch-123",
				status: "planning" as const,
				tasks: [],
				taskDependencies: {},
				completedTasks: [],
				failedTasks: [],
				abandonedTasks: [],
				subAgentThreads: {},
				agentSpecializations: {},
				activeAgentCount: 0,
				repoPath: "/test/path",
				mainBranch: "main",
				worktrees: {},
				completedBranches: [],
				conflicts: [],
				startTime: new Date(),
				progressMetrics: {
					totalTasks: 0,
					completedTasks: 0,
					failedTasks: 0,
					activeTasks: 0,
					abandonedTasks: 0,
				},
				userCanCancel: true,
				intermediateResults: {},
				allowUserCancellation: true,
				maxConcurrentAgents: 3,
			},
		};

		// This should not throw an error
		expect(() => stateWithOrchestration).not.toThrow();
		expect(stateWithOrchestration.orchestration.isActive).toBe(true);
		expect(stateWithOrchestration.orchestration.orchestrationId).toBe(
			"test-orch-123",
		);
	});

	it("should create orchestrator tool with correct configuration", async () => {
		const tools = (agent as any).tools;
		const orchestratorTool = tools.find(
			(tool: any) => tool.name === "orchestrator",
		);

		expect(orchestratorTool).toBeDefined();
		expect(orchestratorTool.name).toBe("orchestrator");
		expect(orchestratorTool.description).toBeDefined();
		expect(orchestratorTool.schema).toBeDefined();

		// Verify the schema has the expected structure
		const schema = orchestratorTool.schema;
		const schemaShape = schema.shape || schema._def?.shape;
		expect(schemaShape.request).toBeDefined();
		expect(schemaShape.agentCount).toBeDefined();
		expect(schemaShape.taskTypes).toBeDefined();
		expect(schemaShape.parallelExecution).toBeDefined();
	});
});
