import { tool } from "langchain";
import { z } from "zod";
import { spawn, type ChildProcess } from "node:child_process";

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

/**
 * Creates a tool that executes terminal commands safely
 */
export const createCommandExecuteTool = (
	workspace: string,
	envVariables?: Record<string, string>,
	blockedCommands: string[] = DEFAULT_BLOCKED_COMMANDS,
	allowScriptExecution = true,
	timeoutInMilliseconds = 300000, // Default timeout of 5 minutes
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
					const { NODE_OPTIONS, NODE_DEBUG, VSCODE_INSPECTOR_OPTIONS, ...cleanEnv } = process.env;
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
							} catch (e) {
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
						output += data.toString();
					});

					terminalProcess.stderr?.on("data", (data) => {
						output += data.toString();
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
				"Executes a command in a terminal and reports the output. Cannot execute potentially destructive commands like rm, mv, chmod, sudo, etc. Use for safe operations like running tests, builds, or other validation commands. Do not run long-running commands like dev servers. Commands run with a timeout in the workspace context.",
			schema: z.object({
				command: z.string().describe("The command to execute in the terminal"),
			}),
		},
	);
};
