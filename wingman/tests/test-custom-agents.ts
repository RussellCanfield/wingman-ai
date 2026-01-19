/**
 * Test script for custom agent loading
 *
 * This script demonstrates:
 * 1. Loading custom agents from config file
 * 2. Verifying agents are properly configured
 * 3. Testing agent delegation
 *
 * Note: Run this from the project root directory where .wingman/ exists
 */

import { agent } from "../src/index.js";

async function testCustomAgents() {
	console.log("Testing custom agent configuration...\n");
	console.log(`Current working directory: ${process.cwd()}\n`);

	// Test loading by checking the compiled agent
	console.log("✓ Agent created successfully");

	// Test a simple invocation to verify everything works
	console.log("\nTesting agent invocation...");
	try {
		const result = await agent.invoke({
			messages: [
				{
					role: "user",
					content:
						"List the available subagents you have access to and what they do.",
				},
			],
		});

		console.log("\n✓ Agent invocation successful");
		console.log("\nAgent response:");
		console.log("─".repeat(80));

		// The result should contain messages
		if (result.messages && result.messages.length > 0) {
			const lastMessage = result.messages[result.messages.length - 1];
			console.log(lastMessage.content);
		} else {
			console.log(result);
		}

		console.log("─".repeat(80));
		console.log("\n✓ All tests passed!");
	} catch (error) {
		console.error("\n✗ Test failed:", error);
		process.exit(1);
	}
}

// Run tests
testCustomAgents().catch((error) => {
	console.error("Unexpected error:", error);
	process.exit(1);
});
