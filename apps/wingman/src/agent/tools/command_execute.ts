import { type ChildProcess, spawn } from "node:child_process";
import { tool } from "langchain";
import * as z from "zod";

export const DEFAULT_BLOCKED_COMMANDS = [
	"rm",
	"remove",
	"del",
	"delete",
	"rmdir",
	"rd",
	"mv",
	"move",
	"format",
	">",
	">>",
	"chmod",
	"chown",
	":>",
	"sudo",
	"su",
];

const DEFAULT_MAX_OUTPUT_CHARS = 200_000;
const TRUNCATION_HEAD_CHARS = 120_000;
const TRUNCATION_TAIL_CHARS = 80_000;

function appendCommandOutput(
	existing: string,
	incoming: string,
	maxChars: number,
): string {
	if (!incoming) return existing;
	if (maxChars <= 0) return "";
	const combined = existing + incoming;
	if (combined.length <= maxChars) {
		return combined;
	}

	const headBudget = Math.min(
		TRUNCATION_HEAD_CHARS,
		Math.floor(maxChars * 0.6),
	);
	const tailBudget = Math.min(
		TRUNCATION_TAIL_CHARS,
		Math.max(0, maxChars - headBudget),
	);
	const head = combined.slice(0, headBudget);
	const tail = tailBudget > 0 ? combined.slice(-tailBudget) : "";
	const omitted = Math.max(0, combined.length - head.length - tail.length);
	return `${head}\n\n[output truncated: omitted ${omitted} chars]\n\n${tail}`;
}

/**
 * Creates a tool that executes terminal commands safely
 */
export const createCommandExecuteTool = (
	workspace: string,
	envVariables?: Record<string, string>,
	blockedCommands: string[] = DEFAULT_BLOCKED_COMMANDS,
	allowScriptExecution = true,
	timeoutInMilliseconds = 300000, // Default timeout of 5 minutes
	maxOutputChars = DEFAULT_MAX_OUTPUT_CHARS,
) => {
	return tool(
		async ({ command }: { command: string }) => {
			return new Promise<string>((resolve) => {
				try {
					const commandParts = command.trim().split(/\s+/);
					const commandName = (commandParts[0] || "").toLowerCase();
					const baseCommand = commandName.split(/[\\/]/).pop() || "";

					if (blockedCommands.includes(baseCommand)) {
						const result = `Command: "${command}" rejected, contains potentially destructive operations`;
						resolve(result);
						return;
					}

					if (
						!allowScriptExecution &&
						(commandName.endsWith(".sh") ||
							commandName.endsWith(".bash") ||
							commandName.endsWith(".zsh") ||
							commandName.endsWith(".ps1") ||
							commandName.endsWith(".cmd") ||
							commandName.endsWith(".bat"))
					) {
						const result = `Command: "${command}" rejected, script execution not allowed`;
						resolve(result);
						return;
					}

					let output = "";
					let hasExited = false;

					// Create a sanitized environment for the child process
					const {
						NODE_OPTIONS,
						NODE_DEBUG,
						VSCODE_INSPECTOR_OPTIONS,
						...cleanEnv
					} = process.env;
					const safeEnv = {
						...cleanEnv,
						FORCE_COLOR: "0",
						NO_COLOR: "1",
						GIT_PAGER: "cat",
						...(envVariables ?? {}),
					};

					const terminalProcess: ChildProcess = spawn(command, [], {
						cwd: workspace,
						shell: true,
						stdio: ["ignore", "pipe", "pipe"],
						env: safeEnv,
						windowsHide: true,
					});

					const timeout = setTimeout(() => {
						if (!hasExited) {
							hasExited = true;
							try {
								terminalProcess.kill();
							} catch {
								// Ignore kill errors
							}
							const result = `Command: "${command}" timed out after ${
								timeoutInMilliseconds / 1000
							} seconds`;
							resolve(result);
						}
					}, timeoutInMilliseconds);

					const resolveResponse = (result: string, failed: boolean) => {
						if (!hasExited) {
							hasExited = true;
							clearTimeout(timeout);
							const prefix = failed
								? `Command: "${command}" failed with output:`
								: `Command: "${command}" completed successfully with output:`;
							resolve(result ? `${prefix}\n${result}` : prefix);
						}
					};

					terminalProcess.stdout?.on("data", (data) => {
						output = appendCommandOutput(
							output,
							data.toString(),
							maxOutputChars,
						);
					});

					terminalProcess.stderr?.on("data", (data) => {
						output = appendCommandOutput(
							output,
							data.toString(),
							maxOutputChars,
						);
					});

					terminalProcess.on("error", (err) => {
						resolveResponse(err.message, true);
					});

					terminalProcess.on("exit", (code) => {
						resolveResponse(output, code !== 0);
					});
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : "Unknown error occurred";
					resolve(`Error: ${errorMessage}`);
				}
			});
		},
		{
			name: "command_execute",
			description:
				"Executes a command in a terminal and reports the output. Cannot execute potentially destructive commands like rm, mv, chmod, sudo, etc. Use for safe operations like running tests, builds, or other validation commands. Not for image generation/editing requests when dedicated image tools are available. Do not run long-running commands like dev servers. Commands run with a timeout in the active execution workspace context.",
			schema: z.object({
				command: z.string().describe("The command to execute in the terminal"),
			}),
		},
	);
};
