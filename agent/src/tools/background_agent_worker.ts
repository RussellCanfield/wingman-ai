import { parentPort, workerData } from "node:worker_threads";
import { WingmanAgent, type WingmanConfig } from "../agent";
import type {
	BackgroundAgentStatus,
	BackgroundAgentIntegration,
} from "./background_agent";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs";
import { getCurrentBranch, getRepoRoot } from "../utils";

const execAsync = promisify(exec);

interface BackgroundAgentMessage {
	type: "start" | "status" | "complete" | "error";
	data: Partial<BackgroundAgentStatus> | { error: string };
}

// Serializable version of WingmanConfig
interface SerializableWingmanConfig {
	name: string;
	prompt?: string;
	instructions?: string;
	modelConfig: {
		provider: string;
		model: string;
		temperature?: number;
		apiKey?: string;
	};
	workingDirectory: string;
	mode: "interactive" | "vibe";
	backgroundAgentConfig: {
		pushToRemote: boolean;
		createPullRequest: boolean;
		pullRequestTitle: string;
		pullRequestBody: string;
	};
	toolAbilities?: {
		symbolRetriever?: any;
		fileDiagnostics?: any;
		blockedCommands?: string[];
	};
	tools?: string[];
}

interface BackgroundAgentWorkerData {
	config: SerializableWingmanConfig;
	input: string;
	agentName: string;
	threadId: string;
	mainBranch: string;
	autoIntegrate: boolean;
	repoPath: string;
}

// Helper function to reconstruct the model from serializable config
function reconstructModel(
	modelConfig: SerializableWingmanConfig["modelConfig"],
): BaseChatModel {
	switch (modelConfig.provider) {
		case "google-genai":
			return new ChatGoogleGenerativeAI({
				model: modelConfig.model,
				temperature: modelConfig.temperature,
				apiKey: modelConfig.apiKey,
			});
		case "anthropic":
			return new ChatAnthropic({
				model: modelConfig.model,
				temperature: modelConfig.temperature,
				apiKey: modelConfig.apiKey,
			});
		case "openai":
			return new ChatOpenAI({
				model: modelConfig.model,
				temperature: modelConfig.temperature,
				apiKey: modelConfig.apiKey,
			});
		default:
			// Fallback to Google Generative AI if provider is unknown
			console.warn(
				`Unknown model provider: ${modelConfig.provider}, falling back to Google Generative AI`,
			);
			return new ChatGoogleGenerativeAI({
				model: modelConfig.model || "gemini-pro",
				temperature: modelConfig.temperature || 0,
				apiKey: modelConfig.apiKey || process.env.GOOGLE_API_KEY,
			});
	}
}

class BackgroundAgentWorker {
	private config: BackgroundAgentWorkerData;
	private agent: WingmanAgent | null = null;

	constructor(config: BackgroundAgentWorkerData) {
		this.config = config;
	}

	private sendMessage(message: BackgroundAgentMessage) {
		// Add console logging for local debugging
		console.log(
			`[BackgroundWorker] ${message.type.toUpperCase()}:`,
			JSON.stringify(message.data, null, 2),
		);

		if (parentPort) {
			parentPort.postMessage(message);
		} else {
			// When running with tsx locally, parentPort might be null
			console.warn(
				"[BackgroundWorker] No parentPort available - running in standalone mode",
			);
		}
	}

	private sendStatus(status: Partial<BackgroundAgentStatus>) {
		console.log("[BackgroundWorker] STATUS UPDATE:", {
			threadId: status.threadId,
			status: status.status,
			agentName: status.agentName,
		});

		this.sendMessage({
			type: "status",
			data: status,
		});
	}

	private async getChangedFiles(worktreePath: string): Promise<string[]> {
		try {
			// Get the commit hash where the worktree branched from
			const { stdout: baseCommit } = await execAsync(
				`git -C "${worktreePath}" merge-base HEAD origin/${this.config.mainBranch}`,
				{
					cwd: this.config.repoPath,
				},
			);

			// Compare against that base commit
			const { stdout } = await execAsync(
				`git -C "${worktreePath}" diff --name-only ${baseCommit.trim()}`,
				{
					cwd: this.config.repoPath,
				},
			);
			return stdout
				.trim()
				.split("\n")
				.filter((file) => file.length > 0);
		} catch (error) {
			console.warn(`Failed to get changed files: ${error}`);
			return [];
		}
	}

