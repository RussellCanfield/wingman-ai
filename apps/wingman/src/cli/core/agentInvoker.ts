import { existsSync } from "node:fs";
import { isAbsolute, join, normalize, sep } from "node:path";
import {
	CompositeBackend,
	createDeepAgent,
	FilesystemBackend,
} from "deepagents";
import {
	modelRetryMiddleware,
	summarizationMiddleware,
	toolRetryMiddleware,
} from "langchain";
import { v4 as uuidv4 } from "uuid";
import type { WingmanAgentConfig } from "@/agent/config/agentConfig.js";
import { MCPClientManager } from "@/agent/config/mcpClientManager.js";
import { additionalMessageMiddleware } from "@/agent/middleware/additional-messages.js";
import { mergeHooks } from "@/agent/middleware/hooks/merger.js";
import { createHooksMiddleware } from "@/agent/middleware/hooks.js";
import { mediaCompatibilityMiddleware } from "@/agent/middleware/media-compat.js";
import {
	getSharedTerminalSessionManager,
	type TerminalSessionManager,
} from "@/agent/tools/terminal_session_manager.js";
import { getBundledSkillsPath } from "@/agent/uiRegistry.js";
import type { WingmanAgent } from "@/types/agents.js";
import type { MCPServersConfig } from "@/types/mcp.js";
import { AgentLoader } from "../../agent/config/agentLoader.js";
import type { Logger } from "../../logger.js";
import { WingmanConfigLoader } from "../config/loader.js";
import type { WingmanConfigType } from "../config/schema.js";
import type { OutputManager } from "./outputManager.js";
import type { SessionManager } from "./sessionManager.js";

export interface AgentInvokerOptions {
	workspace?: string;
	configDir?: string;
	outputManager: OutputManager;
	logger: Logger;
	sessionManager?: SessionManager;
	terminalSessionManager?: TerminalSessionManager;
	workdir?: string | null;
	defaultOutputDir?: string | null;
}

export interface InvokeAgentOptions {
	signal?: AbortSignal;
}

export type ImageAttachment = {
	kind?: "image";
	dataUrl: string;
	mimeType?: string;
	name?: string;
	size?: number;
};

export type AudioAttachment = {
	kind: "audio";
	dataUrl: string;
	mimeType?: string;
	name?: string;
	size?: number;
};

export type FileAttachment = {
	kind: "file";
	dataUrl: string;
	textContent: string;
	mimeType?: string;
	name?: string;
	size?: number;
};

export type MediaAttachment =
	| ImageAttachment
	| AudioAttachment
	| FileAttachment;

type UserContentPart =
	| { type: "text"; text: string }
	| { type: "image_url"; image_url: { url: string } }
	| { type: "audio"; source_type: "base64"; data: string; mime_type?: string }
	| { type: "audio"; source_type: "url"; url: string; mime_type?: string }
	| {
			type: "input_file";
			file_data?: string;
			file_url?: string;
			filename?: string;
	  }
	| {
			type: "file";
			source_type: "base64" | "url";
			mime_type: string;
			data?: string;
			url?: string;
			metadata?: {
				filename: string;
				name: string;
				title: string;
			};
	  };

export const WORKDIR_VIRTUAL_PATH = "/workdir/";
export const OUTPUT_VIRTUAL_PATH = "/output/";
export const AGENTS_MEMORY_VIRTUAL_PATHS = ["/AGENTS.md"] as const;

export type ExternalOutputMount = {
	virtualPath: string | null;
	absolutePath: string | null;
};

export type SummarizationMiddlewareSettings = {
	maxTokensBeforeSummary: number;
	messagesToKeep: number;
};

export type ModelRetryMiddlewareSettings = {
	maxRetries: number;
	backoffFactor: number;
	initialDelayMs: number;
	maxDelayMs: number;
	jitter: boolean;
	onFailure: "continue" | "error";
};

export type ToolRetryMiddlewareSettings = ModelRetryMiddlewareSettings & {
	tools?: string[];
};

export type HumanInTheLoopSettings = {
	interruptOn: Record<
		string,
		| boolean
		| {
				allowedDecisions: Array<"approve" | "edit" | "reject">;
				description?: string;
				argsSchema?: Record<string, any>;
		  }
	>;
};

const DEFAULT_DEEPAGENT_MODEL = "claude-sonnet-4-5-20250929";

const isPathWithinRoot = (targetPath: string, rootPath: string): boolean => {
	const normalizedTarget = normalize(targetPath);
	const normalizedRoot = normalize(rootPath);
	return (
		normalizedTarget === normalizedRoot ||
		normalizedTarget.startsWith(normalizedRoot + sep)
	);
};

export const resolveExecutionWorkspace = (
	workspace: string,
	workdir?: string | null,
): string => {
	if (!workdir) return normalize(workspace);
	if (isAbsolute(workdir)) return normalize(workdir);
	return normalize(join(workspace, workdir));
};

export const resolveAgentExecutionWorkspace = (
	workspace: string,
	workdir?: string | null,
	defaultOutputDir?: string | null,
): string => {
	const preferredWorkdir = workdir || defaultOutputDir || null;
	return resolveExecutionWorkspace(workspace, preferredWorkdir);
};

