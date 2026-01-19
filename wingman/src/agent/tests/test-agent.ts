import { agent } from "../../agent/agents/main";

async function runTest() {
	const res = await agent.invoke({
		messages: [
			{
				role: "user",
				content:
					"Go to the following website, and tell me about dynamic tools: https://docs.langchain.com/oss/javascript/langchain/multi-agent/skills?search=skills",
			},
		],
	});

	console.log("Test Result:", res);
}

await runTest();
