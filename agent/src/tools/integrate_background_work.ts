import { tool } from "@langchain/core/tools";
import { ToolMessage } from "@langchain/core/messages";
import { z } from "zod/v4";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import {
	BackgroundAgentManager,
	type BackgroundAgentStatus,
} from "./background_agent";

const execAsync = promisify(exec);

export const integrateBackgroundWorkSchema = z.object({
	action: z
		.enum(["list", "integrate", "resolve_conflicts", "cleanup"])
		.describe(
			"Action to perform: list pending integrations, integrate specific work, resolve conflicts, or cleanup completed work",
		),
	threadId: z
		.string()
		.optional()
		.describe(
			"Thread ID of the background agent work to integrate (required for integrate, resolve_conflicts, cleanup actions)",
		),
	strategy: z
		.enum(["merge", "rebase", "squash"])
		.optional()
		.default("merge")
		.describe("Integration strategy to use when integrating work"),
	conflictResolution: z
		.enum(["ours", "theirs", "manual"])
		.optional()
		.describe(
			"How to resolve conflicts: ours (keep current branch), theirs (use background agent changes), or manual",
		),
});

interface GitConflictInfo {
	file: string;
	status: string;
}

class BackgroundWorkIntegrator {
	private workingDirectory: string;

	constructor(workingDirectory: string) {
		this.workingDirectory = workingDirectory;
	}

	async getCurrentBranch(): Promise<string> {
		try {
			const { stdout } = await execAsync("git branch --show-current", {
				cwd: this.workingDirectory,
			});
			return stdout.trim();
		} catch (error) {
			throw new Error(`Failed to get current branch: ${error}`);
		}
	}

	/**
	 * Get files changed in a worktree compared to the main branch
	 * This shows committed changes that are ready for integration
	 */
	async getChangedFiles(worktreePath: string, mainBranch?: string): Promise<string[]> {
		try {
			// Get the main branch if not provided
			const baseBranch = mainBranch || await this.getMainBranch();
			
			// Get files that have been committed in the worktree since branching from main
			const { stdout } = await execAsync(
				`git -C "${worktreePath}" diff --name-only origin/${baseBranch}...HEAD`,
				{
					cwd: this.workingDirectory,
				},
			);
			return stdout
				.trim()
				.split("\n")
				.filter((file) => file.length > 0);
		} catch (error) {
			console.warn(`Failed to get changed files: ${error}`);
			
			// Fallback: try comparing against HEAD~1 (previous approach)
			try {
				const { stdout } = await execAsync(
					`git -C "${worktreePath}" diff --name-only HEAD~1`,
					{
						cwd: this.workingDirectory,
					},
				);
				return stdout
					.trim()
					.split("\n")
					.filter((file) => file.length > 0);
			} catch (fallbackError) {
				console.warn(`Fallback also failed: ${fallbackError}`);
				return [];
			}
		}
	}

	/**
	 * Get the main branch name (main, master, etc.)
	 */
	private async getMainBranch(): Promise<string> {
		try {
			// Try to get the default branch from remote
			const { stdout } = await execAsync("git symbolic-ref refs/remotes/origin/HEAD", {
				cwd: this.workingDirectory,
			});
			return stdout.trim().replace("refs/remotes/origin/", "");
		} catch {
			// Fallback: check which of main/master exists
			try {
				await execAsync("git show-ref --verify --quiet refs/heads/main", {
					cwd: this.workingDirectory,
				});
				return "main";
			} catch {
				try {
					await execAsync("git show-ref --verify --quiet refs/heads/master", {
						cwd: this.workingDirectory,
					});
					return "master";
				} catch {
					// Final fallback
					return "main";
				}
			}
		}
	}

	async getConflictFiles(): Promise<GitConflictInfo[]> {
		try {
			const { stdout } = await execAsync("git status --porcelain", {
				cwd: this.workingDirectory,
			});

			return stdout
				.split("\n")
				.filter(
					(line) =>
						line.startsWith("UU") ||
						line.startsWith("AA") ||
						line.startsWith("DD"),
				)
				.map((line) => ({
					file: line.substring(3),
					status: line.substring(0, 2),
				}));
		} catch (error) {
			throw new Error(`Failed to get conflict files: ${error}`);
		}
	}