	private async cleanupWorktreeDirectory(worktreePath: string): Promise<void> {
		try {
			// Remove the worktree directory from filesystem
			if (fs.existsSync(worktreePath)) {
				await fs.promises.rm(worktreePath, { recursive: true, force: true });
				console.log(
					`[BackgroundWorker] Cleaned up worktree directory: ${worktreePath}`,
				);
			}
		} catch (error) {
			console.warn(
				`[BackgroundWorker] Failed to cleanup worktree directory: ${error}`,
			);
		}
	}

	/**
	 * Try to get GitHub authentication token from various sources
	 */
	private async getGitHubToken(): Promise<string | undefined> {
		// 1. Check environment variables (most common)
		const envTokens = [
			process.env.GITHUB_TOKEN,
			process.env.GH_TOKEN,
			process.env.GITHUB_PAT,
			process.env.GH_PAT,
		];

		for (const token of envTokens) {
			if (token) {
				console.log("[BackgroundWorker] Found GitHub token in environment");
				return token;
			}
		}

		// 2. Try to get token from GitHub CLI if available
		try {
			const { stdout } = await execAsync("gh auth token", {
				cwd: this.config.repoPath,
			});
			const token = stdout.trim();
			if (token) {
				console.log("[BackgroundWorker] Found GitHub token from gh CLI");
				return token;
			}
		} catch (error) {
			// GitHub CLI not available or not authenticated
		}

		// 3. Try to extract from git config (less common but possible)
		try {
			const { stdout } = await execAsync(
				"git config --get github.token",
				{
					cwd: this.config.repoPath,
				}
			);
			const token = stdout.trim();
			if (token) {
				console.log("[BackgroundWorker] Found GitHub token in git config");
				return token;
			}
		} catch (error) {
			// No token in git config
		}

		console.warn("[BackgroundWorker] No GitHub token found in any location");
		return undefined;
	}

