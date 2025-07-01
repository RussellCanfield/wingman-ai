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
import { AIMessage, RemoveMessage } from "@langchain/core/messages";
import { z } from "zod/v4";
import { compactConversationPrompt } from "./prompts/compact";
import { buildHumanMessages } from "./prompts/human";

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
		})
		.optional(),
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
	}),
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
	private app: // biome-ignore lint/complexity/noBannedTypes: <explanation>
	CompiledStateGraph<unknown, unknown, "__start__", {}> | undefined;

	constructor(wingmanConfig: WingmanAgentConfig) {
		const validatedConfig = WingmanAgentConfigSchema.parse(wingmanConfig);
		this.config = {
			workingDirectory: process.cwd(),
			toolAbilities: {
				blockedCommands: DEFAULT_BLOCKED_COMMANDS,
			},
			...validatedConfig,
			instructions: validatedConfig.instructions || "",
		};
		this.mcpAdapter = new MCPAdapter(this.config.workingDirectory);
		this.storagePath = getGlobalStoragePath(this.config.workingDirectory);
	}

	private async buildSystemPrompt(): Promise<string> {
		const userInfo = os.userInfo();
		const machineInfo = `# User's Machine Information
Operating System: ${os.platform()}
Architecture: ${os.arch()}
Default Shell: ${userInfo.shell}`;

		return getSystemPrompt(
			machineInfo,
			this.config.workingDirectory,
			await isGitAvailable(),
		);
	}

	async initialize() {
		// Gather MCP tools
		const remoteTools: StructuredToolInterface[] = [];
		await this.mcpAdapter.initialize();
		const mcpTools = await this.mcpAdapter.getTools();
		if (mcpTools) {
			for (const [_, tool] of Object.entries(mcpTools)) {
				//@ts-expect-error -- MCP adapter type mismatch
				remoteTools.push(tool);
			}
		}

		this.tools = [
			createWebSearchTool(this.storagePath),
			createThinkingTool(),
			createCommandExecuteTool(this.config.workingDirectory),
			createReadFileTool(this.config.workingDirectory),
			createListDirectoryTool(this.config.workingDirectory),
			createWriteFileTool(
				this.config.workingDirectory,
				this.config.mode === "vibe",
			),
			createResearchTool(this.config.workingDirectory, this.config.model),
			...remoteTools,
		];

		if (this.config.toolAbilities?.fileDiagnostics) {
			this.tools.push(
				createFileInspectorTool(
					this.config.toolAbilities.fileDiagnostics,
					this.config.workingDirectory,
				),
			);
		}

		const toolNode = new ToolNode(this.tools);
		const workflow = new StateGraph(GraphAnnotation)
			.addNode("agent", this.callModel)
			.addNode("tools", toolNode)
			.addEdge(START, "agent")
			.addConditionalEdges("agent", this.routerAfterLLM, ["tools", END])
			.addEdge("tools", "agent");

		//@ts-expect-error
		this.app = workflow.compile({
			checkpointer: this.config.memory ? this.config.memory : new MemorySaver(),
		});
	}

	private callModel = async (state: WingmanGraphState) => {
		if (this.config.model instanceof ChatAnthropic) {
			//@ts-expect-error
			system.cache_control = { type: "ephemeral" };
		}

		// biome-ignore lint/style/noNonNullAssertion: <explanation>
		const model = this.config.model.bindTools?.(this.tools)!;
		const response = await model.invoke(
			[
				{
					role: "system",
					content: this.config.prompt ?? (await this.buildSystemPrompt()),
				},
				...state.messages,
			],
			{
				// Wait a maximum of 5 minutes
				timeout: 300000,
			},
		);

		return {
			messages: [response],
		} satisfies WingmanGraphState;
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

		const config = {
			recursionLimit: 50,
			streamMode: "values" as const,
			version: "v2" as const,
			configurable: {
				thread_id: request.threadId,
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

		const config = {
			recursionLimit: 50,
			version: "v2" as const,
			streamMode: "updates" as const,
			configurable: {
				thread_id: request.threadId,
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
}
