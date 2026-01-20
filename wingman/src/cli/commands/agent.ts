import type { AgentCommandArgs } from "../types.js";
import { AgentInvoker } from "../core/agentInvoker.js";
import { OutputManager } from "../core/outputManager.js";
import { createBridgedLogger } from "../core/loggerBridge.js";
import { createLogger } from "@/logger.js";

export interface AgentCommandOptions {
	workspace?: string;
	configDir?: string;
}

/**
 * Execute the agent command
 * This is the handler for: wingman agent --agent <name> <prompt>
 */
export async function executeAgentCommand(
	args: AgentCommandArgs,
	options: AgentCommandOptions = {},
): Promise<void> {
	// Create output manager
	const outputManager = new OutputManager(args.outputMode);

	// Create bridged logger
	const logger = createLogger(args.verbosity); //createBridgedLogger(outputManager, args.verbosity);

	// Create agent invoker
	const invoker = new AgentInvoker({
		workspace: options.workspace,
		configDir: options.configDir,
		outputManager,
		logger,
	});

	try {
		// If no agent specified, list available agents
		if (!args.agent) {
			const agents = invoker.listAgents();

			if (outputManager.getMode() === "interactive") {
				console.log("\nAvailable agents:");
				for (const agent of agents) {
					console.log(`  ${agent.name}: ${agent.description}`);
				}
				console.log('\nUsage: wingman agent --agent <name> "your prompt here"');
			} else {
				// JSON mode
				outputManager.emitEvent({
					type: "agent-error",
					error: "No agent specified",
					timestamp: new Date().toISOString(),
				});
			}
			process.exit(1);
		}

		// Invoke the agent
		const result = await invoker.invokeAgent(args.agent, args.prompt);

		// In interactive mode, display the result
		if (outputManager.getMode() === "interactive") {
			console.log("\n--- Agent Response ---");
			console.log(JSON.stringify(result, null, 2));
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);

		if (outputManager.getMode() === "interactive") {
			console.error(`\nError: ${errorMsg}`);
			process.exit(1);
		} else {
			outputManager.emitAgentError(error as Error);
			process.exit(1);
		}
	}
}
