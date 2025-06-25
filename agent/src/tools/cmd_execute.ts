 import { tool } from "@langchain/core/tools";
import { z } from "zod/v4";
import { spawn, type ChildProcess } from "node:child_process";
import { baseToolSchema } from "./schemas";
import type { CommandMetadata } from "@shared/types/Message";
import { ToolMessage } from "@langchain/core/messages";

export const commandExecuteSchema = baseToolSchema.extend({
	command: z.string().describe("The command to execute in the terminal"),
});

const BLOCKED_COMMANDS = [
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
	timeoutInMilliseconds = 60000,
) => {
	return tool(
		async (input, config) => {
			return new Promise((resolve, reject) => {
				try {
					const commandParts = input.command.trim().split(/\s+/);
					const commandName = (commandParts[0] || "").toLowerCase();
					const baseCommand = commandName.split(/[\\/]/).pop() || "";

					// More precise check for blocked commands
					if (BLOCKED_COMMANDS.includes(baseCommand)) {
						const command: CommandMetadata = {
							id: config.runId,
							command: input.command,
							result: `Command: \"${input.command}\" rejected, contains potentially destructive operations`,
							failed: true,
							success: false,
							accepted: true,
							rejected: false,
						};
						resolve(
							new ToolMessage({
								id: config.runId,
								content: `Command: \"${input.command}\" rejected, contains potentially destructive operations`,
								tool_call_id: config.toolCall.id,
								name: "command_execute",
								additional_kwargs: {
									command,
								},
							}),
						);
						return;
					}

					if (
						commandName.endsWith(".sh") ||
						commandName.endsWith(".bat") ||
						commandName.endsWith(".cmd")
					) {
						const command: CommandMetadata = {
							id: config.runId,
							command: input.command,
							result: `Command: \"${input.command}\" blocked`,
							failed: true,
							success: false,
							accepted: true,
							rejected: false,
						};
						resolve(
							new ToolMessage({
								id: config.runId,
								content: `Command: \"${input.command}\" rejected, script execution not allowed`,
								tool_call_id: config.toolCall.id,
								name: "command_execute",
								additional_kwargs: {
									command,
								},
							}),
						);
						return;
					}

					let output = "";
					let hasExited = false;

					const terminalProcess: ChildProcess = spawn(input.command, [], {
						cwd: workspace,
						shell: true,
						stdio: ["ignore", "pipe", "pipe"], // Explicitly ignore stdin
						env: {
							...process.env,
							FORCE_COLOR: "0",
							NO_COLOR: "1",
							GIT_PAGER: "cat",
							...(envVariables ?? {}),
						},
						windowsHide: true,
					});

					const timeout = setTimeout(() => {
						if (!hasExited) {
							try {
								terminalProcess.kill();
							} catch (e) {
								// Ignore kill errors
							}
							const command: CommandMetadata = {
								id: config.runId,
								command: input.command,
								result: `Command: \"${input.command}\" timed out after 60 seconds`,
								failed: true,
								success: false,
								accepted: true,
								rejected: false,
							};
							resolve(
								new ToolMessage({
									id: config.runId,
									content: `Command: \"${input.command}\" timed out after 60 seconds`,
									tool_call_id: config.toolCall.id,
									name: "command_execute",
									additional_kwargs: {
										command,
									},
								}),
							);
						}
					}, timeoutInMilliseconds);

					terminalProcess.stdout?.on("data", (data) => {
						output += data.toString();
					});

					terminalProcess.stderr?.on("data", (data) => {
						output += data.toString();
					});

					terminalProcess.on("error", (err) => {
						if (!hasExited) {
							hasExited = true;
							clearTimeout(timeout);
							const command: CommandMetadata = {
								id: config.runId,
								command: input.command,
								result: err.message,
								failed: true,
								success: false,
								accepted: true,
								rejected: false,
							};
							resolve(
								new ToolMessage({
									id: config.runId,
									content: `Command: \"${input.command}\" failed, error: ${err.message}`,
									tool_call_id: config.toolCall.id,
									name: "command_execute",
									additional_kwargs: {
										command,
									},
								}),
							);
						}
					});

					terminalProcess.on("exit", (code) => {
						if (!hasExited) {
							hasExited = true;
							clearTimeout(timeout);
							if (code === 0) {
								const command: CommandMetadata = {
									id: config.runId,
									command: input.command,
									result: output,
									failed: false,
									success: true,
									accepted: true,
									rejected: false,
								};
								resolve(
									new ToolMessage({
										id: config.runId,
										content:
											output ||
											`Command "${input.command}" ran successfully with no output.`,
										tool_call_id: config.toolCall.id,
										name: "command_execute",
										additional_kwargs: {
											command,
										},
									}),
								);
							} else {
								const command: CommandMetadata = {
									id: config.runId,
									command: input.command,
									result: output,
									failed: true,
									success: false,
									accepted: true,
									rejected: false,
								};
								resolve(
									new ToolMessage({
										id: config.runId,
										content: `Command: \"${input.command}\" failed, output: ${output}`,
										tool_call_id: config.toolCall.id,
										name: "command_execute",
										additional_kwargs: {
											command,
										},
									}),
								);
							}
						}
					});
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : "Unknown error occurred";
					const command: CommandMetadata = {
						id: config.runId,
						command: input.command,
						result: errorMessage,
						failed: true,
						success: false,
						accepted: true,
						rejected: false,
					};
					resolve(
						new ToolMessage({
							id: config.runId,
							content: `Command: \"${input.command}\" failed, error: ${errorMessage}`,
							tool_call_id: config.toolCall.id,
							name: "command_execute",
							additional_kwargs: {
								command,
							},
						}),
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
