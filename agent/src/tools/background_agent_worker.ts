import { parentPort, workerData } from "node:worker_threads";
import { WingmanAgent, type WingmanConfig } from "../agent";
import type { BackgroundAgentStatus, BackgroundAgentIntegration } from "./background_agent";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

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

	private async getCurrentBranch(): Promise<string> {
		try {
			const { stdout } = await execAsync("git branch --show-current", {
				cwd: this.config.repoPath,
			});
			return stdout.trim();
		} catch (error) {
			console.warn(`Failed to get current branch, using main branch: ${error}`);
			return this.config.mainBranch;
		}
	}

	private async getChangedFiles(worktreePath: string): Promise<string[]> {
		try {
			const { stdout } = await execAsync(`git -C "${worktreePath}" diff --name-only HEAD~1`, {
				cwd: this.config.repoPath,
			});
			return stdout.trim().split('\n').filter(file => file.length > 0);
		} catch (error) {
			console.warn(`Failed to get changed files: ${error}`);
			return [];
		}
	}

	private async attemptIntegration(
		worktreeBranch: string,
		worktreePath: string,
		targetBranch: string
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

			// Ensure we're on the target branch
			await execAsync(`git checkout ${targetBranch}`, {
				cwd: this.config.repoPath,
			});

			// Attempt to merge the worktree branch
			await execAsync(`git merge ${worktreeBranch}`, {
				cwd: this.config.repoPath,
			});

			integration.mergeAttempted = true;
			integration.mergeSuccessful = true;

			console.log(`[BackgroundWorker] Successfully integrated ${worktreeBranch} into ${targetBranch}`);

			// Clean up the worktree after successful integration
			try {
				await execAsync(`git worktree remove "${worktreePath}"`, {
					cwd: this.config.repoPath,
				});
				console.log(`[BackgroundWorker] Cleaned up worktree: ${worktreePath}`);
			} catch (cleanupError) {
				console.warn(`[BackgroundWorker] Failed to cleanup worktree: ${cleanupError}`);
			}

		} catch (error: any) {
			integration.mergeAttempted = true;
			integration.mergeSuccessful = false;
			integration.errorMessage = error.message;

			// Check if it's a merge conflict
			if (error.message.includes('CONFLICT') || error.message.includes('conflict')) {
				try {
					// Get conflict files
					const { stdout } = await execAsync("git status --porcelain", {
						cwd: this.config.repoPath,
					});
					
					integration.conflictFiles = stdout
						.split('\n')
						.filter(line => line.startsWith('UU') || line.startsWith('AA') || line.startsWith('DD'))
						.map(line => line.substring(3));

					console.log(`[BackgroundWorker] Merge conflicts detected in files: ${integration.conflictFiles.join(', ')}`);
				} catch (statusError) {
					console.warn(`[BackgroundWorker] Failed to get conflict status: ${statusError}`);
				}
			}

			console.error(`[BackgroundWorker] Integration failed: ${error.message}`);
		}

		return integration;
	}

	async run() {
		try {
			const worktreeBranch = `background-${this.config.threadId}`;
			const worktreePath = path.resolve(this.config.repoPath, '..', worktreeBranch);

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
				input: `# AUTONOMOUS MODE: Complete task in isolated worktree without user interaction.
**Role Reassignment**: You are a background agent that performs tasks autonomously in a git worktree.

## Setup
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

				const targetBranch = await this.getCurrentBranch();
				const integration = await this.attemptIntegration(
					worktreeBranch,
					worktreePath,
					targetBranch
				);

				const finalStatus: "integrated" | "conflict" = integration.mergeSuccessful ? "integrated" : "conflict";

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
					targetBranch: await this.getCurrentBranch(),
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