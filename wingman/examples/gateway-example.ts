/**
 * Example: Using the Wingman Gateway for AI Agent Swarming
 * 
 * This example demonstrates:
 * 1. Starting a gateway server
 * 2. Connecting multiple nodes
 * 3. Creating broadcast groups
 * 4. Sending messages between nodes
 */

import { GatewayServer, GatewayClient } from "../src/gateway/index.js";

async function runExample() {
	console.log("🚀 Wingman Gateway Example\n");

	// 1. Start the gateway server
	console.log("1. Starting gateway server...");
	const server = new GatewayServer({
		port: 3001,
		host: "localhost",
		requireAuth: false,
		logLevel: "info",
	});

	await server.start();
	console.log("✓ Gateway started on ws://localhost:3001/ws\n");

	// Wait a bit for server to be ready
	await new Promise((resolve) => setTimeout(resolve, 1000));

	// 2. Create multiple client nodes
	console.log("2. Creating client nodes...");

	const agent1 = new GatewayClient("ws://localhost:3001/ws", "Agent-1", {
		capabilities: ["research", "analysis"],
		events: {
			connected: () => console.log("  Agent-1: Connected"),
			registered: (nodeId, name) =>
				console.log(`  Agent-1: Registered as ${name} (${nodeId})`),
			joinedGroup: (groupId, groupName) =>
				console.log(`  Agent-1: Joined group ${groupName}`),
			broadcast: (message: any, fromNodeId, groupId) => {
				console.log(
					`  Agent-1: Received broadcast from ${fromNodeId}:`,
					message,
				);
			},
			direct: (message: any, fromNodeId) => {
				console.log(`  Agent-1: Received direct message from ${fromNodeId}:`, message);
			},
		},
	});

	const agent2 = new GatewayClient("ws://localhost:3001/ws", "Agent-2", {
		capabilities: ["coding", "testing"],
		events: {
			connected: () => console.log("  Agent-2: Connected"),
			registered: (nodeId, name) =>
				console.log(`  Agent-2: Registered as ${name} (${nodeId})`),
			joinedGroup: (groupId, groupName) =>
				console.log(`  Agent-2: Joined group ${groupName}`),
			broadcast: (message: any, fromNodeId, groupId) => {
				console.log(
					`  Agent-2: Received broadcast from ${fromNodeId}:`,
					message,
				);
			},
			direct: (message: any, fromNodeId) => {
				console.log(`  Agent-2: Received direct message from ${fromNodeId}:`, message);
			},
		},
	});

	const agent3 = new GatewayClient("ws://localhost:3001/ws", "Agent-3", {
		capabilities: ["review", "documentation"],
		events: {
			connected: () => console.log("  Agent-3: Connected"),
			registered: (nodeId, name) =>
				console.log(`  Agent-3: Registered as ${name} (${nodeId})`),
			joinedGroup: (groupId, groupName) =>
				console.log(`  Agent-3: Joined group ${groupName}`),
			broadcast: (message: any, fromNodeId, groupId) => {
				console.log(
					`  Agent-3: Received broadcast from ${fromNodeId}:`,
					message,
				);
			},
			direct: (message: any, fromNodeId) => {
				console.log(`  Agent-3: Received direct message from ${fromNodeId}:`, message);
			},
		},
	});

	// Connect all agents
	await Promise.all([agent1.connect(), agent2.connect(), agent3.connect()]);

	console.log("\n3. Joining broadcast group...");
	await new Promise((resolve) => setTimeout(resolve, 500));

	// Join the same group
	await agent1.joinGroup("project-alpha", { createIfNotExists: true });
	await agent2.joinGroup("project-alpha", { createIfNotExists: true });
	await agent3.joinGroup("project-alpha", { createIfNotExists: true });

	await new Promise((resolve) => setTimeout(resolve, 500));

	// 4. Send broadcast messages
	console.log("\n4. Broadcasting messages...");
	await new Promise((resolve) => setTimeout(resolve, 500));

	agent1.broadcast("project-alpha", {
		type: "task",
		message: "I'll research the requirements",
		from: "Agent-1",
	});

	await new Promise((resolve) => setTimeout(resolve, 500));

	agent2.broadcast("project-alpha", {
		type: "task",
		message: "I'll handle the implementation",
		from: "Agent-2",
	});

	await new Promise((resolve) => setTimeout(resolve, 500));

	agent3.broadcast("project-alpha", {
		type: "task",
		message: "I'll review and document",
		from: "Agent-3",
	});

	await new Promise((resolve) => setTimeout(resolve, 1000));

	// 5. Send direct message
	console.log("\n5. Sending direct message...");
	const agent2Id = agent2.getNodeId();
	if (agent2Id) {
		agent1.sendDirect(agent2Id, {
			type: "question",
			message: "Can you help with the API integration?",
			from: "Agent-1",
		});
	}

	await new Promise((resolve) => setTimeout(resolve, 1000));

	// 6. Check health
	console.log("\n6. Checking gateway health...");
	const healthResponse = await fetch("http://localhost:3001/health");
	const health = await healthResponse.json();
	console.log("  Gateway Health:", JSON.stringify(health, null, 2));

	// 7. Cleanup
	console.log("\n7. Cleaning up...");
	await new Promise((resolve) => setTimeout(resolve, 1000));

	agent1.disconnect();
	agent2.disconnect();
	agent3.disconnect();

	await new Promise((resolve) => setTimeout(resolve, 500));

	await server.stop();

	console.log("\n✓ Example completed!");
	process.exit(0);
}

// Run the example
runExample().catch((error) => {
	console.error("Error running example:", error);
	process.exit(1);
});
