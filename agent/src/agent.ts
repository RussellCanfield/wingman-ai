import type { StructuredToolInterface } from "@langchain/core/dist/tools/types";
import type { StructuredTool } from "@langchain/core/tools";
import { MCPAdapter } from "./tools/mcpAdapter";
import getGlobalStoragePath, { isGitAvailable } from "./utils";
import { getSystemPrompt } from "./prompts/system";
import os from "node:os";
import { createWebSearchTool } from "./tools/web_search";
import { createThinkingTool } from "./tools/think";
import {
	createCommandExecuteTool,
	DEFAULT_BLOCKED_COMMANDS,
} from "./tools/cmd_execute";
import { createReadFileTool } from "./tools/read_file";
import { createListDirectoryTool } from "./tools/list_workspace_files";
import { createWriteFileTool } from "./tools/edit_file";
import { createResearchTool } from "./tools/research";
import { createFileInspectorTool } from "./tools/file_inspector";
import { createIntegrateBackgroundWorkTool } from "./tools/integrate_background_work";
import type { SymbolRetriever } from "./files/symbols";
import type { DiagnosticRetriever } from "./files/diagnostics";
import {
	type CompiledStateGraph,
	END,
	MemorySaver,
	START,
	StateGraph,
} from "@langchain/langgraph";
import { GraphAnnotation, type WingmanGraphState } from "./state/graph";
import { ChatAnthropic } from "@langchain/anthropic";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
	AIMessage,
	RemoveMessage,
	SystemMessage,
} from "@langchain/core/messages";
import { compactConversationPrompt } from "./prompts/compact";
import { buildHumanMessages } from "./prompts/human";
import {
	createBackgroundAgentTool,
	BackgroundAgentManager,
	type BackgroundAgentEventEmitter,
	type BackgroundAgentStatus,
} from "./tools/background_agent";
import { EventEmitter } from "node:events";
import { type Logger, createLogger } from "./logger";
import {
	WingmanAgentConfigSchema,
	type WingmanConfig,
	type WingmanAgentConfig,
	AvailableTools,
} from "./config";

export type { BackgroundAgentStatus, BackgroundAgentEventEmitter };

/**
 * Request object for agent invocation
 *
 * @example
 * ```typescript
 * const request: WingmanRequest = {
 *   input: "Create a new React component for user authentication",
 *   threadId: "user-session-123",
 *   contextFiles: ["src/types/user.ts", "src/utils/auth.ts"],
 *   contextDirectories: ["src/components"]
 * };
 * ```
 */
export type WingmanRequest = {
	/** The user's input/request to the agent */
	input: string;
	/** Optional thread ID for conversation continuity */
	threadId?: string;
	/** Optional list of files to provide as context */
	contextFiles?: string[];
	/** Optional list of directories to provide as context */
	contextDirectories?: string[];
};

/**
 * Main Wingman AI Agent class
 *
 * @example
 * ```typescript
 * import { WingmanAgent } from '@wingman-ai/agent';
 * import { ChatOpenAI } from '@langchain/openai';
 *
 * const agent = new WingmanAgent({
 *   name: "My Assistant",
 *   model: new ChatOpenAI({ model: "gpt-4" }),
 *   workingDirectory: process.cwd(),
 *   backgroundAgentConfig: {
 *     pushToRemote: true,
 *     createPullRequest: true
 *   }
 * });
 *
 * await agent.initialize();
 *
 * // Stream responses
 * for await (const chunk of agent.stream({ input: "Create a new feature" })) {
 *   console.log(chunk);
 * }
 *
 * // Or get final result
 * const result = await agent.invoke({ input: "Fix the bug in auth.ts" });
 * ```
 */
export class WingmanAgent {
	private readonly mcpAdapter: MCPAdapter;
	private readonly config: WingmanConfig;
	private readonly storagePath: string;
	private readonly logger: Logger;
	private tools: Array<StructuredTool | StructuredToolInterface> = [];
	private app: CompiledStateGraph<any, any, any, any> | undefined;
	private backgroundAgentEventEmitter: BackgroundAgentEventEmitter;
	public currentThreadId: string | undefined;