export const resolveAgentMemorySources = (
	executionWorkspace: string,
): string[] => {
	return AGENTS_MEMORY_VIRTUAL_PATHS.filter((memoryPath) =>
		existsSync(join(executionWorkspace, memoryPath.replace(/^\/+/, ""))),
	);
};

export const toWorkspaceAliasVirtualPath = (
	absolutePath: string,
): string | null => {
	const normalized = normalize(absolutePath);
	if (!isAbsolute(normalized)) return null;
	const posixPath = normalized.replace(/\\/g, "/");
	const trimmed = posixPath.replace(/^\/+/, "").replace(/\/+$/, "");
	if (!trimmed) return null;
	return `/${trimmed}/`;
};

export const resolveExternalOutputMount = (
	workspace: string,
	workdir?: string | null,
	defaultOutputDir?: string | null,
): ExternalOutputMount => {
	if (workdir && !isPathWithinRoot(workdir, workspace)) {
		return {
			virtualPath: WORKDIR_VIRTUAL_PATH,
			absolutePath: workdir,
		};
	}
	if (
		!workdir &&
		defaultOutputDir &&
		!isPathWithinRoot(defaultOutputDir, workspace)
	) {
		return {
			virtualPath: OUTPUT_VIRTUAL_PATH,
			absolutePath: defaultOutputDir,
		};
	}
	return {
		virtualPath: null,
		absolutePath: null,
	};
};

export const resolveSummarizationMiddlewareSettings = (
	config: WingmanConfigType,
): SummarizationMiddlewareSettings | null => {
	if (!config.summarization?.enabled) {
		return null;
	}
	return {
		maxTokensBeforeSummary: config.summarization.maxTokensBeforeSummary,
		messagesToKeep: config.summarization.messagesToKeep,
	};
};

export const resolveModelRetryMiddlewareSettings = (
	config: WingmanConfigType,
): ModelRetryMiddlewareSettings | null => {
	if (!config.modelRetry?.enabled) {
		return null;
	}
	return {
		maxRetries: config.modelRetry.maxRetries,
		backoffFactor: config.modelRetry.backoffFactor,
		initialDelayMs: config.modelRetry.initialDelayMs,
		maxDelayMs: config.modelRetry.maxDelayMs,
		jitter: config.modelRetry.jitter,
		onFailure: config.modelRetry.onFailure,
	};
};

export const resolveToolRetryMiddlewareSettings = (
	config: WingmanConfigType,
): ToolRetryMiddlewareSettings | null => {
	if (!config.toolRetry?.enabled) {
		return null;
	}
	return {
		maxRetries: config.toolRetry.maxRetries,
		backoffFactor: config.toolRetry.backoffFactor,
		initialDelayMs: config.toolRetry.initialDelayMs,
		maxDelayMs: config.toolRetry.maxDelayMs,
		jitter: config.toolRetry.jitter,
		onFailure: config.toolRetry.onFailure,
		...(config.toolRetry.tools && config.toolRetry.tools.length > 0
			? { tools: config.toolRetry.tools }
			: {}),
	};
};

export const resolveHumanInTheLoopSettings = (
	config: WingmanConfigType,
): HumanInTheLoopSettings | null => {
	if (!config.humanInTheLoop?.enabled) {
		return null;
	}
	const interruptOn = config.humanInTheLoop.interruptOn || {};
	if (Object.keys(interruptOn).length === 0) {
		return null;
	}
	return {
		interruptOn,
	};
};

export const configureDeepAgentSummarizationMiddleware = (
	agent: any,
	settings: SummarizationMiddlewareSettings | null,
	model?: any,
): void => {
	const middleware = agent?.options?.middleware;
	if (!Array.isArray(middleware)) {
		return;
	}
	const index = middleware.findIndex(
		(entry: any) => entry?.name === "SummarizationMiddleware",
	);
	if (index < 0) {
		return;
	}

	if (!settings) {
		middleware.splice(index, 1);
		return;
	}

	middleware[index] = summarizationMiddleware({
		model: model || DEFAULT_DEEPAGENT_MODEL,
		trigger: { tokens: settings.maxTokensBeforeSummary },
		keep: { messages: settings.messagesToKeep },
	});
};

type ToolEventContext = {
	event: "on_tool_start" | "on_tool_end" | "on_tool_error";
	toolName: string;
};

export const detectToolEventContext = (
	chunk: unknown,
): ToolEventContext | null => {
	if (!chunk || typeof chunk !== "object" || Array.isArray(chunk)) {
		return null;
	}
	const eventChunk = chunk as Record<string, unknown>;
	if (
		eventChunk.event !== "on_tool_start" &&
		eventChunk.event !== "on_tool_end" &&
		eventChunk.event !== "on_tool_error"
	) {
		return null;
	}
	const toolName =
		typeof eventChunk.name === "string" && eventChunk.name.trim()
			? eventChunk.name.trim()
			: "unknown";
	return {
		event: eventChunk.event,
		toolName,
	};
};

