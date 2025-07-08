import type { StructuredToolInterface } from "@langchain/core/dist/tools/types";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
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
import { createWriteFileTool } from "./tools/write_file";
import { createResearchTool } from "./tools/research";
import { createFileInspectorTool } from "./tools/file_inspector";
import { createIntegrateBackgroundWorkTool } from "./tools/integrate_background_work";
import type { SymbolRetriever } from "./files/symbols";
import type { DiagnosticRetriever } from "./files/diagnostics";
import {
	type BaseCheckpointSaver,
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
import { z } from "zod/v4";
import { compactConversationPrompt } from "./prompts/compact";
import { buildHumanMessages } from "./prompts/human";
import {
	createBackgroundAgentTool,
	BackgroundAgentManager,
	type BackgroundAgentEventEmitter,
	type BackgroundAgentStatus,
} from "./tools/background_agent";
import { EventEmitter } from "node:events";

export type { BackgroundAgentStatus, BackgroundAgentEventEmitter };

export const AvailableTools = [
	"background_agent",
	"integrate_background_work",
	"web_search",
	"thinking",
	"command_execute",
	"read_file",
	"list_directory",
	"edit_file",
	"research",
	"file_inspector",
] as const;
export type AvailableToolsType = (typeof AvailableTools)[number];

/**
 * Configuration schema for Wingman AI Agent
 * 
 * @example
 * ```typescript
 * import { WingmanAgent } from '@wingman-ai/agent';
 * import { ChatOpenAI } from '@langchain/openai';
 * 
 * const agent = new WingmanAgent({
 *   name: "My Coding Assistant",
 *   model: new ChatOpenAI({ model: "gpt-4" }),
 *   workingDirectory: "/path/to/project",
 *   mode: "vibe",
 *   backgroundAgentConfig: {
 *     pushToRemote: true,
 *     createPullRequest: true,
 *     pullRequestTitle: "🤖 {agentName}: {input}",
 *     pullRequestBody: "Automated changes by {agentName}\n\nTask: {input}\n\nFiles changed:\n{changedFiles}"
 *   },
 *   tools: ["background_agent", "edit_file", "command_execute"]
 * });
 * ```
 */
export const WingmanAgentConfigSchema = z.object({
	/**
	 * Display name for the agent
	 * @example "My Coding Assistant"
	 */
	name: z.string().min(1, "Agent name is required"),
	
	/**
	 * Custom system prompt to override the default system prompt
	 * If not provided, the agent will use the built-in system prompt
	 * @example "You are a senior TypeScript developer focused on clean code and best practices."
	 */
	prompt: z.string().optional(),
	
	/**
	 * Additional instructions that augment the system prompt
	 * These are appended to the system prompt to provide specific guidance
	 * @example "Always use TypeScript strict mode and prefer functional programming patterns."
	 */
	instructions: z
		.string()
		.describe(
			"Additional instructions for the agent that augment the system prompt",
		)
		.optional(),
	
	/**
	 * LangChain chat model instance for the agent
	 * Supports OpenAI, Anthropic, Google, and other LangChain-compatible models
	 * @example new ChatOpenAI({ model: "gpt-4", temperature: 0.1 })
	 * @example new ChatAnthropic({ model: "claude-3-sonnet-20240229" })
	 */
	model: z.custom<BaseChatModel>().refine(
		(val) => {
			return val && (val.lc_namespace as string[]).includes("langchain");
		},
		{
			message: "Agent model must be a valid LangChain model.",
		},
	),
	
	/**
	 * Working directory for the agent
	 * If not specified, uses the current working directory
	 * @example "/Users/username/projects/my-app"
	 * @default process.cwd()
	 */
	workingDirectory: z.string().optional(),
	
	/**
	 * Agent interaction mode
	 * - "interactive": More conversational, asks for confirmation
	 * - "vibe": More autonomous, takes action based on context
	 * @default "vibe"
	 */
	mode: z.enum(["interactive", "vibe"]).default("vibe"),
	
	/**
	 * Memory/checkpoint saver for conversation persistence
	 * If not provided, uses in-memory storage
	 * @example new RedisSaver(redisClient)
	 */
	memory: z.custom<BaseCheckpointSaver>().optional(),
	
	/**
	 * Configuration for background agent behavior
	 * Controls how background agents integrate their work back into the main branch
	 */
	backgroundAgentConfig: z
		.object({
			/**
			 * Whether background agents should push their branches to the remote repository
			 * - false: Local-only integration (merge directly in local repo)
			 * - true: Push to remote before integration
			 * @default false
			 * @example true // Enable remote push for team collaboration
			 */
			pushToRemote: z
				.boolean()
				.describe(
					"Whether background agents should push their branches to the remote repository (defaults to false for local-only integration)",
				)
				.default(false),
			
			/**
			 * Whether to automatically create a pull request when pushing to remote
			 * Requires pushToRemote to be true
			 * When enabled, creates PR instead of direct merge
			 * @default false
			 * @example true // Create PRs for code review
			 */
			createPullRequest: z
				.boolean()
				.describe(
					"Whether to automatically create a pull request when pushing to remote (requires pushToRemote to be true)",
				)
				.default(false),
			
			/**
			 * Template for pull request title
			 * Available placeholders:
			 * - {agentName}: Name of the background agent
			 * - {input}: The task description given to the agent
			 * @default "Background Agent: {agentName}"
			 * @example "🤖 Automated: {agentName} - {input}"
			 */
			pullRequestTitle: z
				.string()
				.describe(
					"Template for pull request title. Use {agentName} and {input} placeholders",
				)
				.default("Background Agent: {agentName}"),
			
			/**
			 * Template for pull request body
			 * Available placeholders:
			 * - {agentName}: Name of the background agent
			 * - {input}: The task description given to the agent
			 * - {changedFiles}: List of files that were modified
			 * @default "This pull request was automatically created by background agent: **{agentName}**\n\n## Task\n{input}\n\n## Changed Files\n{changedFiles}"
			 * @example "## Automated Changes\n\nAgent: **{agentName}**\nTask: {input}\n\n### Files Modified\n{changedFiles}\n\n---\n*This PR was created automatically by Wingman AI*"
			 */
			pullRequestBody: z
				.string()
				.describe(
					"Template for pull request body. Use {agentName}, {input}, and {changedFiles} placeholders",
				)
				.default(
					"This pull request was automatically created by background agent: **{agentName}**\n\n## Task\n{input}\n\n## Changed Files\n{changedFiles}",
				),
		})
		.optional(),
	
	/**
	 * Tool-specific capabilities and restrictions
	 */
	toolAbilities: z
		.object({
			/**
			 * Symbol retrieval capabilities for code analysis
			 * Provides the agent with the ability to understand code structure
			 * @example symbolRetriever // Your symbol retriever instance
			 */
			symbolRetriever: z
				.any()
				.describe("Symbol retrieval capabilities")
				.optional(),
			
			/**
			 * File diagnostics capabilities for error detection
			 * Enables the agent to detect and analyze code issues
			 * @example diagnosticRetriever // Your diagnostic retriever instance
			 */
			fileDiagnostics: z
				.any()
				.describe("File diagnostics capabilities")
				.optional(),
			
			/**
			 * List of commands that the agent should not execute
			 * Prevents potentially destructive operations
			 * @default ["rm", "rmdir", "del", "format", "fdisk", "mkfs", "dd", "sudo rm", "sudo rmdir", "chmod 777", "chown", "passwd", "su", "sudo su"]
			 * @example ["rm", "sudo", "chmod 777"] // Block dangerous commands
			 */
			blockedCommands: z
				.array(z.string())
				.optional()
				.describe(
					"List of commands that the agent should not execute. Defaults to common destructive commands.",
				)
				.default(DEFAULT_BLOCKED_COMMANDS),
			
			/**
			 * Whether the agent is allowed to execute scripts or commands
			 * When false, prevents all command execution for safety
			 * @default true
			 * @example false // Disable all command execution
			 */
			allowScriptExecution: z
				.boolean()
				.describe(
					"Whether the agent is allowed to execute scripts or commands that can modify the system.",
				)
				.default(true),
		})
		.optional(),
	
	/**
	 * List of available tools for the agent
	 * Controls which capabilities the agent has access to
	 * @default All available tools
	 * @example ["edit_file", "read_file", "command_execute"] // Minimal toolset
	 * @example ["background_agent", "web_search", "research"] // Research-focused
	 */
	tools: z
		.array(z.enum(AvailableTools))
		.default([...AvailableTools])
		.optional()
		.describe("List of available tools for the agent"),
});

/**
 * Type definition for Wingman Agent configuration
 * 
 * @example
 * ```typescript
 * const config: WingmanAgentConfig = {
 *   name: "Code Assistant",
 *   model: new ChatOpenAI({ model: "gpt-4" }),
 *   backgroundAgentConfig: {
 *     pushToRemote: true,
 *     createPullRequest: true
 *   }
 * };
 * ```
 */
export type WingmanAgentConfig = z.infer<typeof WingmanAgentConfigSchema>;

const WingmanInternalConfigSchema = WingmanAgentConfigSchema.extend({
	workingDirectory: z.string(),
	instructions: z
		.string()
		.describe(
			"Additional instructions for the agent that augment the system prompt",
		)
		.optional(),
	backgroundAgentConfig: z.object({
		pushToRemote: z.boolean().default(false),
		createPullRequest: z.boolean().default(false),
		pullRequestTitle: z.string().default("Background Agent: {agentName}"),
		pullRequestBody: z
			.string()
			.default(
				"This pull request was automatically created by background agent: **{agentName}**\n\n## Task\n{input}\n\n## Changed Files\n{changedFiles}",
			),
	}),
	toolAbilities: z.object({
		symbolRetriever: z
			.any()
			.describe("Symbol retrieval capabilities")
			.optional(),
		fileDiagnostics: z
			.any()
			.describe("File diagnostics capabilities")
			.optional(),
		blockedCommands: z
			.array(z.string())
			.optional()
			.describe("List of commands that the agent should not execute")
			.default(DEFAULT_BLOCKED_COMMANDS),
		allowScriptExecution: z
			.boolean()
			.describe(
				"Whether the agent is allowed to execute scripts or commands that can modify the system.",
			)
			.default(true),
	}),
	tools: z
		.array(z.enum(AvailableTools))
		.optional()
		.default([...AvailableTools])
		.describe("List of available tools for the agent"),
});

export type WingmanConfig = z.infer<typeof WingmanInternalConfigSchema>;

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
		this.config = {
			workingDirectory: process.cwd(),
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
				console.log(
					`Background agent ${data.threadId} completed with status: ${data.status}`,
				);
			},
		);

		this.backgroundAgentEventEmitter.on("error", (data: { error: string }) => {
			console.error(`Background agent error: ${data.error}`);
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

			console.log(
				`Updated background agent status for ${status.agentName}: ${status.status}`,
			);
		} catch (error) {
			console.error(
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
		// Gather MCP tools
		const remoteTools: StructuredToolInterface[] = [];
		await this.mcpAdapter.initialize();
		const mcpTools = await this.mcpAdapter.getTools();
		if (mcpTools) {
			for (const [_, tool] of Object.entries(mcpTools)) {
				remoteTools.push(tool);
			}
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
					} else {
						console.warn(
							"Background agent tool is not available because git is not installed.",
						);
					}
					break;
				case "integrate_background_work":
					if (await isGitAvailable()) {
						this.tools.push(
							createIntegrateBackgroundWorkTool(this.config.workingDirectory),
						);
					} else {
						console.warn(
							"Background work integration tool is not available because git is not installed.",
						);
					}
					break;
				case "web_search":
					this.tools.push(createWebSearchTool(this.storagePath));
					break;
				case "thinking":
					this.tools.push(createThinkingTool());
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
					break;
				case "read_file":
					this.tools.push(createReadFileTool(this.config.workingDirectory));
					break;
				case "list_directory":
					this.tools.push(
						createListDirectoryTool(this.config.workingDirectory),
					);
					break;
				case "edit_file":
					this.tools.push(
						createWriteFileTool(
							this.config.workingDirectory,
							this.config.mode === "vibe",
						),
					);
					break;
				case "research":
					this.tools.push(
						createResearchTool(this.config.workingDirectory, this.config.model),
					);
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
					} else {
						console.warn(
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

		const graphState = await this.app.getState({
			configurable: {
				thread_id: threadId,
			},
		});
		const state = graphState.values as WingmanGraphState;
		if (!state || !state.messages || state.messages.length === 0) {
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
		const manager = BackgroundAgentManager.getInstance();
		manager.terminateAgent(threadId);
	}
}