import React from "react";
import { render } from "ink";
import type { AgentCommandArgs } from "../types.js";
import { AgentInvoker } from "../core/agentInvoker.js";
import { OutputManager } from "../core/outputManager.js";
import { SessionManager } from "../core/sessionManager.js";
import { createLogger, getLogFilePath } from "@/logger.js";
import { join } from "node:path";
import { App } from "../ui/App.js";

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

	// Render Ink UI in interactive mode
	let inkInstance: any;
	if (args.outputMode === "interactive") {
		inkInstance = render(React.createElement(App, { outputManager }));
	}

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
			const logFile = getLogFilePath();
			logger.error("No agent specified");

			if (outputManager.getMode() === "interactive") {
				console.log("\nAvailable agents:");
				for (const agent of agents) {
					console.log(`  ${agent.name}: ${agent.description}`);
				}
				console.log('\nUsage: wingman agent --agent <name> "your prompt here"');
				console.error(`\nLogs: ${logFile}`);
			} else {
				// JSON mode
				outputManager.emitEvent({
					type: "agent-error",
					error: "No agent specified",
					logFile,
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

		// Close session manager
		sessionManager.close();

		// Unmount Ink UI in interactive mode
		if (inkInstance) {
			inkInstance.unmount();
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		const logFile = getLogFilePath();
		logger.error("Agent command failed", { error: errorMsg });

		sessionManager.close();

		// Unmount Ink UI before error handling
		if (inkInstance) {
			inkInstance.unmount();
		}

		if (outputManager.getMode() === "interactive") {
			console.error(`\nError: ${errorMsg}`);
			console.error(`Logs: ${logFile}`);
			process.exit(1);
		} else {
			outputManager.emitAgentError(error as Error);
			process.exit(1);
		}
	}
}