export const chunkHasAssistantText = (chunk: unknown): boolean => {
	if (!chunk || typeof chunk !== "object" || Array.isArray(chunk)) {
		return false;
	}

	const eventChunk = chunk as Record<string, unknown>;
	const eventName =
		typeof eventChunk.event === "string" ? eventChunk.event : undefined;

	if (eventName === "on_chat_model_stream") {
		const data =
			eventChunk.data && typeof eventChunk.data === "object"
				? (eventChunk.data as Record<string, unknown>)
				: null;
		const messageChunk =
			(data?.chunk as Record<string, unknown> | undefined) ||
			(data?.message as Record<string, unknown> | undefined);
		const content = messageChunk?.content;
		if (typeof content === "string") {
			return content.length > 0;
		}
		if (Array.isArray(content)) {
			return content.some(
				(part) =>
					part &&
					typeof part === "object" &&
					(part as Record<string, unknown>).type === "text" &&
					typeof (part as Record<string, unknown>).text === "string" &&
					((part as Record<string, unknown>).text as string).length > 0,
			);
		}
	}

	if (eventName === "on_llm_stream") {
		const data =
			eventChunk.data && typeof eventChunk.data === "object"
				? (eventChunk.data as Record<string, unknown>)
				: null;
		const llmChunk =
			data?.chunk && typeof data.chunk === "object"
				? (data.chunk as Record<string, unknown>)
				: null;
		return typeof llmChunk?.text === "string" && llmChunk.text.length > 0;
	}

	return false;
};

export const selectStreamingFallbackText = (
	previousMessages: Array<{
		role?: unknown;
		content?: unknown;
	}>,
	currentMessages: Array<{
		role?: unknown;
		content?: unknown;
	}>,
): string | undefined => {
	if (currentMessages.length === 0) {
		return undefined;
	}

	const previousAssistantCounts = new Map<string, number>();
	for (const message of previousMessages) {
		if (!message || typeof message !== "object") {
			continue;
		}
		if (message.role !== "assistant") {
			continue;
		}
		if (typeof message.content !== "string") {
			continue;
		}
		const content = message.content.trim();
		if (!content) {
			continue;
		}
		previousAssistantCounts.set(
			content,
			(previousAssistantCounts.get(content) || 0) + 1,
		);
	}

	let fallback: string | undefined;
	for (const message of currentMessages) {
		if (!message || typeof message !== "object") {
			continue;
		}
		if (message.role !== "assistant") {
			continue;
		}
		if (typeof message.content !== "string") {
			continue;
		}
		const content = message.content.trim();
		if (!content) {
			continue;
		}
		const remaining = previousAssistantCounts.get(content) || 0;
		if (remaining > 0) {
			previousAssistantCounts.set(content, remaining - 1);
			continue;
		}
		fallback = content;
	}
	return fallback;
};

export const detectStreamErrorMessage = (
	chunk: unknown,
): string | undefined => {
	if (!chunk || typeof chunk !== "object" || Array.isArray(chunk)) {
		return undefined;
	}

	const eventChunk = chunk as Record<string, unknown>;
	const eventName =
		typeof eventChunk.event === "string" ? eventChunk.event : undefined;
	if (!eventName || !eventName.endsWith("_error")) {
		return undefined;
	}
	if (eventName === "on_tool_error") {
		return undefined;
	}

	const data =
		eventChunk.data && typeof eventChunk.data === "object"
			? (eventChunk.data as Record<string, unknown>)
			: null;
	const errorPayload =
		data?.error || eventChunk.error || data?.output || data?.chunk;

	if (typeof errorPayload === "string" && errorPayload.trim()) {
		return errorPayload.trim();
	}
	if (errorPayload && typeof errorPayload === "object") {
		const record = errorPayload as Record<string, unknown>;
		if (typeof record.message === "string" && record.message.trim()) {
			return record.message.trim();
		}
		if (typeof record.error === "string" && record.error.trim()) {
			return record.error.trim();
		}
	}
	if (errorPayload !== undefined && errorPayload !== null) {
		return String(errorPayload);
	}

	return eventName;
};

const extractStreamEventRecord = (
	chunk: unknown,
): Record<string, unknown> | null => {
	if (!chunk || typeof chunk !== "object" || Array.isArray(chunk)) {
		return null;
	}
	const record = chunk as Record<string, unknown>;
	return typeof record.event === "string" ? record : null;
};

const normalizeEventName = (value: unknown): string | undefined => {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim();
	return normalized.length > 0 ? normalized.toLowerCase() : undefined;
};

const normalizeEventParentRunIds = (value: unknown): string[] => {
	if (Array.isArray(value)) {
		return value
			.filter((item): item is string => typeof item === "string")
			.map((item) => item.trim())
			.filter(Boolean);
	}
	if (typeof value === "string" && value.trim()) {
		return [value.trim()];
	}
	return [];
};

