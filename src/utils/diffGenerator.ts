import * as vscode from "vscode";
import type { CodeReview } from "@shared/types/Message";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { getGitignorePatterns } from "../server/files/utils";
import { glob } from "tinyglobby";
import path from "node:path";
import { GitCommandEngine, type GitDiffOptions } from "./gitCommandEngine";

interface DiffOptions {
	includeStagedChanges?: boolean;
	includeUnstagedChanges?: boolean;
	includeUntrackedFiles?: boolean;
	includeCommittedChanges?: boolean;
	pathSpec?: string;
}

const execAsync = promisify(exec);

export class DiffGenerator extends GitCommandEngine {
	/**
	 * Gets the base branch name (usually main or master)
	 * @returns The base branch name
	 */
	public async getBaseBranch(): Promise<string> {
		const upstream = await this.executeGitCommand(
			"git rev-parse --abbrev-ref @{upstream}",
		);
		return upstream.split("/")[1] || "main";
	}

	/**
	 * Gets the content of a file from the base branch
	 * @param filePath The path to the file
	 * @returns The file content from the base branch
	 */
	public async getOriginalContent(filePath: string): Promise<string> {
		try {
			// Get merge base commit
			const mergeBase = await this.executeGitCommand(
				`git merge-base HEAD ${await this.getBaseBranch()}`,
			);

			// Get file content at merge base
			return await this.executeGitCommand(
				`git show ${mergeBase.trim()}:${filePath}`,
			);
		} catch (error) {
			console.error("Failed to get original content:", error);
			return "";
		}
	}

	/**
	 * Executes a git command and returns the output
	 * @param command The git command to execute
	 * @returns The command output
	 */
	private async executeGitCommand(command: string): Promise<string> {
		try {
			const { stdout } = await execAsync(command, {
				cwd: this.cwd,
			});
			return stdout.trim();
		} catch (error) {
			if (error instanceof Error) {
				throw new Error(`Git command failed: ${error.message}`);
			}
		}

		return "";
	}

	/**
	 * Gets the current git branch name
	 * @returns The current branch name
	 */
	public async getCurrentBranch(): Promise<string> {
		return this.executeGitCommand("git rev-parse --abbrev-ref HEAD");
	}

