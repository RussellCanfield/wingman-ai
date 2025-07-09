import { tool } from "@langchain/core/tools";
import { ToolMessage } from "@langchain/core/messages";
import { z } from "zod/v4";
import { Worker, type WorkerOptions } from "node:worker_threads";
import { EventEmitter } from "node:events";
import path from "node:path";
import fs from "node:fs";
import { getCurrentBranch } from "../utils";
import type { SerializableLoggerConfig } from "../logger";
import type { WingmanConfig } from "../config";

export type BackgroundAgentIntegration = {
	targetBranch: string;
	conflictFiles?: string[];
	changedFiles?: string[];
	worktreePath: string;
	mergeAttempted: boolean;
	mergeSuccessful?: boolean;
	errorMessage?: string;
	pullRequestUrl?: string;
};

export type BackgroundAgentStatus = {
	threadId: string;
	input: string;
	worktreeBranch: string;
	agentName: string;
	status:
		| "running"
		| "completed"
		| "failed"
		| "integrating"
		| "integrated"
		| "conflict";
	integration?: BackgroundAgentIntegration;
};

export interface BackgroundAgentEventEmitter extends EventEmitter {
	on(event: "status", listener: (status: BackgroundAgentStatus) => void): this;
	on(
		event: "complete",
		listener: (data: {
			threadId: string;
			status: "completed" | "integrated" | "conflict";
		}) => void,
	): this;
	on(event: "error", listener: (data: { error: string }) => void): this;
	emit(event: "status", status: BackgroundAgentStatus): boolean;
	emit(
		event: "complete",
		data: { threadId: string; status: "completed" | "integrated" | "conflict" },
	): boolean;
	emit(event: "error", data: { error: string }): boolean;
}

export const backgroundAgentSchema = z.object({
	input: z.string().describe("The input task description to execute"),
	agentName: z
		.string()
		.describe(
			"Name of the background agent (User Friendly Identifier based on the task)",
		),
	autoIntegrate: z
		.boolean()
		.describe(
			"Whether to automatically attempt to integrate the work back into the working branch (defaults to true)",
		)
		.default(true),
});

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
		// Add other model configuration properties as needed
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
	loggerConfig: SerializableLoggerConfig;
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

// Helper function to extract serializable model configuration
function extractModelConfig(
	model: any,
): SerializableWingmanConfig["modelConfig"] {
	// Handle different model types
	if (model.lc_namespace?.includes("google_genai")) {
		return {
			provider: "google-genai",
			model: model.model || "gemini-pro",
			temperature: model.temperature,
			apiKey: model.apiKey || process.env.GOOGLE_API_KEY,
		};
	}
	if (model.lc_namespace?.includes("anthropic")) {
		return {
			provider: "anthropic",
			model: model.model || "claude-3-sonnet-20240229",
			temperature: model.temperature,
			apiKey: model.apiKey || process.env.ANTHROPIC_API_KEY,
		};
	}
	if (model.lc_namespace?.includes("openai")) {
		return {
			provider: "openai",
			model: model.model || "gpt-4",
			temperature: model.temperature,
			apiKey: model.apiKey || process.env.OPENAI_API_KEY,
		};
	}
	// Fallback - try to extract common properties
	return {
		provider: "unknown",
		model: model.model || model.modelName || "default",
		temperature: model.temperature,
	};
}

// Helper function to extract logger configuration
function extractLoggerConfig(config: WingmanConfig): SerializableLoggerConfig {
	// Try to determine the log level from the logger
	// This is a bit hacky but necessary for serialization
	const logger = config.logger;

	// Check if it's a SilentLogger
	if (logger.constructor.name === "SilentLogger") {
		return { level: "silent" };
	}

	// For WingmanLogger, we need to access the private level property
	// This is not ideal but necessary for worker thread serialization
	const wingmanLogger = logger as any;
	if (wingmanLogger.level) {
		return { level: wingmanLogger.level };
	}

	// Fallback to info level
	return { level: "info" };
}

