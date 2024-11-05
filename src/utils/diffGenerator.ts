import * as vscode from "vscode";
import { CodeReview } from "@shared/types/Message";
import { exec } from "child_process";
import { promisify } from "util";
import { getGitignorePatterns } from "../server/files/utils";
import { glob } from "tinyglobby";

const execAsync = promisify(exec);

export class DiffGenerator {
	private readonly cwd: string;

	constructor(workingDirectory: string) {
		this.cwd = workingDirectory;
	}

	/**
	 * Gets the base branch name (usually main or master)
	 * @returns The base branch name
	 */
	public async getBaseBranch(): Promise<string> {
		const upstream = await this.executeGitCommand(
			"git rev-parse --abbrev-ref @{upstream}"
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
				`git merge-base HEAD ${await this.getBaseBranch()}`
			);

			// Get file content at merge base
			return await this.executeGitCommand(
				`git show ${mergeBase.trim()}:${filePath}`
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

	public async generateDiffWithLineNumbersAndMap(): Promise<
		CodeReview["fileDiffMap"]
	> {
		const diffs = await this.executeGitCommand("git diff HEAD");
		if (!diffs) {
			vscode.window.showInformationMessage(
				"No changes detected to review."
			);
			return {};
		}

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
					fileDiffMap[currentFile].diff +=
						"\n" + currentDiff.join("\n");
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
						oldStart: parseInt(oldStart, 10),
						newStart: parseInt(newStart, 10),
						oldLines: parseInt(oldLines || "1", 10),
						newLines: parseInt(newLines || "1", 10),
						lines: [line],
					};
					currentLineNumber = currentHunk.newStart;
				}
			} else if (currentHunk) {
				// Process diff lines with line numbers
				if (line.startsWith("+")) {
					currentHunk.lines.push(
						`${currentLineNumber.toString().padStart(5)} ${line}`
					);
					currentLineNumber++;
				} else if (line.startsWith("-")) {
					currentHunk.lines.push(`     ${line}`);
				} else {
					currentHunk.lines.push(
						`${currentLineNumber.toString().padStart(5)} ${line}`
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
		const output = await this.executeGitCommand(
			"git diff HEAD --name-only"
		);
		return output.split("\n").filter((file) => file.length > 0);
	}
}