const extractEventParentRunIds = (
	eventRecord: Record<string, unknown>,
): string[] => {
	const parentCandidates = [
		eventRecord.parent_ids,
		eventRecord.parentIds,
		(eventRecord.metadata as Record<string, unknown> | undefined)?.parent_ids,
		(eventRecord.metadata as Record<string, unknown> | undefined)?.parentIds,
		(eventRecord.data as Record<string, unknown> | undefined)?.parent_ids,
		(eventRecord.data as Record<string, unknown> | undefined)?.parentIds,
	];

	for (const candidate of parentCandidates) {
		const parentIds = normalizeEventParentRunIds(candidate);
		if (parentIds.length > 0) {
			return parentIds;
		}
	}
	return [];
};

const extractEventRunId = (
	eventRecord: Record<string, unknown>,
): string | undefined => {
	const runCandidates = [
		eventRecord.run_id,
		eventRecord.runId,
		(eventRecord.data as Record<string, unknown> | undefined)?.run_id,
		(eventRecord.data as Record<string, unknown> | undefined)?.runId,
	];

	for (const candidate of runCandidates) {
		if (typeof candidate === "string" && candidate.trim()) {
			return candidate.trim();
		}
	}
	return undefined;
};

const isRootLangGraphChainEvent = (
	eventRecord: Record<string, unknown>,
	eventType: "on_chain_start" | "on_chain_end",
): boolean => {
	if (eventRecord.event !== eventType) {
		return false;
	}
	const eventName = normalizeEventName(eventRecord.name);
	if (eventName !== "langgraph") {
		return false;
	}
	return extractEventParentRunIds(eventRecord).length === 0;
};

export const trackRootLangGraphRunId = (
	currentRootLangGraphRunId: string | undefined,
	chunk: unknown,
): string | undefined => {
	if (currentRootLangGraphRunId) {
		return currentRootLangGraphRunId;
	}
	const eventRecord = extractStreamEventRecord(chunk);
	if (
		!eventRecord ||
		!isRootLangGraphChainEvent(eventRecord, "on_chain_start")
	) {
		return currentRootLangGraphRunId;
	}
	return extractEventRunId(eventRecord) || currentRootLangGraphRunId;
};

export const isRootLangGraphTerminalEvent = (
	chunk: unknown,
	rootLangGraphRunId?: string,
): boolean => {
	const eventRecord = extractStreamEventRecord(chunk);
	if (!eventRecord || !isRootLangGraphChainEvent(eventRecord, "on_chain_end")) {
		return false;
	}
	if (!rootLangGraphRunId) {
		return true;
	}
	const chunkRunId = extractEventRunId(eventRecord);
	if (!chunkRunId) {
		return true;
	}
	return Boolean(chunkRunId && chunkRunId === rootLangGraphRunId);
};

export const emitCompletionAndContinuePostProcessing = (input: {
	outputManager: Pick<OutputManager, "emitAgentComplete">;
	result: unknown;
	postProcess?: () => Promise<void>;
	logger?: Pick<Logger, "debug">;
}): void => {
	input.outputManager.emitAgentComplete(input.result);
	if (!input.postProcess) {
		return;
	}
	void input.postProcess().catch((error) => {
		input.logger?.debug(
			"Failed post-completion processing for streamed agent response",
			error,
		);
	});
};

export class AgentInvoker {
	private loader: AgentLoader;
	private outputManager: OutputManager;
	private logger: Logger;
	private workspace: string;
	private configDir: string;
	private wingmanConfig: WingmanConfigType;
	private mcpManager: MCPClientManager | null = null;
	private sessionManager: SessionManager | null = null;
	private terminalSessionManager: TerminalSessionManager;
	private workdir: string | null = null;
	private defaultOutputDir: string | null = null;

	constructor(options: AgentInvokerOptions) {
		this.outputManager = options.outputManager;
		this.logger = options.logger;
		this.workspace = options.workspace || process.cwd();
		this.configDir = options.configDir || ".wingman";
		this.sessionManager = options.sessionManager || null;
		this.terminalSessionManager =
			options.terminalSessionManager || getSharedTerminalSessionManager();
		this.workdir = options.workdir || null;
		this.defaultOutputDir = options.defaultOutputDir || null;

		// Load wingman config and pass to AgentLoader
		const configLoader = new WingmanConfigLoader(
			this.configDir,
			this.workspace,
		);
		this.wingmanConfig = configLoader.loadConfig();
		this.loader = new AgentLoader(
			this.configDir,
			this.workspace,
			this.wingmanConfig,
		);
	}

	findAllAgents(): WingmanAgentConfig[] {
		const agentConfigs = this.loader.loadAllAgentConfigs();
		return agentConfigs;
	}

	/**
	 * Find an agent by name
	 */
	async findAgent(name: string): Promise<WingmanAgent | undefined> {
		return await this.loader.loadAgent(name);
	}