class BackgroundAgentManager {
	private static instance: BackgroundAgentManager;
	private activeWorkers: Map<string, Worker> = new Map();
	private completedAgents: Map<string, BackgroundAgentStatus> = new Map();
	private eventEmitter: BackgroundAgentEventEmitter;

	private constructor() {
		this.eventEmitter = new EventEmitter() as BackgroundAgentEventEmitter;
	}

	static getInstance(): BackgroundAgentManager {
		if (!BackgroundAgentManager.instance) {
			BackgroundAgentManager.instance = new BackgroundAgentManager();
		}
		return BackgroundAgentManager.instance;
	}

	getEventEmitter(): BackgroundAgentEventEmitter {
		return this.eventEmitter;
	}

	getCompletedAgents(): Map<string, BackgroundAgentStatus> {
		return this.completedAgents;
	}

	async spawnBackgroundAgent(
		threadId: string,
		workerData: BackgroundAgentWorkerData,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			// Get the path to the background agent worker
			const workerPath = this.getWorkerPath();

			if (!workerPath) {
				reject(new Error("Background agent worker file not found"));
				return;
			}

			const workerOptions: WorkerOptions = {
				workerData,
			};

			// If running in a TypeScript environment (ts-node), we need to register ts-node for the worker
			if (workerPath.endsWith(".ts")) {
				workerOptions.execArgv = ["-r", "ts-node/register"];
			}

			// Create the worker thread
			const worker = new Worker(workerPath, workerOptions);

			// Store the active worker
			this.activeWorkers.set(threadId, worker);

			// Handle messages from the background agent worker
			worker.on("message", (message: BackgroundAgentMessage) => {
				switch (message.type) {
					case "status": {
						const status = message.data as BackgroundAgentStatus;
						this.eventEmitter.emit("status", status);

						// Store completed agents for potential integration
						if (
							status.status === "completed" ||
							status.status === "integrated" ||
							status.status === "conflict"
						) {
							this.completedAgents.set(threadId, status);
						}
						break;
					}
					case "complete": {
						const completeData = message.data as {
							threadId: string;
							status: "completed" | "integrated" | "conflict";
						};
						this.eventEmitter.emit("complete", completeData);
						this.cleanup(threadId);
						resolve();
						break;
					}
					case "error":
						this.eventEmitter.emit("error", message.data as { error: string });
						this.cleanup(threadId);
						reject(new Error((message.data as { error: string }).error));
						break;
				}
			});

			// Handle worker errors
			worker.on("error", (error) => {
				this.eventEmitter.emit("error", { error: error.message });
				this.cleanup(threadId);
				reject(error);
			});

			// Handle worker exit
			worker.on("exit", (code) => {
				// When the worker exits, for any reason, remove it from the active list.
				this.activeWorkers.delete(threadId);

				if (code !== 0) {
					// A non-zero exit code indicates an issue. The promise may have already
					// been settled, so we just emit an event rather than rejecting here.
					const error = `Background agent worker exited with code ${code}`;
					this.eventEmitter.emit("error", { error });
				}
				// Do NOT reject the promise here to avoid unhandled rejections.
			});
		});
	}

	private getWorkerPath(): string {
		const jsWorkerPath = path.resolve(__dirname, "background_agent_worker.js");
		if (fs.existsSync(jsWorkerPath)) {
			return jsWorkerPath; // This will be the path in the 'dist' folder
		}

		const tsWorkerPath = path.resolve(__dirname, "background_agent_worker.ts");
		if (fs.existsSync(tsWorkerPath)) {
			// This path is for ts-node/development environments.
			return tsWorkerPath;
		}

		throw new Error("Could not find the background agent worker script.");
	}

	private cleanup(threadId: string) {
		const worker = this.activeWorkers.get(threadId);
		if (worker) {
			// Request graceful shutdown
			worker.postMessage("terminate");

			// Set a timeout to forcefully terminate if it doesn't exit gracefully
			const timeout = setTimeout(() => {
				const stillActiveWorker = this.activeWorkers.get(threadId);
				if (stillActiveWorker) {
					console.warn(
						`[BackgroundAgentManager] Worker ${threadId} did not terminate gracefully. Forcing termination.`,
					);
					stillActiveWorker.terminate();
				}
			}, 2000); // 2-second grace period

			// Once the worker exits, we should clear the timeout.
			worker.once("exit", () => {
				clearTimeout(timeout);
			});
		}
	}

	terminateAgent(threadId: string) {
		this.cleanup(threadId);
		this.completedAgents.delete(threadId);
	}

	terminateAllAgents() {
		for (const [threadId] of this.activeWorkers) {
			this.cleanup(threadId);
		}
		this.completedAgents.clear();
	}

	// Remove completed agent from tracking (after successful integration)
	removeCompletedAgent(threadId: string) {
		this.completedAgents.delete(threadId);
	}
}