	async attemptIntegration(
		worktreeBranch: string,
		strategy: "merge" | "rebase" | "squash" = "merge",
	): Promise<{ success: boolean; conflictFiles?: string[]; error?: string }> {
		try {
			const currentBranch = await this.getCurrentBranch();

			// Ensure we're on the correct branch
			await execAsync(`git checkout ${currentBranch}`, {
				cwd: this.workingDirectory,
			});

			let command: string;
			switch (strategy) {
				case "rebase":
					command = `git rebase ${worktreeBranch}`;
					break;
				case "squash":
					command = `git merge --squash ${worktreeBranch}`;
					break;
				default:
					command = `git merge ${worktreeBranch}`;
					break;
			}

			await execAsync(command, {
				cwd: this.workingDirectory,
			});

			return { success: true };
		} catch (error: any) {
			// Check if it's a merge conflict
			if (
				error.message.includes("CONFLICT") ||
				error.message.includes("conflict")
			) {
				const conflictFiles = await this.getConflictFiles();
				return {
					success: false,
					conflictFiles: conflictFiles.map((cf) => cf.file),
					error: "Merge conflicts detected",
				};
			}

			return {
				success: false,
				error: error.message,
			};
		}
	}

	async resolveConflicts(
		conflictResolution: "ours" | "theirs" | "manual",
		conflictFiles?: string[],
	): Promise<{ success: boolean; error?: string }> {
		try {
			if (conflictResolution === "manual") {
				return {
					success: false,
					error:
						"Manual conflict resolution required. Please resolve conflicts manually and commit the changes.",
				};
			}

			const strategy = conflictResolution === "ours" ? "--ours" : "--theirs";

			if (conflictFiles && conflictFiles.length > 0) {
				for (const file of conflictFiles) {
					await execAsync(`git checkout ${strategy} "${file}"`, {
						cwd: this.workingDirectory,
					});
				}
			} else {
				// Resolve all conflicts
				await execAsync(`git checkout ${strategy} .`, {
					cwd: this.workingDirectory,
				});
			}

			// Stage resolved files
			await execAsync("git add .", {
				cwd: this.workingDirectory,
			});

			// Complete the merge
			await execAsync("git commit --no-edit", {
				cwd: this.workingDirectory,
			});

			return { success: true };
		} catch (error: any) {
			return {
				success: false,
				error: error.message,
			};
		}
	}

	async cleanupWorktree(
		worktreePath: string,
	): Promise<{ success: boolean; error?: string }> {
		try {
			// Remove the worktree
			await execAsync(`git worktree remove "${worktreePath}"`, {
				cwd: this.workingDirectory,
			});

			return { success: true };
		} catch (error: any) {
			return {
				success: false,
				error: error.message,
			};
		}
	}
}