	/**
	 * Event emitter for background agent status updates
	 *
	 * @example
	 * ```typescript
	 * agent.events.on('status', (status) => {
	 *   console.log(`Agent ${status.agentName}: ${status.status}`);
	 * });
	 *
	 * agent.events.on('complete', (data) => {
	 *   console.log(`Agent completed with status: ${data.status}`);
	 * });
	 * ```
	 */
	public get events(): BackgroundAgentEventEmitter {
		return this.backgroundAgentEventEmitter;
	}

	/**
	 * Creates a new Wingman Agent instance
	 *
	 * @param wingmanConfig - Configuration object for the agent
	 *
	 * @example
	 * ```typescript
	 * const agent = new WingmanAgent({
	 *   name: "Code Assistant",
	 *   model: new ChatOpenAI({ model: "gpt-4" }),
	 *   mode: "vibe",
	 *   tools: ["edit_file", "command_execute", "background_agent"]
	 * });
	 * ```
	 */
	constructor(wingmanConfig: WingmanAgentConfig) {
		const validatedConfig = WingmanAgentConfigSchema.parse(wingmanConfig);

		// Create logger first
		const logger =
			validatedConfig.logger || createLogger(validatedConfig.logLevel);

		this.config = {
			workingDirectory: process.cwd(),
			logger,
			backgroundAgentConfig: {
				pushToRemote: false,
				createPullRequest: false,
				pullRequestTitle: "Wingman-AI Background Agent: {agentName}",
				pullRequestBody:
					"This pull request was automatically created by Wingman-AI Background Agent: **{agentName}**\n\n## Task\n{input}\n\n## Changed Files\n{changedFiles}",
			},
			toolAbilities: {
				blockedCommands: DEFAULT_BLOCKED_COMMANDS,
				allowScriptExecution: true,
			},
			tools: [...AvailableTools],
			...validatedConfig,
			instructions: validatedConfig.instructions || "",
		};

		this.logger = logger;
		this.mcpAdapter = new MCPAdapter(this.config.workingDirectory);
		this.storagePath = getGlobalStoragePath(this.config.workingDirectory);
		this.backgroundAgentEventEmitter =
			new EventEmitter() as BackgroundAgentEventEmitter;
		this.setupBackgroundAgentEventHandlers();
	}

	private setupBackgroundAgentEventHandlers = () => {
		this.backgroundAgentEventEmitter.on(
			"status",
			(status: BackgroundAgentStatus) => {
				this.handleBackgroundAgentStatusUpdate(status);
			},
		);

		this.backgroundAgentEventEmitter.on(
			"complete",
			(data: {
				threadId: string;
				status: "completed" | "integrated" | "conflict";
			}) => {
				this.logger.info(
					`Background agent ${data.threadId} completed with status: ${data.status}`,
				);
			},
		);

		this.backgroundAgentEventEmitter.on("error", (data: { error: string }) => {
			this.logger.error(`Background agent error: ${data.error}`);
		});
	};

	private handleBackgroundAgentStatusUpdate = async (
		status: BackgroundAgentStatus,
	) => {
		if (!this.app || !this.currentThreadId) {
			return;
		}

		try {
			// Update the LangGraph state with the background agent status
			await this.app.updateState(
				{
					configurable: {
						thread_id: this.currentThreadId,
					},
				},
				{
					backgroundAgentTasks: {
						[status.threadId]: status,
					},
				},
				"tools",
			);

			this.logger.info(
				`Updated background agent status for ${status.agentName}: ${status.status}`,
			);
		} catch (error) {
			this.logger.error(
				"Failed to update background agent status in graph state:",
				error,
			);
		}
	};

	private async buildSystemPrompt(): Promise<string> {
		const userInfo = os.userInfo();
		const machineInfo = `# User's Machine Information
Operating System: ${os.platform()}
Architecture: ${os.arch()}
Default Shell: ${userInfo.shell}`;

		const systemPrompt = await getSystemPrompt(
			machineInfo,
			this.config.workingDirectory,
			await isGitAvailable(),
		);

		return `${systemPrompt}
		
${this.config.instructions}
`;
	}