	/**
	 * Invoke a specific agent directly (bypassing main orchestration)
	 */
	async invokeAgent(
		agentName: string,
		prompt: string,
		sessionId?: string,
		attachments?: MediaAttachment[],
		options?: InvokeAgentOptions,
	): Promise<any> {
		let cancellationHandled = false;
		let activeToolName: string | null = null;
		let lastToolName: string | null = null;
		let rootLangGraphRunId: string | undefined;
		const isCancelled = () => options?.signal?.aborted === true;
		try {
			const hookSessionId = sessionId || uuidv4();
			const executionWorkspace = resolveAgentExecutionWorkspace(
				this.workspace,
				this.workdir,
				this.defaultOutputDir,
			);
			const effectiveWorkdir = this.workdir ? executionWorkspace : null;
			const loader = new AgentLoader(
				this.configDir,
				this.workspace,
				this.wingmanConfig,
				executionWorkspace,
				{
					terminalOwnerId: `${agentName}:${hookSessionId}`,
					terminalSessionManager: this.terminalSessionManager,
				},
			);

			// Find the agent
			const targetAgent = await loader.loadAgent(agentName);

			if (!targetAgent) {
				throw new Error(`Agent "${agentName}" not found`);
			}

			this.logger.info(`Invoking agent: ${agentName}`);
			const preview =
				prompt.trim() ||
				(attachments && attachments.length > 0
					? buildAttachmentPreview(attachments)
					: "");
			this.outputManager.emitAgentStart(agentName, preview);

			this.logger.debug(
				`Found ${this.wingmanConfig.toolHooks ? "global hooks" : "no global hooks"}`,
			);
			this.logger.debug(
				`Found ${targetAgent.toolHooks ? "agent-specific hooks" : "no agent-specific hooks"}`,
			);

			// Merge global and agent-specific hooks
			const mergedHooks = mergeHooks(
				this.wingmanConfig.toolHooks,
				targetAgent.toolHooks,
			);

			// Initialize MCP client if MCP servers configured
			const mcpConfigs: MCPServersConfig[] = [];
			if (targetAgent.mcpConfig) {
				mcpConfigs.push(targetAgent.mcpConfig);
			}
			if (targetAgent.mcpUseGlobal && this.wingmanConfig.mcp) {
				mcpConfigs.push(this.wingmanConfig.mcp);
			}

			if (mcpConfigs.length > 0) {
				this.logger.debug("Initializing MCP client for agent invocation");
				this.mcpManager = new MCPClientManager(mcpConfigs, this.logger, {
					executionWorkspace,
				});
				await this.mcpManager.initialize();

				// Get MCP tools and add to agent tools
				const mcpTools = await this.mcpManager.getTools();
				if (mcpTools.length > 0) {
					const existing = new Set(
						(targetAgent.tools || []).map((tool) => tool.name),
					);
					const unique = mcpTools.filter((tool) => !existing.has(tool.name));
					targetAgent.tools = [...(targetAgent.tools || []), ...unique] as any;
					this.logger.info(`Added ${unique.length} MCP tools to agent`);
				}
			}

			// Build middleware array
			const skillsDirectory =
				this.wingmanConfig?.skills?.skillsDirectory || "skills";
			const normalizedSkillsDirectory = skillsDirectory.replace(
				/^\/+|\/+$/g,
				"",
			);
			const skillsVirtualPath = `/${normalizedSkillsDirectory}/`;
			const outputMount = resolveExternalOutputMount(
				executionWorkspace,
				effectiveWorkdir,
				this.defaultOutputDir,
			);
			const memorySources = resolveAgentMemorySources(executionWorkspace);
			const middleware = [
				mediaCompatibilityMiddleware({ model: targetAgent.model }),
				additionalMessageMiddleware({
					workspaceRoot: executionWorkspace,
					workdir: effectiveWorkdir,
					defaultOutputDir: this.defaultOutputDir,
					outputVirtualPath: outputMount.virtualPath,
					dynamicUiEnabled:
						this.wingmanConfig?.gateway?.dynamicUiEnabled !== false,
					skillsDirectory,
				}),
			];
			const summarizationSettings = resolveSummarizationMiddlewareSettings(
				this.wingmanConfig,
			);
			const modelRetrySettings = resolveModelRetryMiddlewareSettings(
				this.wingmanConfig,
			);
			if (modelRetrySettings) {
				middleware.push(
					modelRetryMiddleware({
						maxRetries: modelRetrySettings.maxRetries,
						backoffFactor: modelRetrySettings.backoffFactor,
						initialDelayMs: modelRetrySettings.initialDelayMs,
						maxDelayMs: modelRetrySettings.maxDelayMs,
						jitter: modelRetrySettings.jitter,
						onFailure: modelRetrySettings.onFailure,
					}),
				);
			}
			const toolRetrySettings = resolveToolRetryMiddlewareSettings(
				this.wingmanConfig,
			);
			if (toolRetrySettings) {
				middleware.push(
					toolRetryMiddleware({
						maxRetries: toolRetrySettings.maxRetries,
						backoffFactor: toolRetrySettings.backoffFactor,
						initialDelayMs: toolRetrySettings.initialDelayMs,
						maxDelayMs: toolRetrySettings.maxDelayMs,
						jitter: toolRetrySettings.jitter,
						onFailure: toolRetrySettings.onFailure,
						...(toolRetrySettings.tools
							? { tools: toolRetrySettings.tools }
							: {}),
					}),
				);
			}
			const hitlSettings = resolveHumanInTheLoopSettings(this.wingmanConfig);

			// Add hooks middleware if hooks are configured
			if (mergedHooks) {
				this.logger.debug(
					`Adding hooks middleware with ${mergedHooks.PreToolUse?.length || 0} PreToolUse hooks, ${mergedHooks.PostToolUse?.length || 0} PostToolUse hooks, and ${mergedHooks.Stop?.length || 0} Stop hooks`,
				);
				middleware.push(
					createHooksMiddleware(
						mergedHooks,
						executionWorkspace,
						hookSessionId,
						this.logger,
					),
				);
			}

			// Get checkpointer if session manager is available
			const checkpointer = this.sessionManager?.getCheckpointer();

			// Create a standalone DeepAgent for this specific agent
			const bundledSkillsPath = getBundledSkillsPath();
			const skillsSources = [];
			if (existsSync(bundledSkillsPath)) {
				skillsSources.push("/skills-bundled/");
			}
			skillsSources.push(skillsVirtualPath);
			const backendOverrides: Record<string, FilesystemBackend> = {
				"/memories/": new FilesystemBackend({
					rootDir: join(this.workspace, this.configDir, "memories"),
					virtualMode: true,
				}),
			};
			const executionWorkspaceAlias =
				toWorkspaceAliasVirtualPath(executionWorkspace);
			if (executionWorkspaceAlias) {
				backendOverrides[executionWorkspaceAlias] = new FilesystemBackend({
					rootDir: executionWorkspace,
					virtualMode: true,
				});
			}
			if (effectiveWorkdir) {
				backendOverrides[WORKDIR_VIRTUAL_PATH] = new FilesystemBackend({
					rootDir: executionWorkspace,
					virtualMode: true,
				});
			}
			const workspaceSkillsPath = join(
				this.workspace,
				normalizedSkillsDirectory,
			);
			if (existsSync(workspaceSkillsPath)) {
				backendOverrides[skillsVirtualPath] = new FilesystemBackend({
					rootDir: workspaceSkillsPath,
					virtualMode: true,
				});
			}
			if (existsSync(bundledSkillsPath)) {
				backendOverrides["/skills-bundled/"] = new FilesystemBackend({
					rootDir: bundledSkillsPath,
					virtualMode: true,
				});
			}
			if (outputMount.virtualPath && outputMount.absolutePath) {
				backendOverrides[outputMount.virtualPath] = new FilesystemBackend({
					rootDir: outputMount.absolutePath,
					virtualMode: true,
				});
			}

			const standaloneAgent = createDeepAgent({
				systemPrompt: targetAgent.systemPrompt,
				tools: targetAgent.tools as any,
				model: targetAgent.model as any,
				backend: () =>
					new CompositeBackend(
						new FilesystemBackend({
							rootDir: executionWorkspace,
							virtualMode: true,
						}),
						backendOverrides,
					),
				middleware: middleware as any,
				interruptOn: hitlSettings?.interruptOn,
				skills: skillsSources,
				memory: memorySources,
				subagents: (targetAgent.subagents || []) as any,
				checkpointer: checkpointer as any,
			});
			configureDeepAgentSummarizationMiddleware(
				standaloneAgent,
				summarizationSettings,
				targetAgent.model as any,
			);

			this.logger.debug("Agent created, sending message");

			const userContent = buildUserContent(
				prompt,
				attachments,
				targetAgent.model,
			);

			// Use streaming if session manager is available, otherwise fall back to invoke
			if (this.sessionManager && sessionId) {
				this.logger.debug(`Using streaming with session: ${sessionId}`);

				// Stream the agent response
				const stream = await (standaloneAgent as any).streamEvents(
					{
						messages: [
							{
								role: "user",
								content: userContent,
							},
						],
					},
					{
						recursionLimit: this.wingmanConfig.recursionLimit,
						configurable: { thread_id: sessionId },
						version: "v2",
						signal: options?.signal,
					},
				);

				for await (const chunk of stream) {
					rootLangGraphRunId = trackRootLangGraphRunId(
						rootLangGraphRunId,
						chunk,
					);
					const toolEvent = detectToolEventContext(chunk);
					if (toolEvent) {
						lastToolName = toolEvent.toolName;
						if (toolEvent.event === "on_tool_start") {
							activeToolName = toolEvent.toolName;
						} else if (activeToolName === toolEvent.toolName) {
							activeToolName = null;
						}
					}
					if (isCancelled()) {
						cancellationHandled = true;
						this.logger.info("Agent invocation cancelled");
						this.outputManager.emitAgentError("Request cancelled");
						if (typeof (stream as any)?.return === "function") {
							await (stream as any).return();
						}
						return { cancelled: true };
					}
					// Forward raw chunks to OutputManager for client-side interpretation
					this.outputManager.emitAgentStream(chunk);
					if (isRootLangGraphTerminalEvent(chunk, rootLangGraphRunId)) {
						this.logger.debug(
							"Detected root LangGraph on_chain_end event; finalizing stream without waiting for iterator shutdown",
						);
						break;
					}
				}
				if (isCancelled()) {
					cancellationHandled = true;
					this.logger.info("Agent invocation cancelled");
					this.outputManager.emitAgentError("Request cancelled");
					return { cancelled: true };
				}

				this.logger.info("Agent streaming completed successfully");
				const completionPayload = { streaming: true };
				emitCompletionAndContinuePostProcessing({
					outputManager: this.outputManager,
					result: completionPayload,
					postProcess: () => this.materializeSessionImages(sessionId),
					logger: this.logger,
				});
				return { streaming: true };
			} else {
				// Fall back to blocking invoke for backwards compatibility
				this.logger.debug("Using blocking invoke (no session manager)");
				if (isCancelled()) {
					cancellationHandled = true;
					this.logger.info("Agent invocation cancelled");
					this.outputManager.emitAgentError("Request cancelled");
					return { cancelled: true };
				}

				const result = await (standaloneAgent as any).invoke(
					{
						messages: [
							{
								role: "user",
								content: userContent,
							},
						],
					},
					{
						recursionLimit: this.wingmanConfig.recursionLimit,
						signal: options?.signal,
					},
				);
				if (isCancelled()) {
					cancellationHandled = true;
					this.logger.info("Agent invocation cancelled");
					this.outputManager.emitAgentError("Request cancelled");
					return { cancelled: true };
				}

				this.logger.info("Agent completed successfully");
				emitCompletionAndContinuePostProcessing({
					outputManager: this.outputManager,
					result,
					postProcess: () => this.materializeSessionImages(sessionId),
					logger: this.logger,
				});

				return result;
			}
		} catch (error) {
			const abortError =
				isCancelled() ||
				(error instanceof Error &&
					(error.name === "AbortError" ||
						error.name === "CancelledError" ||
						/abort|cancel/i.test(error.message)));
			if (abortError) {
				if (!cancellationHandled) {
					this.outputManager.emitAgentError("Request cancelled");
				}
				this.logger.info("Agent invocation cancelled");
				return { cancelled: true };
			}
			this.logger.error(
				`Agent invocation failed: ${error instanceof Error ? error.message : String(error)}${
					activeToolName
						? ` (while running tool "${activeToolName}")`
						: lastToolName
							? ` (last tool: "${lastToolName}")`
							: ""
				}`,
			);
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			const errorWithToolContext = activeToolName
				? `${errorMessage} (while running tool "${activeToolName}")`
				: lastToolName
					? `${errorMessage} (last tool: "${lastToolName}")`
					: errorMessage;
			this.outputManager.emitAgentError(errorWithToolContext);
			throw error;
		} finally {
			// Always cleanup MCP client
			if (this.mcpManager) {
				this.logger.debug("Cleaning up MCP client");
				await this.mcpManager.cleanup();
				this.mcpManager = null;
			}
		}
	}

