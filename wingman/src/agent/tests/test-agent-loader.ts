import { AgentLoader } from "../config/agentLoader";

// Test loading agents
const loader = new AgentLoader(".wingman", process.cwd());
const agents = loader.loadAllAgentConfigs();

console.log(`Loaded ${agents.length} agents:`);
agents.forEach((agent: any) => {
	console.log(`  - ${agent.name}: ${agent.description}`);
	console.log(`    Tools: ${agent.tools?.length || 0}`);
	console.log(`    Model: ${agent.model ? "Custom" : "Default"}`);
});

// Check that all expected built-in agents are loaded
const expectedAgents = [
	"researcher",
	"coding",
	"planner",
	"implementor",
	"reviewer",
];
const loadedAgentNames = agents.map((a: any) => a.name);

console.log("\nExpected agents check:");
expectedAgents.forEach((name) => {
	const found = loadedAgentNames.includes(name);
	console.log(`  ${found ? "✓" : "✗"} ${name}`);
});

if (agents.length !== expectedAgents.length) {
	console.error(
		`\nERROR: Expected ${expectedAgents.length} agents, but loaded ${agents.length}`,
	);
	process.exit(1);
}

console.log("\n✓ All tests passed!");