	/**
	 * Parse GitHub repository information from remote URL
	 */
	private parseGitHubRepo(remoteUrl: string): { owner: string; repo: string } | null {
		// Handle both HTTPS and SSH URLs
		const httpsMatch = remoteUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+)(?:\.git)?/);
		if (httpsMatch) {
			return { owner: httpsMatch[1], repo: httpsMatch[2] };
		}
		return null;
	}

	/**
	 * Create pull request using Octokit (GitHub API)
	 */
	private async createGitHubPullRequestWithOctokit(
		worktreeBranch: string,
		changedFiles: string[],
		repoRoot: string,
	): Promise<string | undefined> {
		try {
			// Dynamic import to avoid requiring @octokit/rest if not needed
			const { Octokit } = await import("@octokit/rest");

			const token = await this.getGitHubToken();
			if (!token) {
				console.warn("[BackgroundWorker] No GitHub token available for Octokit");
				return undefined;
			}

			// Get remote URL and parse repository info
			const { stdout: remoteUrl } = await execAsync(
				"git remote get-url origin",
				{ cwd: repoRoot }
			);

			const repoInfo = this.parseGitHubRepo(remoteUrl.trim());
			if (!repoInfo) {
				console.warn("[BackgroundWorker] Could not parse GitHub repository info");
				return undefined;
			}

			const octokit = new Octokit({ auth: token });

			// Format changed files for PR body
			const changedFilesText =
				changedFiles.length > 0
					? changedFiles.map((file) => `- ${file}`).join("\n")
					: "No files changed";

			// Replace placeholders in PR title and body
			const title = this.config.config.backgroundAgentConfig.pullRequestTitle
				.replace("{agentName}", this.config.agentName)
				.replace("{input}", this.config.input);

			const body = this.config.config.backgroundAgentConfig.pullRequestBody
				.replace("{agentName}", this.config.agentName)
				.replace("{input}", this.config.input)
				.replace("{changedFiles}", changedFilesText);

			// Create the pull request
			const response = await octokit.rest.pulls.create({
				owner: repoInfo.owner,
				repo: repoInfo.repo,
				title,
				body,
				head: worktreeBranch,
				base: this.config.mainBranch,
			});

			const prUrl = response.data.html_url;
			console.log(`[BackgroundWorker] Created pull request via Octokit: ${prUrl}`);
			return prUrl;
		} catch (error) {
			console.error(
				`[BackgroundWorker] Failed to create GitHub pull request via Octokit: ${error}`,
			);
			return undefined;
		}
	}

	/**
	 * Create pull request using GitHub CLI
	 */
	private async createGitHubPullRequestWithCLI(
		worktreeBranch: string,
		changedFiles: string[],
		repoRoot: string,
	): Promise<string | undefined> {
		try {
			// Check if GitHub CLI is available
			await execAsync("gh --version", { cwd: repoRoot });

			// Format changed files for PR body
			const changedFilesText =
				changedFiles.length > 0
					? changedFiles.map((file) => `- ${file}`).join("\n")
					: "No files changed";

			// Replace placeholders in PR title and body
			const title = this.config.config.backgroundAgentConfig.pullRequestTitle
				.replace("{agentName}", this.config.agentName)
				.replace("{input}", this.config.input);

			const body = this.config.config.backgroundAgentConfig.pullRequestBody
				.replace("{agentName}", this.config.agentName)
				.replace("{input}", this.config.input)
				.replace("{changedFiles}", changedFilesText);

			// Create the pull request
			const { stdout } = await execAsync(
				`gh pr create --title "${title}" --body "${body}" --head ${worktreeBranch} --base ${this.config.mainBranch}`,
				{ cwd: repoRoot }
			);

			const prUrl = stdout.trim();
			console.log(`[BackgroundWorker] Created pull request via GitHub CLI: ${prUrl}`);
			return prUrl;
		} catch (error) {
			console.error(
				`[BackgroundWorker] Failed to create GitHub pull request via CLI: ${error}`,
			);
			return undefined;
		}
	}

	private async createPullRequest(
		worktreeBranch: string,
		changedFiles: string[],
		repoRoot: string,
	): Promise<string | undefined> {
		try {
			// Get remote URL to determine the platform (GitHub, GitLab, etc.)
			const { stdout: remoteUrl } = await execAsync(
				"git remote get-url origin",
				{
					cwd: repoRoot,
				},
			);

			const cleanUrl = remoteUrl.trim();

			// Check if it's a GitHub repository
			if (cleanUrl.includes("github.com")) {
				console.log("[BackgroundWorker] Detected GitHub repository");

				// Try Octokit first (more reliable and doesn't require CLI installation)
				let prUrl = await this.createGitHubPullRequestWithOctokit(
					worktreeBranch,
					changedFiles,
					repoRoot,
				);

				// Fallback to GitHub CLI if Octokit fails
				if (!prUrl) {
					console.log("[BackgroundWorker] Octokit failed, trying GitHub CLI...");
					prUrl = await this.createGitHubPullRequestWithCLI(
						worktreeBranch,
						changedFiles,
						repoRoot,
					);
				}

				return prUrl;
			}

			// Add support for other platforms here (GitLab, Bitbucket, etc.)
			console.warn(
				`[BackgroundWorker] Pull request creation not supported for: ${cleanUrl}`,
			);
			return undefined;
		} catch (error) {
			console.error(
				`[BackgroundWorker] Failed to create pull request: ${error}`,
			);
			return undefined;
		}
	}

	private async createGitHubPullRequest(
		worktreeBranch: string,
		changedFiles: string[],
		repoRoot: string,
	): Promise<string | undefined> {
		// This method is kept for backward compatibility but now just calls the main createPullRequest method
		return this.createPullRequest(worktreeBranch, changedFiles, repoRoot);
	}

	private async attemptIntegration(
		worktreeBranch: string,
		worktreePath: string,
		targetBranch: string,
		repoRoot: string,
	): Promise<BackgroundAgentIntegration> {
		const integration: BackgroundAgentIntegration = {
			targetBranch,
			worktreePath,
			mergeAttempted: false,
			mergeSuccessful: false,
		};

		try {
			// Get changed files before attempting merge
			integration.changedFiles = await this.getChangedFiles(worktreePath);

			console.log(
				`[BackgroundWorker] Attempting to integrate ${worktreeBranch} into ${targetBranch}`,
			);
			console.log(
				`[BackgroundWorker] Changed files: ${integration.changedFiles?.join(", ") || "none"}`,
			);

			const { pushToRemote, createPullRequest } =
				this.config.config.backgroundAgentConfig;

			if (pushToRemote) {
				// Remote integration workflow
				console.log("[BackgroundWorker] Using remote integration workflow");

				// Step 1: Push the worktree branch to remote
				await execAsync(
					`git -C "${worktreePath}" push origin ${worktreeBranch}`,
					{ cwd: repoRoot },
				);
				console.log(`[BackgroundWorker] Pushed ${worktreeBranch} to origin`);

				if (createPullRequest) {
					// Create a pull request instead of direct merge
					const prUrl = await this.createPullRequest(
						worktreeBranch,
						integration.changedFiles || [],
						repoRoot,
					);

					if (prUrl) {
						integration.pullRequestUrl = prUrl;
						integration.mergeAttempted = true;
						integration.mergeSuccessful = true; // PR creation is considered success

						console.log(`[BackgroundWorker] Successfully created PR: ${prUrl}`);

						// Clean up local worktree directory but keep remote branch
						await this.cleanupWorktreeDirectory(worktreePath);

						return integration;
					}
					throw new Error("Failed to create pull request");
				}
				// Direct merge workflow with remote push
				// Step 2: Fetch in main repo
				await execAsync(`git fetch origin ${worktreeBranch}`, {
					cwd: repoRoot,
				});

				// Step 3: Checkout target branch
				await execAsync(`git checkout ${targetBranch}`, {
					cwd: repoRoot,
				});

				// Step 4: Merge
				await execAsync(`git merge origin/${worktreeBranch}`, {
					cwd: repoRoot,
				});

				integration.mergeAttempted = true;
				integration.mergeSuccessful = true;

				console.log(
					`[BackgroundWorker] Successfully integrated ${worktreeBranch} into ${targetBranch}`,
				);

				// Step 5: Clean up remote branch (user chose not to keep it)
				try {
					await execAsync(`git push origin --delete ${worktreeBranch}`, {
						cwd: repoRoot,
					});
					console.log(
						`[BackgroundWorker] Deleted remote branch ${worktreeBranch}`,
					);
				} catch (deleteError) {
					console.warn(
						`[BackgroundWorker] Failed to delete remote branch: ${deleteError}`,
					);
				}
			} else {
				// Local-only integration workflow
				console.log("[BackgroundWorker] Using local-only integration workflow");

				// Step 1: Checkout target branch in main repo
				await execAsync(`git checkout ${targetBranch}`, {
					cwd: repoRoot,
				});

				// Step 2: Merge the worktree branch directly (local merge)
				await execAsync(`git merge ${worktreeBranch}`, {
					cwd: repoRoot,
				});

				integration.mergeAttempted = true;
				integration.mergeSuccessful = true;

				console.log(
					`[BackgroundWorker] Successfully integrated ${worktreeBranch} into ${targetBranch} (local-only)`,
				);
			}

			// Clean up worktree directory after successful integration
			await this.cleanupWorktreeDirectory(worktreePath);

			// Remove worktree from git's tracking
			try {
				await execAsync(`git worktree remove "${worktreePath}" --force`, {
					cwd: repoRoot,
				});
				console.log(
					`[BackgroundWorker] Removed worktree from git tracking: ${worktreePath}`,
				);
			} catch (cleanupError) {
				console.warn(
					`[BackgroundWorker] Failed to remove worktree from git tracking: ${cleanupError}`,
				);
			}
		} catch (error: any) {
			integration.mergeAttempted = true;
			integration.mergeSuccessful = false;
			integration.errorMessage = error.message;

			console.error(`[BackgroundWorker] Integration failed: ${error.message}`);

			// Check if it's a merge conflict
			if (
				error.message.includes("CONFLICT") ||
				error.message.includes("conflict")
			) {
				try {
					// Get conflict files from the main repo
					const { stdout } = await execAsync("git status --porcelain", {
						cwd: repoRoot,
					});

					integration.conflictFiles = stdout
						.split("\n")
						.filter(
							(line) =>
								line.startsWith("UU") ||
								line.startsWith("AA") ||
								line.startsWith("DD"),
						)
						.map((line) => line.substring(3));

					console.log(
						`[BackgroundWorker] Merge conflicts detected in files: ${integration.conflictFiles.join(", ")}`,
					);
				} catch (statusError) {
					console.warn(
						`[BackgroundWorker] Failed to get conflict status: ${statusError}`,
					);
				}
			}

			// Clean up on failure
			if (this.config.config.backgroundAgentConfig.pushToRemote) {
				// Clean up remote branch if it was pushed
				try {
					await execAsync(`git push origin --delete ${worktreeBranch}`, {
						cwd: repoRoot,
					});
					console.log(
						`[BackgroundWorker] Cleaned up remote branch ${worktreeBranch} after failed integration`,
					);
				} catch (cleanupError) {
					console.warn(
						`[BackgroundWorker] Failed to cleanup remote branch: ${cleanupError}`,
					);
				}
			}

			// Always clean up local worktree directory on failure
			await this.cleanupWorktreeDirectory(worktreePath);
		}

		return integration;
	}

	async run() {
		try {
			const repoRoot = await getRepoRoot(this.config.repoPath);
			const worktreeBranch = `background-${this.config.threadId}`;
			const worktreePath = path.resolve(repoRoot, worktreeBranch);

			// Send initial status
			this.sendStatus({
				threadId: this.config.threadId,
				input: this.config.input,
				worktreeBranch,
				agentName: this.config.agentName,
				status: "running",
			});

			// Reconstruct the model from serializable config
			const model = reconstructModel(this.config.config.modelConfig);

			// Create WingmanConfig with reconstructed model
			const wingmanConfig: WingmanConfig = {
				name: this.config.config.name,
				prompt: this.config.config.prompt,
				instructions: this.config.config.instructions,
				model: model,
				workingDirectory: this.config.config.workingDirectory,
				mode: this.config.config.mode,
				backgroundAgentConfig: this.config.config.backgroundAgentConfig,
				toolAbilities: {
					...(this.config.config.toolAbilities ?? {}),
					blockedCommands: [],
					allowScriptExecution: true,
				},
				//@ts-expect-error
				tools: this.config.config.tools ? this.config.config.tools : [],
			};

			// Create and initialize the background agent
			this.agent = new WingmanAgent({
				...wingmanConfig,
			});

			await this.agent.initialize();

			// Execute the background task
			await this.agent.invoke({
				threadId: this.config.threadId,
				input: `# AUTONOMOUS MODE: 
You are the background agent that performs tasks autonomously in a git worktree.
Complete the task in an isolated worktree without user interaction.

## Setup
**You must always create a new worktree for each task.**
Create worktree: \`git worktree add -b ${worktreeBranch} ../${worktreeBranch} origin/${this.config.mainBranch}\`

## Work Location
- CWD: \`${this.config.repoPath}\`
- Worktree: \`../${worktreeBranch}\`
- All file paths: \`../${worktreeBranch}/filename\`
- All commands: \`cd ../${worktreeBranch} && command\`

## Complete Task
Execute, commit changes with \`git -C ../${worktreeBranch} add . && git -C ../${worktreeBranch} commit -m "message"\`

## Constraints
No approval, no user interaction, no interactive tools, work only in \`${worktreeBranch}\` branch.

## Task
${this.config.input}

Begin.
`,
			});

			// Task completed successfully, now attempt integration if enabled
			if (this.config.autoIntegrate) {
				this.sendStatus({
					threadId: this.config.threadId,
					input: this.config.input,
					worktreeBranch,
					agentName: this.config.agentName,
					status: "integrating",
				});

				const targetBranch = (await getCurrentBranch(repoRoot)) ?? "main";
				const integration = await this.attemptIntegration(
					worktreeBranch,
					worktreePath,
					targetBranch,
					repoRoot,
				);

				const finalStatus: "integrated" | "conflict" =
					integration.mergeSuccessful ? "integrated" : "conflict";

				// Send final status with integration information
				this.sendStatus({
					threadId: this.config.threadId,
					input: this.config.input,
					worktreeBranch,
					agentName: this.config.agentName,
					status: finalStatus,
					integration,
				});

				this.sendMessage({
					type: "complete",
					data: {
						threadId: this.config.threadId,
						status: finalStatus,
					},
				});
			} else {
				// Auto-integration disabled, just mark as completed
				const integration: BackgroundAgentIntegration = {
					targetBranch: (await getCurrentBranch(repoRoot)) ?? "main",
					worktreePath,
					mergeAttempted: false,
					changedFiles: await this.getChangedFiles(worktreePath),
				};

				this.sendStatus({
					threadId: this.config.threadId,
					input: this.config.input,
					worktreeBranch,
					agentName: this.config.agentName,
					status: "completed",
					integration,
				});

				this.sendMessage({
					type: "complete",
					data: {
						threadId: this.config.threadId,
						status: "completed",
					},
				});
			}
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred";

			console.error("[BackgroundWorker] Error:", error);

			// Send failure status
			this.sendStatus({
				threadId: this.config.threadId,
				input: this.config.input,
				worktreeBranch: `background-${this.config.threadId}`,
				agentName: this.config.agentName,
				status: "failed",
			});

			this.sendMessage({
				type: "error",
				data: { error: errorMessage },
			});
		}
	}
}

// Initialize and run the worker
if (workerData) {
	const worker = new BackgroundAgentWorker(
		workerData as BackgroundAgentWorkerData,
	);
	worker.run().catch((error) => {
		console.error("[BackgroundWorker] Fatal error:", error);
		if (parentPort) {
			parentPort.postMessage({
				type: "error",
				data: { error: error instanceof Error ? error.message : String(error) },
			});
		}
	});
}

// Handle termination signals
if (parentPort) {
	parentPort.on("message", (message) => {
		if (message === "terminate") {
			console.log("[BackgroundWorker] Received termination signal");
			process.exit(0);
		}
	});
}