	/**
	 * Initialize the agent and set up tools
	 * Must be called before using the agent
	 *
	 * @example
	 * ```typescript
	 * const agent = new WingmanAgent(config);
	 * await agent.initialize();
	 * // Agent is now ready to use
	 * ```
	 */
	async initialize() {
		this.logger.info("Initializing Wingman Agent...");

		// Gather MCP tools
		const remoteTools: StructuredToolInterface[] = [];
		await this.mcpAdapter.initialize();
		const mcpTools = await this.mcpAdapter.getTools();
		if (mcpTools) {
			for (const [_, tool] of Object.entries(mcpTools)) {
				remoteTools.push(tool);
			}
			this.logger.debug(`Loaded ${remoteTools.length} MCP tools`);
		}

		for (const toolName of this.config.tools ?? []) {
			switch (toolName) {
				case "background_agent":
					if (await isGitAvailable()) {
						this.tools.push(
							createBackgroundAgentTool(
								this.config,
								this.backgroundAgentEventEmitter,
							),
						);
						this.logger.debug("Added background_agent tool");
					} else {
						this.logger.warn(
							"Background agent tool is not available because git is not installed.",
						);
					}
					break;
				case "integrate_background_work":
					if (await isGitAvailable()) {
						this.tools.push(
							createIntegrateBackgroundWorkTool(this.config.workingDirectory),
						);
						this.logger.debug("Added integrate_background_work tool");
					} else {
						this.logger.warn(
							"Background work integration tool is not available because git is not installed.",
						);
					}
					break;
				case "web_search":
					this.tools.push(createWebSearchTool(this.storagePath));
					this.logger.debug("Added web_search tool");
					break;
				case "thinking":
					this.tools.push(createThinkingTool());
					this.logger.debug("Added thinking tool");
					break;
				case "command_execute":
					this.tools.push(
						createCommandExecuteTool(
							this.config.workingDirectory,
							undefined,
							this.config.toolAbilities?.blockedCommands ||
								DEFAULT_BLOCKED_COMMANDS,
							this.config.toolAbilities?.allowScriptExecution ?? true,
						),
					);
					this.logger.debug("Added command_execute tool");
					break;
				case "read_file":
					this.tools.push(createReadFileTool(this.config.workingDirectory));
					this.logger.debug("Added read_file tool");
					break;
				case "list_directory":
					this.tools.push(
						createListDirectoryTool(this.config.workingDirectory),
					);
					this.logger.debug("Added list_directory tool");
					break;
				case "edit_file":
					this.tools.push(
						createWriteFileTool(
							this.config.workingDirectory,
							this.config.mode === "vibe",
						),
					);
					this.logger.debug("Added edit_file tool");
					break;
				case "research":
					this.tools.push(
						createResearchTool(this.config.workingDirectory, this.config.model),
					);
					this.logger.debug("Added research tool");
					break;
				case "file_inspector":
					if (this.config.toolAbilities?.fileDiagnostics) {
						this.tools.push(
							createFileInspectorTool(
								this.config.toolAbilities.fileDiagnostics
									? this.config.toolAbilities.fileDiagnostics
									: {},
								this.config.workingDirectory,
							),
						);
						this.logger.debug("Added file_inspector tool");
					} else {
						this.logger.warn(
							"File inspector tool is not available because file diagnostics capabilities are not provided.",
						);
					}
					break;
				default:
					break;
			}
		}
		this.tools = this.tools.concat(remoteTools);

		const toolNode = new ToolNode(this.tools);
		const workflow = new StateGraph(GraphAnnotation)
			.addNode("agent", this.callModel)
			.addNode("tools", toolNode)
			.addEdge(START, "agent")
			.addConditionalEdges("agent", this.routerAfterLLM, ["tools", END])
			.addEdge("tools", "agent");

		this.app = workflow.compile({
			checkpointer: this.config.memory ? this.config.memory : new MemorySaver(),
		});

		this.logger.info(`Agent initialized with ${this.tools.length} tools`);
	}

