import { tool } from "langchain";
import { z } from "zod";
import { DEFAULT_BLOCKED_COMMANDS } from "./command_execute.js";
import type {
	TerminalSessionManager,
	TerminalSessionStatus,
} from "./terminal_session_manager.js";

export interface BackgroundTerminalToolOptions {
	workspace: string;
	ownerId: string;
	sessionManager: TerminalSessionManager;
	envVariables?: Record<string, string>;
	blockedCommands?: string[];
	allowScriptExecution?: boolean;
	commandTimeout?: number;
}

const normalizeCommandParts = (command: string): string => {
	const commandParts = command.trim().split(/\s+/);
	const commandName = (commandParts[0] || "").toLowerCase();
	return commandName.split(/[\\/]/).pop() || "";
};

const isScriptCommand = (command: string): boolean => {
	const normalized = command.trim().toLowerCase();
	return (
		normalized.endsWith(".sh") ||
		normalized.endsWith(".bash") ||
		normalized.endsWith(".zsh") ||
		normalized.endsWith(".ps1") ||
		normalized.endsWith(".cmd") ||
		normalized.endsWith(".bat")
	);
};

const createSafeEnv = (
	envVariables?: Record<string, string>,
): Record<string, string> => {
	const { NODE_OPTIONS, NODE_DEBUG, VSCODE_INSPECTOR_OPTIONS, ...cleanEnv } =
		process.env;
	return {
		...(cleanEnv as Record<string, string>),
		FORCE_COLOR: "0",
		NO_COLOR: "1",
		GIT_PAGER: "cat",
		...(envVariables ?? {}),
	};
};

const buildTerminalResponse = (payload: {
	session_id?: string;
	status?: TerminalSessionStatus;
	output?: string;
	has_more?: boolean;
	exit_code?: number | null;
	signal?: NodeJS.Signals | null;
	command?: string;
	cwd?: string;
	dropped_chars?: number;
	error?: string;
}) => payload;

export const createBackgroundTerminalTool = (
	options: BackgroundTerminalToolOptions,
) => {
	const {
		workspace,
		ownerId,
		sessionManager,
		envVariables,
		blockedCommands = DEFAULT_BLOCKED_COMMANDS,
		allowScriptExecution = true,
		commandTimeout = 300000,
	} = options;

	return tool(
		async ({
			command,
			session_id,
			chars,
			wait_ms,
			max_output_chars,
		}: {
			command?: string;
			session_id?: string;
			chars?: string;
			wait_ms?: number;
			max_output_chars?: number;
		}) => {
			try {
				if (command && session_id) {
					return buildTerminalResponse({
						error: "Provide either command or session_id, not both",
					});
				}

				if (!command && !session_id) {
					return buildTerminalResponse({
						error: "Provide command to start a session or session_id to poll/write",
					});
				}

				let resolvedSessionId = session_id;

				if (command) {
					const baseCommand = normalizeCommandParts(command);
					if (blockedCommands.includes(baseCommand)) {
						return buildTerminalResponse({
							error: `Command "${command}" rejected by blockedCommands policy`,
						});
					}

					if (!allowScriptExecution && isScriptCommand(command)) {
						return buildTerminalResponse({
							error: `Command "${command}" rejected because script execution is disabled`,
						});
					}

					const session = sessionManager.startSession({
						ownerId,
						command,
						cwd: workspace,
						env: createSafeEnv(envVariables),
						runtimeLimitMs: commandTimeout,
					});
					resolvedSessionId = session.sessionId;
				}

				if (!resolvedSessionId) {
					return buildTerminalResponse({ error: "session_id is required" });
				}

				if (chars && chars.length > 0) {
					sessionManager.writeSession({
						ownerId,
						sessionId: resolvedSessionId,
						chars,
					});
				}

				const pollResult = await sessionManager.pollSession({
					ownerId,
					sessionId: resolvedSessionId,
					waitMs: wait_ms,
					maxOutputChars: max_output_chars,
				});

				return buildTerminalResponse({
					session_id: pollResult.sessionId,
					status: pollResult.status,
					output: pollResult.output,
					has_more: pollResult.hasMore,
					exit_code: pollResult.exitCode,
					signal: pollResult.signal,
					command: pollResult.command,
					cwd: pollResult.cwd,
					dropped_chars: pollResult.droppedChars,
				});
			} catch (error) {
				return buildTerminalResponse({
					error: error instanceof Error ? error.message : String(error),
				});
			}
		},
		{
			name: "background_terminal",
			description:
				"Single background terminal interface. Start a session with command, then poll or write using session_id. Use normal shell commands in-session (for example ps/jobs/kill) and control chars like \\u0003 to interrupt running programs.",
			schema: z.object({
				command: z
					.string()
					.optional()
					.describe("Command to start a new terminal session"),
				session_id: z
					.string()
					.optional()
					.describe("Existing terminal session id for poll/write"),
				chars: z
					.string()
					.optional()
					.default("")
					.describe("Optional stdin text to write before polling"),
				wait_ms: z
					.number()
					.min(0)
					.max(30000)
					.optional()
					.default(1000)
					.describe("How long to wait for output before returning"),
				max_output_chars: z
					.number()
					.min(1)
					.max(200000)
					.optional()
					.default(8000)
					.describe("Maximum output characters to return"),
			}),
		},
	);
};
