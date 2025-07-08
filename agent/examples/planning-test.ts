import { WingmanAgent } from "../src/agent";
import { ChatAnthropic } from "@langchain/anthropic";

async function testPlanningOrchestration() {
	console.log("🧪 Testing Planning + Orchestration Workflow");

	// Create agent with Anthropic model
	const agent = new WingmanAgent({
		name: "test-agent",
		model: new ChatAnthropic({
			model: "claude-3-5-sonnet-20241022",
			apiKey: process.env.ANTHROPIC_API_KEY,
		}),
		workingDirectory: process.cwd(),
		mode: "vibe",
	});

	await agent.initialize();

	console.log("✅ Agent initialized successfully");

	// Test the planning workflow
	console.log("\n📋 Testing task planning...");
	
	try {
		const planningResult = await agent.invoke({
			input: "I need to create a simple TypeScript utility library with unit tests and documentation. The library should have a few utility functions for string manipulation.",
			threadId: "test-planning-" + Date.now(),
		});

		console.log("✅ Planning test completed");
		console.log("Result:", JSON.stringify(planningResult, null, 2));

	} catch (error) {
		console.error("❌ Planning test failed:", error);
	}
}

// Run the test if this file is executed directly
if (require.main === module) {
	testPlanningOrchestration().catch(console.error);
}

export { testPlanningOrchestration };