	private callModel = async (state: WingmanGraphState) => {
		const system: SystemMessage = new SystemMessage({
			content: this.config.prompt ?? (await this.buildSystemPrompt()),
		});

		if (this.config.model instanceof ChatAnthropic) {
			//@ts-expect-error
			system.cache_control = { type: "ephemeral" };
		}

		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		const model = this.config.model.bindTools?.(this.tools)!;

		// Add background agent status to system prompt if there are active background agents
		if (
			state.backgroundAgentTasks &&
			Object.keys(state.backgroundAgentTasks).length > 0
		) {
			const backgroundAgentInfo = Object.values(state.backgroundAgentTasks)
				.map((task) => {
					let statusInfo = `- ${task.agentName} (${task.threadId}): ${task.status} - ${task.input}`;

					if (task.integration) {
						if (task.status === "conflict" && task.integration.conflictFiles) {
							statusInfo += `\n  ⚠️  Conflicts in: ${task.integration.conflictFiles.join(", ")}`;
						} else if (task.status === "integrated") {
							statusInfo += "\n  ✅ Successfully integrated";
						} else if (task.status === "completed") {
							statusInfo += "\n  📋 Ready for integration";
						}
					}

					return statusInfo;
				})
				.join("\n");

			system.content += `
			
# Background Agent Status
You currently have the following background agents:
${backgroundAgentInfo}

Ask the user if they want to integrate their changes (using 'integrate_background_work' tool - don't mention it by name) to complete the work.`;
		}

		const response = await model.invoke([system, ...state.messages], {
			// Wait a maximum of 5 minutes
			timeout: 300000,
		});

		return {
			messages: [response],
		} satisfies Partial<WingmanGraphState>;
	};

	private routerAfterLLM = async (state: WingmanGraphState) => {
		if (state.messages.length === 0) return END;

		const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
		if (lastMessage.tool_calls?.length) {
			return "tools";
		}
		return END;
	};

	/**
	 * Compact conversation messages to save memory
	 * Useful for long conversations to prevent context window overflow
	 *
	 * @param threadId - Thread ID to compact messages for
	 *
	 * @example
	 * ```typescript
	 * await agent.compactMessages("thread-123");
	 * ```
	 */
	compactMessages = async (threadId: string) => {
		if (!this.app) {
			throw new Error("Agent is not initialized. Call initialize() first.");
		}

		this.logger.debug(`Compacting messages for thread: ${threadId}`);

		const graphState = await this.app.getState({
			configurable: {
				thread_id: threadId,
			},
		});
		const state = graphState.values as WingmanGraphState;
		if (!state || !state.messages || state.messages.length === 0) {
			this.logger.debug("No messages to compact");
			return;
		}
		const compactResult = await this.config.model.invoke(
			compactConversationPrompt(state.messages),
		);
		const removedMessages: RemoveMessage[] = [];
		for (const message of state.messages) {
			if (!message.id) {
				continue;
			}
			removedMessages.push(new RemoveMessage({ id: message.id }));
		}

		await this.app.updateState(
			{
				configurable: {
					thread_id: threadId,
				},
			},
			{
				messages: [
					...removedMessages,
					new AIMessage({ content: compactResult.content }),
				],
			},
		);

		this.logger.info(
			`Compacted ${removedMessages.length} messages for thread: ${threadId}`,
		);
	};

	/**
	 * Stream agent responses in real-time
	 *
	 * @param request - Request object with input and optional context
	 * @returns Async generator yielding response chunks
	 *
	 * @example
	 * ```typescript
	 * for await (const chunk of agent.stream({ input: "Create a new component" })) {
	 *   console.log(chunk);
	 * }
	 * ```
	 */
	async *stream(request: WingmanRequest) {
		if (!this.app) {
			throw new Error(
				"Agent workflow is not initialized. Call initialize() first.",
			);
		}

		const threadId = request.threadId || new Date().toISOString();
		this.currentThreadId = threadId;

		this.logger.debug(`Starting stream for thread: ${threadId}`);

		const config = {
			recursionLimit: 50,
			streamMode: "values" as const,
			version: "v2" as const,
			configurable: {
				thread_id: threadId,
				checkpoint_ns: "",
			},
		};

		const messages = await buildHumanMessages(
			request,
			this.config.workingDirectory,
			this.config.model,
		);

		const stream = await this.app.stream(
			{
				messages,
			},
			config,
		);
		for await (const output of stream) {
			yield output;
		}
	}

