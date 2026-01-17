import "../src/fetch";
import { WingmanAgent } from "../src/agent";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatXAI } from "@langchain/xai";

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
		model: new ChatXAI({
			model: "grok-4",
			temperature: 0,
		}),
		backgroundAgentConfig: {
			pushToRemote: false,
			createPullRequest: false,
			pullRequestTitle: "Wingman-AI Background Agent: {agentName}",
			pullRequestBody:
				"This pull request was automatically created by Wingman-AI Background Agent: **{agentName}**\n\n## Task\n{input}\n\n## Changed Files\n{changedFiles}",
		},
		workingDirectory: process.cwd(),
		mode: "vibe",
	});

	await agent.initialize();

	const response = await agent.invoke({
		input:
			//"Use a background agent and create a readme with 'TODO' as the contents under examples/app",
			`Find and fix the bug(s) in the caching system implementation for user data with TTL. 	
Its located in the agent/examples/test-file.ts
Ensure it meets the expected behavior of storing user data with expiration times, removing expired entries, maintaining a maximum size limit, and optimizing performance for frequent reads.`,
		threadId: "1",
	});

	console.log("\n🎯 Intelligent Orchestration Testing Complete!", response);
}

// Run the example
if (require.main === module) {
	runIntelligentOrchestrationExample().catch(console.error);
}

export { runIntelligentOrchestrationExample };
