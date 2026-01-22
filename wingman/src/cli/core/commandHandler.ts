import type { SessionManager, Session } from "./sessionManager.js";
import type { Logger } from "@/logger.js";

export interface CommandResult {
	type: "text" | "sessions" | "error" | "help";
	data?: any;
	message?: string;
}

export interface CommandHandlerOptions {
	sessionManager: SessionManager;
	currentSessionId: string | null;
	logger: Logger;
}

/**
 * CommandHandler processes in-chat slash commands
 * Commands: /sessions, /resume, /clear, /show, /help
 */
export class CommandHandler {
	private sessionManager: SessionManager;
	private currentSessionId: string | null;
	private logger: Logger;

	constructor(options: CommandHandlerOptions) {
		this.sessionManager = options.sessionManager;
		this.currentSessionId = options.currentSessionId;
		this.logger = options.logger;
	}

	/**
	 * Check if input is a command (starts with /)
	 */
	isCommand(input: string): boolean {
		return input.trim().startsWith("/");
	}

	/**
	 * Parse and execute a command
	 */
	async executeCommand(input: string): Promise<CommandResult> {
		const trimmed = input.trim();
		const parts = trimmed.split(/\s+/);
		const command = parts[0].toLowerCase();
		const args = parts.slice(1);

		this.logger.debug(`Executing command: ${command} with args: ${args.join(" ")}`);

		switch (command) {
			case "/sessions":
				return this.handleSessions(args);

			case "/resume":
				return this.handleResume(args);

			case "/clear":
				return this.handleClear(args);

			case "/show":
				return this.handleShow(args);

			case "/help":
				return this.handleHelp();

			case "/archive":
				return this.handleArchive(args);

			default:
				return {
					type: "error",
					message: `Unknown command: ${command}\nType /help for available commands.`,
				};
		}
	}

	/**
	 * List recent sessions
	 */
	private handleSessions(args: string[]): CommandResult {
		try {
			const limit = args[0] ? parseInt(args[0], 10) : 10;
			const sessions = this.sessionManager.listSessions({
				status: "active",
				limit: Math.min(limit, 50), // Cap at 50
			});

			return {
				type: "sessions",
				data: sessions,
				message: `Found ${sessions.length} active session(s)`,
			};
		} catch (error) {
			this.logger.error(`Failed to list sessions: ${error}`);
			return {
				type: "error",
				message: `Failed to list sessions: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	}

	/**
	 * Resume a specific session by ID
	 */
	private handleResume(args: string[]): CommandResult {
		if (args.length === 0) {
			return {
				type: "error",
				message: "Usage: /resume <session-id>\nUse /sessions to see available sessions.",
			};
		}

		const sessionId = args[0];

		try {
			const session = this.sessionManager.getSession(sessionId);

			if (!session) {
				return {
					type: "error",
					message: `Session not found: ${sessionId}`,
				};
			}

			if (session.status !== "active") {
				return {
					type: "error",
					message: `Session ${sessionId} is ${session.status}. Only active sessions can be resumed.`,
				};
			}

			// Update current session
			this.currentSessionId = sessionId;

			return {
				type: "text",
				data: { sessionId, session },
				message: `Resumed session: ${session.name}\nAgent: ${session.agentName}\nMessages: ${session.messageCount}`,
			};
		} catch (error) {
			this.logger.error(`Failed to resume session: ${error}`);
			return {
				type: "error",
				message: `Failed to resume session: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	}

	/**
	 * Clear current session and start a new one
	 */
	private handleClear(args: string[]): CommandResult {
		try {
			const agentName = args[0];

			if (!agentName) {
				return {
					type: "error",
					message: "Usage: /clear <agent-name>\nExample: /clear coder",
				};
			}

			// Create new session
			const newSession = this.sessionManager.createSession(agentName);
			this.currentSessionId = newSession.id;

			return {
				type: "text",
				data: { sessionId: newSession.id, session: newSession },
				message: `Started new session for agent: ${agentName}\nSession ID: ${newSession.id}`,
			};
		} catch (error) {
			this.logger.error(`Failed to create new session: ${error}`);
			return {
				type: "error",
				message: `Failed to create new session: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	}

	/**
	 * Show current session info
	 */
	private handleShow(args: string[]): CommandResult {
		try {
			if (!this.currentSessionId) {
				return {
					type: "text",
					message: "No active session. Use /clear to start a new session.",
				};
			}

			const session = this.sessionManager.getSession(this.currentSessionId);

			if (!session) {
				return {
					type: "error",
					message: `Current session not found: ${this.currentSessionId}`,
				};
			}

			const info = [
				`Current Session: ${session.name}`,
				`ID: ${session.id}`,
				`Agent: ${session.agentName}`,
				`Messages: ${session.messageCount}`,
				`Created: ${session.createdAt.toLocaleString()}`,
				`Updated: ${session.updatedAt.toLocaleString()}`,
				`Status: ${session.status}`,
			];

			if (session.lastMessagePreview) {
				info.push(`\nLast message: ${session.lastMessagePreview}`);
			}

			return {
				type: "text",
				data: session,
				message: info.join("\n"),
			};
		} catch (error) {
			this.logger.error(`Failed to show session info: ${error}`);
			return {
				type: "error",
				message: `Failed to show session info: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	}

	/**
	 * Archive a session
	 */
	private handleArchive(args: string[]): CommandResult {
		if (args.length === 0) {
			return {
				type: "error",
				message: "Usage: /archive <session-id>\nUse /sessions to see available sessions.",
			};
		}

		const sessionId = args[0];

		try {
			const session = this.sessionManager.getSession(sessionId);

			if (!session) {
				return {
					type: "error",
					message: `Session not found: ${sessionId}`,
				};
			}

			this.sessionManager.archiveSession(sessionId);

			// If archiving current session, clear it
			if (this.currentSessionId === sessionId) {
				this.currentSessionId = null;
			}

			return {
				type: "text",
				message: `Archived session: ${session.name}`,
			};
		} catch (error) {
			this.logger.error(`Failed to archive session: ${error}`);
			return {
				type: "error",
				message: `Failed to archive session: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	}

	/**
	 * Show help information
	 */
	private handleHelp(): CommandResult {
		const helpText = `
Available Commands:
  /sessions [limit]       List recent active sessions (default: 10, max: 50)
  /resume <id>            Resume a specific session by ID
  /clear <agent>          Start a new session with specified agent
  /show                   Show current session information
  /archive <id>           Archive a session (move to archived status)
  /help                   Show this help message

Examples:
  /sessions               List 10 most recent sessions
  /sessions 20            List 20 most recent sessions
  /resume abc123          Resume session with ID 'abc123'
  /clear coder            Start new session with 'coder' agent
  /show                   Display current session details
  /archive abc123         Archive session 'abc123'

Tips:
  - Sessions auto-resume by default when using the same agent
  - Use /clear to start a fresh conversation
  - Use /sessions to see all your active sessions
  - Archived sessions are preserved but won't auto-resume
`;

		return {
			type: "help",
			message: helpText.trim(),
		};
	}

	/**
	 * Get current session ID
	 */
	getCurrentSessionId(): string | null {
		return this.currentSessionId;
	}

	/**
	 * Set current session ID
	 */
	setCurrentSessionId(sessionId: string | null): void {
		this.currentSessionId = sessionId;
	}
}
