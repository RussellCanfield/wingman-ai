import "../src/fetch";
import { WingmanAgent } from "../src/agent";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

async function runIntelligentOrchestrationExample() {
	console.log("🧠 Testing Intelligent Orchestration Decision Making");
	console.log("=".repeat(70));

	// Create a WingmanAgent (no execution mode needed)
	const agent = new WingmanAgent({
		name: "IntelligentAgent",
		// model: new ChatGoogleGenerativeAI({
		// 	model: "gemini-2.5-pro",
		// 	temperature: 0,
		// }),
		model: new ChatAnthropic({
			model: "claude-sonnet-4-0",
			temperature: 0,
		}),
		workingDirectory: process.cwd(),
		mode: "vibe",
	});

	await agent.initialize();

	await agent.invoke({
		input:
			"Use a background agent, and create a README file with 'hello world' under 'examples/app'",
		threadId: "1",
	});

	console.log("\n🎯 Intelligent Orchestration Testing Complete!");
}

// Run the example
if (require.main === module) {
	runIntelligentOrchestrationExample().catch(console.error);
}

export { runIntelligentOrchestrationExample };
