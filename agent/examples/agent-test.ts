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
		backgroundAgentConfig: {
			pushToRemote: true, // Enable remote push for this test
			createPullRequest: true, // Enable PR creation for this test
			pullRequestTitle: "Wingman-AI Background Agent: {agentName}",
			pullRequestBody:
				"This pull request was automatically created by Wingman-AI Background Agent: **{agentName}**\n\n## Task\n{input}\n\n## Changed Files\n{changedFiles}",
		},
		workingDirectory: process.cwd(),
		mode: "vibe",
	});

	await agent.initialize();

	await agent.invoke({
		input:
			"Use a background agent and create a readme with 'TODO' as the contents under examples/app",
		threadId: "1",
	});

	console.log("\n🎯 Intelligent Orchestration Testing Complete!");
}

// Run the example
if (require.main === module) {
	runIntelligentOrchestrationExample().catch(console.error);
}

export { runIntelligentOrchestrationExample };
