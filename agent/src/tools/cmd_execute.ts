import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import { spawn, type ChildProcess } from "node:child_process";
import { baseToolSchema } from "./schemas";
import type { CommandMetadata } from "@shared/types/Message";
import { ToolMessage } from "@langchain/core/messages";

export const commandExecuteSchema = baseToolSchema.extend({
	command: z.string().describe("The command to execute in the terminal"),
});

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

const createToolResponse = (
	runId: string,
	toolCallId: string,
	command: string,
	result: string,
	failed: boolean,
): ToolMessage => {
	const metadata: CommandMetadata = {
		id: runId,
		command,
		result,
		failed,
		success: !failed,
		accepted: true,
		rejected: false,
	};

	let content: string;
	if (failed) {
		content =
			result.startsWith("Command:") || result.startsWith("Error:")
				? result
				: `Command: 
"${command}" 

Failed with output: 
${result}`;
	} else {
		content =
			`Command:
"${command}"
 
Completed successfully with the following output:
		
${result}` ||
			`Command:
"${command}" 

Completed successfully with no output.`;
	}

	return new ToolMessage({
		id: runId,
		content,
		tool_call_id: toolCallId,
		name: "command_execute",
		additional_kwargs: {
			command: metadata,
		},
	});
};

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
		async (input, config) => {
			return new Promise((resolve) => {
				try {
					const commandParts = input.command.trim().split(/\s+/);
					const commandName = (commandParts[0] || "").toLowerCase();
					const baseCommand = commandName.split(/[\\/]/).pop() || "";

					if (blockedCommands.includes(baseCommand)) {
						const result = `Command: "${input.command}" rejected, contains potentially destructive operations`;
						resolve(
							createToolResponse(
								config.runId,
								config.toolCall.id,
								input.command,
								result,
								true,
							),
						);
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
						const result = `Command: "${input.command}" rejected, script execution not allowed`;
						resolve(
							createToolResponse(
								config.runId,
								config.toolCall.id,
								input.command,
								result,
								true,
							),
						);
						return;
					}

					let output = "";
					let hasExited = false;

					// Create a sanitized environment for the child process
					const safeEnv = {
						...process.env,
						FORCE_COLOR: "0",
						NO_COLOR: "1",
						GIT_PAGER: "cat",
						...(envVariables ?? {}),
					};

					// Remove debugging-related environment variables to prevent child processes
					// from inheriting the debug context, which can cause unexpected output
					// like "Waiting for debugger to disconnect...".
					//@ts-expect-error
					// biome-ignore lint/performance/noDelete: <explanation>
					delete safeEnv.NODE_OPTIONS;
					//@ts-expect-error
					// biome-ignore lint/performance/noDelete: <explanation>
					delete safeEnv.NODE_DEBUG;
					//@ts-expect-error
					// biome-ignore lint/performance/noDelete: <explanation>
					delete safeEnv.VSCODE_INSPECTOR_OPTIONS;

					const terminalProcess: ChildProcess = spawn(input.command, [], {
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
							const result = `Command: "${
								input.command
							}" timed out after ${timeoutInMilliseconds / 1000} seconds`;
							resolve(
								createToolResponse(
									config.runId,
									config.toolCall.id,
									input.command,
									result,
									true,
								),
							);
						}
					}, timeoutInMilliseconds);

					const resolveResponse = (result: string, failed: boolean) => {
						if (!hasExited) {
							hasExited = true;
							clearTimeout(timeout);
							resolve(
								createToolResponse(
									config.runId,
									config.toolCall.id,
									input.command,
									result,
									failed,
								),
							);
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
					resolve(
						createToolResponse(
							config.runId,
							config.toolCall.id,
							input.command,
							`Error: ${errorMessage}`,
							true,
						),
					);
				}
			});
		},
		{
			name: "command_execute",
			description:
				"Executes a command in a terminal and reports the output. Cannot execute potentially destructive commands like rm, mv, chmod, sudo, etc. Use for safe operations like running build commands. Do not run a long running command like a dev server, you cannot exit it. Commands run with a timeout and in the current workspace context.",
			schema: commandExecuteSchema,
		},
	);
};
