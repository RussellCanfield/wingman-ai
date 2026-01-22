import type { AgentCommandArgs } from "../types.js";
import { AgentInvoker } from "../core/agentInvoker.js";
import { OutputManager } from "../core/outputManager.js";
import { SessionManager } from "../core/sessionManager.js";
import { createBridgedLogger } from "../core/loggerBridge.js";
import { createLogger } from "@/logger.js";
import { join } from "node:path";

export interface AgentCommandOptions {
	workspace?: string;
	configDir?: string;
	sessionId?: string; // Optional session ID for resumption
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

	// Initialize session manager
	const workspace = options.workspace || process.cwd();
	const configDir = options.configDir || ".wingman";
	const dbPath = join(workspace, configDir, "wingman.db");

	const sessionManager = new SessionManager(dbPath);
	await sessionManager.initialize();

	// Create agent invoker with session manager
	const invoker = new AgentInvoker({
		workspace,
		configDir,
		outputManager,
		logger,
		sessionManager,
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
			sessionManager.close();
			process.exit(1);
		}

		// Get or create session
		let sessionId = options.sessionId;
		if (!sessionId) {
			// Try to get last session, or create new one
			const lastSession = sessionManager.getLastSession();
			if (lastSession && lastSession.agentName === args.agent) {
				sessionId = lastSession.id;
				logger.debug(`Resuming session: ${sessionId}`);
			} else {
				// Create new session
				const newSession = sessionManager.createSession(args.agent);
				sessionId = newSession.id;
				logger.info(`Created new session: ${sessionId}`);
			}
		}

		// Update session metadata
		sessionManager.updateSession(sessionId, {
			lastMessagePreview: args.prompt.substring(0, 200),
		});

		// Invoke the agent with session
		const result = await invoker.invokeAgent(args.agent, args.prompt, sessionId);

		// Update session after completion
		const session = sessionManager.getSession(sessionId);
		if (session) {
			sessionManager.updateSession(sessionId, {
				messageCount: session.messageCount + 1,
			});
		}

		// In interactive mode, display the result (if not streaming)
		if (outputManager.getMode() === "interactive" && !result.streaming) {
			console.log("\n--- Agent Response ---");
			console.log(JSON.stringify(result, null, 2));
		}

		// Close session manager
		sessionManager.close();
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);

		sessionManager.close();

		if (outputManager.getMode() === "interactive") {
			console.error(`\nError: ${errorMsg}`);
			process.exit(1);
		} else {
			outputManager.emitAgentError(error as Error);
			process.exit(1);
		}
	}
}