/**
 * Spawns a background agent that can perform a task in the background using a worker thread
 */
export const createBackgroundAgentTool = (
	config: WingmanConfig,
	eventEmitter?: BackgroundAgentEventEmitter,
) => {
	const manager = BackgroundAgentManager.getInstance();

	// If an event emitter is provided, forward events to it
	if (eventEmitter) {
		const managerEmitter = manager.getEventEmitter();
		managerEmitter.on("status", (status) =>
			eventEmitter.emit("status", status),
		);
		managerEmitter.on("complete", (data) =>
			eventEmitter.emit("complete", data),
		);
		managerEmitter.on("error", (data) => eventEmitter.emit("error", data));
	}

	return tool(
		async (input: z.infer<typeof backgroundAgentSchema>, toolConfig) => {
			try {
				const threadId = crypto.randomUUID();

				// Create serializable config by extracting model configuration
				const serializableConfig: SerializableWingmanConfig = {
					name: input.agentName || "Background Agent",
					prompt: config.prompt,
					instructions: config.instructions,
					modelConfig: extractModelConfig(config.model),
					workingDirectory: config.workingDirectory,
					mode: config.mode,
					backgroundAgentConfig: config.backgroundAgentConfig,
					toolAbilities: config.toolAbilities,
					tools: config.tools?.filter((t) => t !== "background_agent") || [],
					loggerConfig: extractLoggerConfig(config),
				};

				const workerData: BackgroundAgentWorkerData = {
					config: serializableConfig,
					input: input.input,
					agentName: input.agentName,
					threadId,
					mainBranch:
						(await getCurrentBranch(
							config.workingDirectory || process.cwd(),
						)) ?? "main",
					// Use the autoIntegrate flag from input,
					autoIntegrate: input.autoIntegrate,
					repoPath: config.workingDirectory || process.cwd(),
				};

				// Start the background agent (this will resolve when the agent completes)
				manager.spawnBackgroundAgent(threadId, workerData);

				const integrationMode = config.backgroundAgentConfig.pushToRemote
					? "remote"
					: "local";
				const prInfo = config.backgroundAgentConfig.createPullRequest
					? " with automatic PR creation"
					: "";

				return new ToolMessage({
					id: toolConfig.toolCall.id,
					content: JSON.stringify({
						success: true,
						threadId,
						agentName: input.agentName,
						message: `Background agent '${input.agentName}' has been started successfully.${input.autoIntegrate ? ` Auto-integration is enabled (${integrationMode}${prInfo}).` : " Auto-integration is disabled."}`,
						status: "running",
					}),
					tool_call_id: toolConfig.toolCall.id,
				});
			} catch (error) {
				return new ToolMessage({
					id: toolConfig.toolCall.id,
					content: JSON.stringify({
						success: false,
						error:
							error instanceof Error ? error.message : "Unknown error occurred",
						message: "Failed to create or execute background agent",
					}),
					tool_call_id: toolConfig.toolCall.id,
				});
			}
		},
		{
			name: "background_agent",
			description:
				"Spawns a background agent that can perform a task in the background using a worker thread",
			schema: backgroundAgentSchema,
		},
	);
};

// Export the manager for external access
export { BackgroundAgentManager };
