import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class DiffGenerator {
	private readonly cwd: string;

	constructor(workingDirectory: string) {
		this.cwd = workingDirectory;
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

	/**
	 * Generates diffs for all changed files in the current branch
	 * @returns The git diff output
	 */
	public async generateDiffs(): Promise<string> {
		return this.executeGitCommand("git diff HEAD");
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