	async generateDiffWithLineNumbersAndMap(
		params: GitDiffOptions = {
			includeStagedChanges: true,
			includeUnstagedChanges: true,
			includeUntrackedFiles: true,
			includeCommittedChanges: false,
		},
	): Promise<CodeReview["fileDiffMap"]> {
		try {
			const diffs = await this.getDiff(params);

			if (!diffs) {
				vscode.window.showInformationMessage("No changes detected to review.");
				return {};
			}

			return this.processDiff(diffs);
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to generate diff: ${error}`);
			return {};
		}
	}

	private async processDiff(diffs: string): Promise<CodeReview["fileDiffMap"]> {
		const diffLines = diffs.split("\n");
		const excludePatterns = await getGitignorePatterns(this.cwd);

		let currentFile = "";
		let currentHunk: {
			oldStart: number;
			newStart: number;
			oldLines: number;
			newLines: number;
			lines: string[];
		} | null = null;

		let currentLineNumber = 0;
		let currentDiff: string[] = [];
		const fileDiffMap: CodeReview["fileDiffMap"] = {};

		const saveCurrentHunk = () => {
			if (currentHunk) {
				currentDiff.push(currentHunk.lines.join("\n"));
				currentHunk = null;
			}
		};

		const saveCurrentFile = () => {
			if (currentFile && currentDiff.length > 0) {
				if (!fileDiffMap[currentFile]) {
					fileDiffMap[currentFile] = {
						file: currentFile,
						diff: currentDiff.join("\n"),
					};
				} else {
					fileDiffMap[currentFile].diff += `\n${currentDiff.join("\n")}`;
				}
			}
		};

		for (const line of diffLines) {
			// Handle new file detection
			if (line.startsWith("diff --git")) {
				// Save current hunk and file before moving to next file
				saveCurrentHunk();
				saveCurrentFile();

				currentFile = line.split(" ")[2].substring(2);
				const matchedFiles = await glob(currentFile, {
					onlyFiles: true,
					ignore: excludePatterns,
					cwd: this.cwd,
				});

				currentDiff = matchedFiles.length > 0 ? [line] : [];
				continue;
			}

			// Only process if we're tracking this file
			if (currentDiff.length === 0) continue;

			// Handle metadata lines
			if (
				line.startsWith("index") ||
				line.startsWith("---") ||
				line.startsWith("+++")
			) {
				currentDiff.push(line);
				continue;
			}

			// Handle hunk headers
			if (line.startsWith("@@")) {
				saveCurrentHunk();

				const match = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
				if (match) {
					const [_, oldStart, oldLines, newStart, newLines] = match;
					currentHunk = {
						oldStart: Number.parseInt(oldStart, 10),
						newStart: Number.parseInt(newStart, 10),
						oldLines: Number.parseInt(oldLines || "1", 10),
						newLines: Number.parseInt(newLines || "1", 10),
						lines: [line],
					};
					currentLineNumber = currentHunk.newStart;
				}
			} else if (currentHunk) {
				// Process diff lines with line numbers
				if (line.startsWith("+")) {
					currentHunk.lines.push(
						`${currentLineNumber.toString().padStart(5)} ${line}`,
					);
					currentLineNumber++;
				} else if (line.startsWith("-")) {
					currentHunk.lines.push(`     ${line}`);
				} else {
					currentHunk.lines.push(
						`${currentLineNumber.toString().padStart(5)} ${line}`,
					);
					currentLineNumber++;
				}
			}
		}

		// Handle the final hunk and file
		saveCurrentHunk();
		saveCurrentFile();

		return fileDiffMap;
	}

	public async getDiff(options: DiffOptions = {}): Promise<string> {
		const {
			includeStagedChanges = true,
			includeUnstagedChanges = true,
			includeUntrackedFiles = false,
			includeCommittedChanges = true,
			pathSpec = "",
		} = options;

		const diffCommands: string[] = [];

		try {
			// First check if git is available
			try {
				await this.executeGitCommand("git --version");
			} catch (error) {
				vscode.window.showErrorMessage(
					"Git is not available in the current workspace",
				);
				return "";
			}

			// Check if we're in a git repository
			try {
				await this.executeGitCommand("git rev-parse --git-dir");
			} catch (error) {
				vscode.window.showErrorMessage(
					"Current workspace is not a git repository",
				);
				return "";
			}

			// Get the base branch and handle cases where there's no upstream
			let baseBranch: string;
			try {
				baseBranch = await this.getBaseBranch();
			} catch (error) {
				// No upstream, try to detect main/master branch
				const branches = await this.executeGitCommand(
					'git branch --format="%(refname:short)"',
				);
				baseBranch =
					branches.split("\n").find((b) => ["main", "master"].includes(b)) ||
					"HEAD~1";
			}

			// Get merge base, fallback to first commit if no common ancestor
			let mergeBase: string;
			try {
				mergeBase = await this.executeGitCommand(
					`git merge-base HEAD ${baseBranch}`,
				);
			} catch (error) {
				try {
					// Fallback to first commit
					mergeBase = await this.executeGitCommand(
						"git rev-list --max-parents=0 HEAD",
					);
				} catch (innerError) {
					// If all else fails, use HEAD~1
					mergeBase = "HEAD~1";
				}
			}

			if (includeCommittedChanges) {
				// Get all changes against base branch including working directory
				try {
					const allChanges = await this.executeGitCommand(
						`git diff ${mergeBase} ${pathSpec}`,
					);
					if (allChanges) {
						diffCommands.push(allChanges);
					}
				} catch (error) {
					console.warn("Failed to get branch changes:", error);
				}
			}

			// Get staged changes that aren't committed
			if (includeStagedChanges) {
				try {
					const stagedDiff = await this.executeGitCommand(
						`git diff --staged ${pathSpec}`,
					);
					if (stagedDiff) {
						diffCommands.push(stagedDiff);
					}
				} catch (error) {
					console.warn("Failed to get staged changes:", error);
				}
			}

			// Get unstaged changes in tracked files
			if (includeUnstagedChanges) {
				try {
					const unstagedDiff = await this.executeGitCommand(
						`git diff ${pathSpec}`,
					);
					if (unstagedDiff) {
						diffCommands.push(unstagedDiff);
					}
				} catch (error) {
					console.warn("Failed to get unstaged changes:", error);
				}
			}

			// Get untracked files
			if (includeUntrackedFiles) {
				try {
					const untrackedFiles = await this.executeGitCommand(
						"git ls-files --others --exclude-standard",
					);
					if (untrackedFiles) {
						const files = untrackedFiles.split("\n").filter(Boolean);
						for (const file of files) {
							try {
								// Use fs.readFile instead of git diff for untracked files
								const absolutePath = path.join(this.cwd, file);
								const content = await vscode.workspace.fs.readFile(
									vscode.Uri.file(absolutePath),
								);
								const fileContent = Buffer.from(content).toString("utf-8");

								// Generate diff-like output for untracked files
								diffCommands.push(
									[
										`diff --git a/${file} b/${file}`,
										"new file mode 100644",
										"index 0000000..0000000",
										"--- /dev/null",
										`+++ b/${file}`,
										`@@ -0,0 +1,${fileContent.split("\n").length} @@`,
										...fileContent.split("\n").map((line) => `+${line}`),
									].join("\n"),
								);
							} catch (error) {
								console.warn(
									`Failed to process untracked file ${file}:`,
									error,
								);
							}
						}
					}
				} catch (error) {
					console.warn("Failed to get untracked files:", error);
				}
			}

			// Return combined diffs or empty string
			const combinedDiff = diffCommands.filter(Boolean).join("\n");
			if (!combinedDiff) {
				vscode.window.showInformationMessage(
					"No changes detected in the workspace",
				);
			}
			return combinedDiff;
		} catch (error) {
			console.error("Error generating diff:", error);
			vscode.window.showErrorMessage(
				"Failed to generate diff. See console for details.",
			);
			return "";
		}
	}

	/**
	 * Shows diff for a specific file
	 * @param filePath The path of the file to show diff for
	 * @returns The git diff output for the specified file
	 */
	public async showDiffForFile(filePath: string): Promise<string> {
		return this.executeGitCommand(`git diff HEAD -- "${filePath}"`);
	}

	/**
	 * Gets a list of changed files in the current branch
	 * @returns Array of changed file paths
	 */
	public async getChangedFiles(): Promise<string[]> {
		const output = await this.executeGitCommand("git diff HEAD --name-only");
		return output.split("\n").filter((file) => file.length > 0);
	}
}