	/**
	 * List all available agents with their descriptions
	 */
	listAgents(): Array<{ name: string; description: string }> {
		const agents = this.findAllAgents();
		return agents.map((a) => ({
			name: a.name,
			description: a.description,
		}));
	}

	private async materializeSessionImages(sessionId?: string): Promise<void> {
		if (!this.sessionManager || !sessionId) return;
		await this.sessionManager.listMessages(sessionId);
	}
}

export function buildUserContent(
	prompt: string,
	attachments?: MediaAttachment[],
	model?: unknown,
): string | UserContentPart[] {
	const text = prompt?.trim() ?? "";
	if (!attachments || attachments.length === 0) {
		return text;
	}

	const parts: UserContentPart[] = [];
	if (text) {
		parts.push({ type: "text", text });
	}
	for (const attachment of attachments) {
		if (!attachment) continue;
		if (isFileAttachment(attachment)) {
			const nativePdfPart = buildNativePdfPart(attachment, model);
			if (nativePdfPart) {
				parts.push(nativePdfPart);
				continue;
			}
			parts.push({
				type: "text",
				text: buildFileAttachmentText(attachment),
			});
			continue;
		}
		if (!attachment.dataUrl) continue;
		if (isAudioAttachment(attachment)) {
			const audioPart = buildAudioPart(attachment);
			if (audioPart) {
				parts.push(audioPart);
			}
			continue;
		}
		parts.push({ type: "image_url", image_url: { url: attachment.dataUrl } });
	}

	if (parts.length === 0) {
		if (!text) {
			throw new Error("Attachment payload is empty or invalid.");
		}
		return text;
	}
	return parts;
}

