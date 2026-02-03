import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { AgentLoader } from "../config/agentLoader";

const testDir = join(process.cwd(), ".test-subagents");
const testAgentsDir = join(testDir, "agents");

// Cleanup function
function cleanup() {
	if (existsSync(testDir)) {
		unlinkSync(join(testAgentsDir, "parent-agent.json"));
		process.chdir(process.cwd());
	}
}

try {
	// Setup test directory
	if (!existsSync(testDir)) {
		mkdirSync(testDir, { recursive: true });
	}
	if (!existsSync(testAgentsDir)) {
		mkdirSync(testAgentsDir, { recursive: true });
	}

	// Test 1: Agent with subagents
	console.log("\n=== Test 1: Agent with subagents ===");
	const agentWithSubagents = {
		name: "parent-agent",
		description: "Parent agent with subagents",
		systemPrompt: "You are a parent agent that delegates to subagents.",
		tools: ["think"],
		subagents: [
			{
				name: "child-1",
				description: "First child agent",
				systemPrompt: "You are child agent 1",
				tools: ["web_crawler"],
			},
			{
				name: "child-2",
				description: "Second child agent",
				systemPrompt: "You are child agent 2",
				tools: ["internet_search"],
			},
		],
	};

	writeFileSync(
		join(testAgentsDir, "parent-agent.json"),
		JSON.stringify(agentWithSubagents, null, 2),
	);

	const loader1 = new AgentLoader(".wingman", testDir);
	const agents1 = loader1.loadAllAgentConfigs();

	console.log(`Loaded ${agents1.length} agent(s)`);
	console.log(`Agent name: ${agents1[0]?.name}`);
	console.log(
		`Agent has subagents: ${(agents1[0] as any)?.subagents ? "Yes" : "No"}`,
	);
	if ((agents1[0] as any)?.subagents) {
		console.log(`Number of subagents: ${(agents1[0] as any).subagents.length}`);
		(agents1[0] as any).subagents.forEach((sub: any, i: number) => {
			console.log(`  Subagent ${i + 1}: ${sub.name} - ${sub.description}`);
			console.log(`    Tools: ${sub.tools?.length || 0}`);
		});
	}

	// Test 2: Validate that subagents cannot have their own subagents
	console.log("\n=== Test 2: Validation - Subagents cannot have subagents ===");
	const invalidAgent = {
		name: "invalid-agent",
		description: "Agent with nested subagents (should fail)",
		systemPrompt: "Invalid config",
		subagents: [
			{
				name: "child",
				description: "Child with its own subagents",
				systemPrompt: "Child agent",
				subagents: [
					{
						name: "grandchild",
						description: "This should fail validation",
						systemPrompt: "Grandchild",
					},
				],
			},
		],
	};

	writeFileSync(
		join(testAgentsDir, "parent-agent.json"),
		JSON.stringify(invalidAgent, null, 2),
	);

	const loader2 = new AgentLoader(".wingman", testDir);
	const agents2 = loader2.loadAllAgentConfigs();

	if (agents2.length === 0) {
		console.log("✓ Validation correctly rejected nested subagents");
	} else {
		console.log("✗ ERROR: Validation should have rejected nested subagents");
		process.exit(1);
	}

	console.log("\n✓ All subagent tests passed!");
	cleanup();
} catch (error) {
	console.error("Test failed:", error);
	cleanup();
	process.exit(1);
}