	/**
	 * Stream agent events for detailed monitoring
	 *
	 * @param request - Request object with input and optional context
	 * @returns Async generator yielding event updates
	 *
	 * @example
	 * ```typescript
	 * for await (const event of agent.streamEvents({ input: "Debug the issue" })) {
	 *   if (event.event === 'on_tool_start') {
	 *     console.log(`Tool started: ${event.name}`);
	 *   }
	 * }
	 * ```
	 */
	async *streamEvents(request: WingmanRequest) {
		if (!this.app) {
			throw new Error(
				"Agent workflow is not initialized. Call initialize() first.",
			);
		}

		const threadId = request.threadId || new Date().toISOString();
		this.currentThreadId = threadId;

		this.logger.debug(`Starting event stream for thread: ${threadId}`);

		const config = {
			recursionLimit: 50,
			version: "v2" as const,
			streamMode: "updates" as const,
			configurable: {
				thread_id: threadId,
			},
		};

		const messages = await buildHumanMessages(
			request,
			this.config.workingDirectory,
			this.config.model,
		);

		const stream = await this.app.streamEvents(
			{
				messages,
			},
			config,
		);
		for await (const output of stream) {
			yield output;
		}
	}

	/**
	 * Invoke the agent and wait for completion
	 *
	 * @param request - Request object with input and optional context
	 * @returns Promise resolving to the final result
	 *
	 * @example
	 * ```typescript
	 * const result = await agent.invoke({
	 *   input: "Fix the TypeScript errors in auth.ts",
	 *   contextFiles: ["src/auth.ts", "src/types/user.ts"]
	 * });
	 * ```
	 */
	async invoke(request: WingmanRequest) {
		if (!this.app) {
			throw new Error(
				"Agent workflow is not initialized. Call initialize() first.",
			);
		}

		const threadId = request.threadId || new Date().toISOString();
		this.currentThreadId = threadId;

		this.logger.debug(`Invoking agent for thread: ${threadId}`);

		const config = {
			recursionLimit: 50,
			version: "v2" as const,
			streamMode: "updates" as const,
			configurable: {
				thread_id: threadId,
			},
		};

		const messages = await buildHumanMessages(
			request,
			this.config.workingDirectory,
			this.config.model,
		);

		return this.app.invoke(
			{
				messages,
			},
			config,
		);
	}

	/**
	 * Get the current graph state for a thread
	 *
	 * @param threadId - Thread ID to get state for
	 * @returns Promise resolving to the graph state or undefined
	 *
	 * @example
	 * ```typescript
	 * const state = await agent.getGraphState("thread-123");
	 * console.log(state?.messages.length);
	 * ```
	 */
	getGraphState = async (
		threadId: string,
	): Promise<WingmanGraphState | undefined> => {
		if (!this.app) {
			throw new Error(
				"Agent workflow is not initialized. Call initialize() first.",
			);
		}

		const graphState = await this.app.getState({
			configurable: {
				thread_id: threadId,
			},
		});
		if (!graphState) {
			return undefined;
		}

		return graphState.values as WingmanGraphState;
	};

	/**
	 * Terminate all active background agents
	 *
	 * @example
	 * ```typescript
	 * agent.terminateBackgroundAgents();
	 * ```
	 */
	terminateBackgroundAgents() {
		this.logger.info("Terminating all background agents");
		const manager = BackgroundAgentManager.getInstance();
		manager.terminateAllAgents();
	}

	/**
	 * Terminate a specific background agent
	 *
	 * @param threadId - Thread ID of the background agent to terminate
	 *
	 * @example
	 * ```typescript
	 * agent.terminateBackgroundAgent("bg-agent-123");
	 * ```
	 */
	terminateBackgroundAgent(threadId: string) {
		this.logger.info(`Terminating background agent: ${threadId}`);
		const manager = BackgroundAgentManager.getInstance();
		manager.terminateAgent(threadId);
	}
}