function supportsNativePdfInputs(model?: unknown): boolean {
	if (!model || typeof model !== "object") return false;
	try {
		const profile = (model as { profile?: { pdfInputs?: unknown } }).profile;
		if (!profile || typeof profile !== "object") return false;
		return profile.pdfInputs === true;
	} catch {
		return false;
	}
}

function isPdfName(name?: string): boolean {
	return (name || "").trim().toLowerCase().endsWith(".pdf");
}

function resolveFileMimeType(attachment: FileAttachment): string {
	const direct = attachment.mimeType?.trim().toLowerCase();
	if (direct) {
		return direct.split(";")[0] || "";
	}
	const parsed = parseDataUrl(attachment.dataUrl);
	return (parsed.mimeType || "").trim().toLowerCase().split(";")[0] || "";
}

function buildFileMetadata(
	attachment: FileAttachment,
	defaultName: string,
): {
	filename: string;
	name: string;
	title: string;
} {
	const filename = attachment.name?.trim() || defaultName;
	return {
		filename,
		name: filename,
		title: filename,
	};
}

function buildNativePdfPart(
	attachment: FileAttachment,
	model?: unknown,
): UserContentPart | null {
	if (!supportsNativePdfInputs(model)) return null;

	const mimeType = resolveFileMimeType(attachment);
	const isPdf = mimeType === "application/pdf" || isPdfName(attachment.name);
	if (!isPdf) return null;

	const metadata = buildFileMetadata(attachment, "document.pdf");
	const parsed = parseDataUrl(attachment.dataUrl);
	const useResponsesInputFile = shouldUseResponsesInputFile(model);

	if (useResponsesInputFile) {
		if (parsed.data) {
			const fileDataMime = parsed.mimeType || mimeType || "application/pdf";
			return {
				type: "input_file",
				file_data: `data:${fileDataMime};base64,${parsed.data}`,
				filename: metadata.filename,
			};
		}

		const fileDataUrl = attachment.dataUrl?.trim();
		if (!fileDataUrl || !fileDataUrl.startsWith("data:")) {
			return null;
		}
		return {
			type: "input_file",
			file_data: fileDataUrl,
			filename: metadata.filename,
		};
	}

	if (parsed.data) {
		return {
			type: "file",
			source_type: "base64",
			mime_type: parsed.mimeType || mimeType || "application/pdf",
			data: parsed.data,
			metadata,
		};
	}

	const url = attachment.dataUrl?.trim();
	if (!url || !url.startsWith("data:")) return null;
	return {
		type: "file",
		source_type: "url",
		mime_type: mimeType || "application/pdf",
		url,
		metadata,
	};
}