export const createIntegrateBackgroundWorkTool = (workingDirectory: string) => {
	const integrator = new BackgroundWorkIntegrator(workingDirectory);
	const manager = BackgroundAgentManager.getInstance();

	return tool(
		async (
			input: z.infer<typeof integrateBackgroundWorkSchema>,
			toolConfig,
		) => {
			try {
				const completedAgents = manager.getCompletedAgents();

				switch (input.action) {
					case "list": {
						const pendingIntegrations = Array.from(
							completedAgents.values(),
						).filter(
							(agent) =>
								agent.status === "completed" ||
								agent.status === "conflict" ||
								agent.status === "integrated",
						);

						return new ToolMessage({
							id: toolConfig.toolCall.id,
							content: JSON.stringify({
								success: true,
								pendingIntegrations: pendingIntegrations.map((agent) => ({
									threadId: agent.threadId,
									agentName: agent.agentName,
									status: agent.status,
									worktreeBranch: agent.worktreeBranch,
									integration: agent.integration,
									input: agent.input,
								})),
								message: `Found ${pendingIntegrations.length} background agent(s) with work to integrate.`,
							}),
							tool_call_id: toolConfig.toolCall.id,
						});
					}

					case "integrate": {
						if (!input.threadId) {
							throw new Error("Thread ID is required for integration");
						}

						const agentStatus = completedAgents.get(input.threadId);
						if (!agentStatus) {
							throw new Error(
								`No completed background agent found with thread ID: ${input.threadId}`,
							);
						}

						if (agentStatus.status === "integrated") {
							return new ToolMessage({
								id: toolConfig.toolCall.id,
								content: JSON.stringify({
									success: true,
									message: `Background agent '${agentStatus.agentName}' work is already integrated.`,
								}),
								tool_call_id: toolConfig.toolCall.id,
							});
						}

						// Attempt integration
						const result = await integrator.attemptIntegration(
							agentStatus.worktreeBranch,
							input.strategy,
						);

						if (result.success) {
							// Update agent status
							const updatedStatus: BackgroundAgentStatus = {
								...agentStatus,
								status: "integrated",
								integration: {
									...agentStatus.integration!,
									mergeAttempted: true,
									mergeSuccessful: true,
								},
							};
							completedAgents.set(input.threadId, updatedStatus);

							// Clean up worktree
							if (agentStatus.integration?.worktreePath) {
								await integrator.cleanupWorktree(
									agentStatus.integration.worktreePath,
								);
							}

							// Remove from completed agents tracking
							manager.removeCompletedAgent(input.threadId);

							return new ToolMessage({
								id: toolConfig.toolCall.id,
								content: JSON.stringify({
									success: true,
									message: `Successfully integrated background agent '${agentStatus.agentName}' work using ${input.strategy} strategy.`,
									integration: updatedStatus.integration,
								}),
								tool_call_id: toolConfig.toolCall.id,
							});
						}
						// Update agent status with conflict information
						const updatedStatus: BackgroundAgentStatus = {
							...agentStatus,
							status: "conflict",
							integration: {
								...agentStatus.integration!,
								mergeAttempted: true,
								mergeSuccessful: false,
								conflictFiles: result.conflictFiles,
								errorMessage: result.error,
							},
						};
						completedAgents.set(input.threadId, updatedStatus);

						return new ToolMessage({
							id: toolConfig.toolCall.id,
							content: JSON.stringify({
								success: false,
								message: `Integration failed for background agent '${agentStatus.agentName}': ${result.error}`,
								conflictFiles: result.conflictFiles,
								error: result.error,
								integration: updatedStatus.integration,
							}),
							tool_call_id: toolConfig.toolCall.id,
						});
					}

					case "resolve_conflicts": {
						if (!input.threadId) {
							throw new Error("Thread ID is required for conflict resolution");
						}

						if (!input.conflictResolution) {
							throw new Error("Conflict resolution strategy is required");
						}

						const agentStatus = completedAgents.get(input.threadId);
						if (!agentStatus || agentStatus.status !== "conflict") {
							throw new Error(
								`No background agent with conflicts found for thread ID: ${input.threadId}`,
							);
						}

						const result = await integrator.resolveConflicts(
							input.conflictResolution,
							agentStatus.integration?.conflictFiles,
						);

						if (result.success) {
							// Update agent status
							const updatedStatus: BackgroundAgentStatus = {
								...agentStatus,
								status: "integrated",
								integration: {
									...agentStatus.integration!,
									mergeSuccessful: true,
									conflictFiles: undefined,
									errorMessage: undefined,
								},
							};
							completedAgents.set(input.threadId, updatedStatus);

							// Clean up worktree
							if (agentStatus.integration?.worktreePath) {
								await integrator.cleanupWorktree(
									agentStatus.integration.worktreePath,
								);
							}

							// Remove from completed agents tracking
							manager.removeCompletedAgent(input.threadId);

							return new ToolMessage({
								id: toolConfig.toolCall.id,
								content: JSON.stringify({
									success: true,
									message: `Successfully resolved conflicts for background agent '${agentStatus.agentName}' using '${input.conflictResolution}' strategy.`,
									integration: updatedStatus.integration,
								}),
								tool_call_id: toolConfig.toolCall.id,
							});
						}
						return new ToolMessage({
							id: toolConfig.toolCall.id,
							content: JSON.stringify({
								success: false,
								message: `Failed to resolve conflicts for background agent '${agentStatus.agentName}': ${result.error}`,
								error: result.error,
							}),
							tool_call_id: toolConfig.toolCall.id,
						});
					}

					case "cleanup": {
						if (!input.threadId) {
							throw new Error("Thread ID is required for cleanup");
						}

						const agentStatus = completedAgents.get(input.threadId);
						if (!agentStatus) {
							throw new Error(
								`No background agent found with thread ID: ${input.threadId}`,
							);
						}

						// Clean up worktree if it exists
						if (agentStatus.integration?.worktreePath) {
							const result = await integrator.cleanupWorktree(
								agentStatus.integration.worktreePath,
							);
							if (!result.success) {
								return new ToolMessage({
									id: toolConfig.toolCall.id,
									content: JSON.stringify({
										success: false,
										message: `Failed to cleanup worktree for background agent '${agentStatus.agentName}': ${result.error}`,
										error: result.error,
									}),
									tool_call_id: toolConfig.toolCall.id,
								});
							}
						}

						// Remove from completed agents tracking
						manager.removeCompletedAgent(input.threadId);

						return new ToolMessage({
							id: toolConfig.toolCall.id,
							content: JSON.stringify({
								success: true,
								message: `Successfully cleaned up background agent '${agentStatus.agentName}' work.`,
							}),
							tool_call_id: toolConfig.toolCall.id,
						});
					}

					default:
						throw new Error(`Unknown action: ${input.action}`);
				}
			} catch (error) {
				return new ToolMessage({
					id: toolConfig.toolCall.id,
					content: JSON.stringify({
						success: false,
						error:
							error instanceof Error ? error.message : "Unknown error occurred",
						message: "Failed to perform background work integration",
					}),
					tool_call_id: toolConfig.toolCall.id,
				});
			}
		},
		{
			name: "integrate_background_work",
			description:
				"Manage integration of completed background agent work into the current working branch",
			schema: integrateBackgroundWorkSchema,
		},
	);
};