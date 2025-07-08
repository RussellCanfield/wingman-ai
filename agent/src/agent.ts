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

export const WingmanAgentConfigSchema = z.object({
	name: z.string().min(1, "Agent name is required"),
	prompt: z.string().optional(),
	instructions: z
		.string()
		.describe(
			"Additional instructions for the agent that augment the system prompt",
		)
		.optional(),
	model: z.custom<BaseChatModel>().refine(
		(val) => {
			return val && (val.lc_namespace as string[]).includes("langchain");
		},
		{
			message: "Agent model must be a valid LangChain model.",
		},
	),
	workingDirectory: z.string().optional(),
	mode: z.enum(["interactive", "vibe"]).default("vibe"),
	memory: z.custom<BaseCheckpointSaver>().optional(),
	toolAbilities: z
		.object({
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
				.describe(
					"List of commands that the agent should not execute. Defaults to common destructive commands.",
				)
				.default(DEFAULT_BLOCKED_COMMANDS),
			allowScriptExecution: z
				.boolean()
				.describe(
					"Whether the agent is allowed to execute scripts or commands that can modify the system.",
				)
				.default(true),
		})
		.optional(),
	tools: z
		.array(z.enum(AvailableTools))
		.default([...AvailableTools])
		.optional()
		.describe("List of available tools for the agent"),
});

export type WingmanAgentConfig = z.infer<typeof WingmanAgentConfigSchema>;

const WingmanInternalConfigSchema = WingmanAgentConfigSchema.extend({
	workingDirectory: z.string(),
	instructions: z
		.string()
		.describe(
			"Additional instructions for the agent that augment the system prompt",
		)
		.optional(),
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

export type WingmanRequest = {
	input: string;
	threadId?: string;
	contextFiles?: string[];
	contextDirectories?: string[];
};

export class WingmanAgent {
	private readonly mcpAdapter: MCPAdapter;
	private readonly config: WingmanConfig;
	private readonly storagePath: string;
	private tools: Array<StructuredTool | StructuredToolInterface> = [];
	private app: CompiledStateGraph<any, any, any, any> | undefined;
	private backgroundAgentEventEmitter: BackgroundAgentEventEmitter;
	public currentThreadId: string | undefined;

	public get events(): BackgroundAgentEventEmitter {
		return this.backgroundAgentEventEmitter;
	}

	constructor(wingmanConfig: WingmanAgentConfig) {
		const validatedConfig = WingmanAgentConfigSchema.parse(wingmanConfig);
		this.config = {
			workingDirectory: process.cwd(),
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

			system.content += `\n\n# Background Agent Status\nYou currently have the following background agents:\n${backgroundAgentInfo}\n\nUse the 'integrate_background_work' tool to manage integration of completed work.`;
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

	// Method to terminate all background agents
	terminateBackgroundAgents() {
		const manager = BackgroundAgentManager.getInstance();
		manager.terminateAllAgents();
	}

	// Method to terminate a specific background agent
	terminateBackgroundAgent(threadId: string) {
		const manager = BackgroundAgentManager.getInstance();
		manager.terminateAgent(threadId);
	}
}