function shouldUseResponsesInputFile(model?: unknown): boolean {
	if (!model || typeof model !== "object") return false;
	try {
		const flag = (model as { useResponsesApi?: unknown }).useResponsesApi;
		if (typeof flag === "boolean") return flag;
	} catch {}
	return false;
}

function isAudioAttachment(
	attachment: MediaAttachment,
): attachment is AudioAttachment {
	if ((attachment as AudioAttachment).kind === "audio") return true;
	if (attachment.mimeType?.startsWith("audio/")) return true;
	if (attachment.dataUrl?.startsWith("data:audio/")) return true;
	return false;
}

function isFileAttachment(
	attachment: MediaAttachment,
): attachment is FileAttachment {
	if ((attachment as FileAttachment).kind === "file") return true;
	return typeof (attachment as FileAttachment).textContent === "string";
}

function buildAudioPart(
	attachment: AudioAttachment,
):
	| { type: "audio"; source_type: "base64"; data: string; mime_type?: string }
	| { type: "audio"; source_type: "url"; url: string; mime_type?: string } {
	const parsed = parseDataUrl(attachment.dataUrl);
	const mimeType = attachment.mimeType || parsed.mimeType;
	if (parsed.data) {
		return {
			type: "audio",
			source_type: "base64",
			data: parsed.data,
			mime_type: mimeType,
		};
	}
	return {
		type: "audio",
		source_type: "url",
		url: attachment.dataUrl,
		mime_type: mimeType,
	};
}

function parseDataUrl(dataUrl: string): { mimeType?: string; data?: string } {
	if (!dataUrl.startsWith("data:")) return {};
	const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
	if (!match) return {};
	return { mimeType: match[1], data: match[2] };
}

function buildFileAttachmentText(attachment: FileAttachment): string {
	const name = attachment.name?.trim() || "file";
	const mime = attachment.mimeType?.trim();
	const sizeLabel =
		typeof attachment.size === "number" && attachment.size >= 0
			? `, ${attachment.size} bytes`
			: "";
	const meta =
		mime || sizeLabel
			? ` (${[mime, sizeLabel.replace(/^, /, "")].filter(Boolean).join(", ")})`
			: "";
	const header = `[Attached file: ${name}${meta}]`;
	const text = attachment.textContent?.trim();
	if (!text) {
		return `${header}\n[No extractable text content provided.]`;
	}
	return `${header}\n${text}`;
}

function buildAttachmentPreview(attachments: MediaAttachment[]): string {
	let hasFile = false;
	let hasAudio = false;
	let hasImage = false;
	for (const attachment of attachments) {
		if (isFileAttachment(attachment)) {
			hasFile = true;
			continue;
		}
		if (isAudioAttachment(attachment)) {
			hasAudio = true;
		} else {
			hasImage = true;
		}
	}
	if (hasFile && (hasAudio || hasImage)) return "[files and media]";
	if (hasAudio && hasImage) return "[attachments]";
	if (hasFile) return "[file]";
	if (hasAudio) return "[audio]";
	if (hasImage) return "[image]";
	return "";
}
