import { tool } from "langchain";
import { z } from "zod";
import { spawn } from "node:child_process";

/**
 * Creates a tool that gets git repository status (read-only)
 * Helps agents understand the current state without making modifications
 */
export const createGitStatusTool = (workspace: string) => {
	return tool(
		async ({
			includeDiff = false,
			includeStaged = false,
		}: {
			includeDiff?: boolean;
			includeStaged?: boolean;
		}) => {
			return new Promise<string>((resolve) => {
				try {
					// First get basic git status
					const statusProc = spawn("git", ["status", "--porcelain"], {
						cwd: workspace,
						shell: false,
					});

					let output = "";
					let errorOutput = "";

					statusProc.stdout.on("data", (data) => {
						output += data.toString();
					});

					statusProc.stderr.on("data", (data) => {
						errorOutput += data.toString();
					});

					statusProc.on("close", async (code) => {
						if (code !== 0) {
							resolve(
								`Error getting git status: ${errorOutput || "Not a git repository or git not available"}`,
							);
							return;
						}

						let result = "# Git Status\n\n";

						if (!output.trim()) {
							result += "Working directory clean - no uncommitted changes\n";
						} else {
							result += "## Changed Files\n\n";
							result += output;
							result += "\n";
						}

						// Get current branch
						const branchProc = spawn("git", ["branch", "--show-current"], {
							cwd: workspace,
							shell: false,
						});

						let branchOutput = "";
						branchProc.stdout.on("data", (data) => {
							branchOutput += data.toString();
						});

						branchProc.on("close", async () => {
							if (branchOutput.trim()) {
								result += `\n## Current Branch\n${branchOutput.trim()}\n`;
							}

							// Optionally include diff
							if (includeDiff && output.trim()) {
								const diffProc = spawn("git", ["diff", "--stat"], {
									cwd: workspace,
									shell: false,
								});

								let diffOutput = "";
								diffProc.stdout.on("data", (data) => {
									diffOutput += data.toString();
								});

								diffProc.on("close", () => {
									if (diffOutput.trim()) {
										result += `\n## Diff Summary\n${diffOutput}\n`;
									}
									resolve(result);
								});
							} else if (includeStaged && output.trim()) {
								// Include staged changes
								const stagedProc = spawn("git", ["diff", "--cached", "--stat"], {
									cwd: workspace,
									shell: false,
								});

								let stagedOutput = "";
								stagedProc.stdout.on("data", (data) => {
									stagedOutput += data.toString();
								});

								stagedProc.on("close", () => {
									if (stagedOutput.trim()) {
										result += `\n## Staged Changes\n${stagedOutput}\n`;
									}
									resolve(result);
								});
							} else {
								resolve(result);
							}
						});
					});

					statusProc.on("error", (err) => {
						resolve(`Failed to execute git: ${err.message}`);
					});
				} catch (error) {
					resolve(`Error getting git status: ${error}`);
				}
			});
		},
		{
			name: "git_status",
			description:
				"Get current git repository status including uncommitted changes, current branch, and optionally diff statistics. Read-only operation that helps understand the state before making changes.",
			schema: z.object({
				includeDiff: z
					.boolean()
					.optional()
					.default(false)
					.describe(
						"Optional: Include summary of unstaged changes (diff --stat). Useful for understanding what has changed.",
					),
				includeStaged: z
					.boolean()
					.optional()
					.default(false)
					.describe(
						"Optional: Include summary of staged changes (diff --cached --stat). Shows what will be committed.",
					),
			}),
		},
	);
};
