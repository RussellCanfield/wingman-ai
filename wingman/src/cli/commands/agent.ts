import type { AgentCommandArgs } from "../types.js";
import { AgentInvoker } from "../core/agentInvoker.js";
import { OutputManager } from "../core/outputManager.js";
import { SessionManager } from "../core/sessionManager.js";
import { createBridgedLogger } from "../core/loggerBridge.js";
import { createLogger } from "@/logger.js";
import { join } from "node:path";
import { processStreamChunk } from "../core/streamParser.js";

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

	// In interactive mode, listen for streaming output and display it
	if (args.outputMode === "interactive") {
		// Track displayed message IDs to avoid duplicates
		const displayedMessages = new Set<string>();

		outputManager.on("output-event", (event: any) => {
			if (event.type === "agent-stream") {
				// Get messages from the same locations the parser checks
				const chunk = event.chunk || {};
				const messages =
					chunk.model_request?.messages ||
					chunk.agent?.messages ||
					chunk.messages;

				if (Array.isArray(messages) && messages.length > 0) {
					// Find the last AIMessage and check for duplicates
					for (let i = messages.length - 1; i >= 0; i--) {
						const msg = messages[i];
						const messageType = msg.id?.[2] || msg.type;

						if (messageType === "AIMessage") {
							// Get the unique message ID
							const messageId =
								msg.kwargs?.id ||
								(Array.isArray(msg.id) ? msg.id.join("-") : msg.id);

							// Skip if we've already displayed this message
							if (messageId && displayedMessages.has(messageId)) {
								return;
							}

							// Mark as displayed
							if (messageId) {
								displayedMessages.add(messageId);
							}
							break;
						}
					}
				}

				// Parse and display stream chunks
				const displayText = processStreamChunk(event.chunk);
				if (displayText) {
					process.stdout.write(displayText);
				}
			} else if (event.type === "agent-error") {
				console.error(`\n❌ Error: ${event.error}`);
			}
		});
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

		// In interactive mode, handle output completion
		if (outputManager.getMode() === "interactive") {
			if (result.streaming) {
				// Add newline after streaming output
				console.log();
			} else {
				// Display the full result for non-streaming
				console.log("\n--- Agent Response ---");
				console.log(JSON.stringify(result, null, 2));
			}
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
