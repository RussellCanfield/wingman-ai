import {
	CompositeBackend,
	createDeepAgent,
	FilesystemBackend,
} from "deepagents";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { v4 as uuidv4 } from "uuid";
import { AgentLoader } from "../../agent/config/agentLoader.js";
import { WingmanConfigLoader } from "../config/loader.js";
import type { OutputManager } from "./outputManager.js";
import type { Logger } from "../../logger.js";
import { additionalMessageMiddleware } from "@/agent/middleware/additional-messages.js";
import { createHooksMiddleware } from "@/agent/middleware/hooks.js";
import { mergeHooks } from "@/agent/middleware/hooks/merger.js";
import { mediaCompatibilityMiddleware } from "@/agent/middleware/media-compat.js";
import type { WingmanAgentConfig } from "@/agent/config/agentConfig.js";
import type { WingmanAgent } from "@/types/agents.js";
import type { WingmanConfigType } from "../config/schema.js";
import { MCPClientManager } from "@/agent/config/mcpClientManager.js";
import type { MCPServersConfig } from "@/types/mcp.js";
import { SessionManager } from "./sessionManager.js";
import { getBundledSkillsPath } from "@/agent/uiRegistry.js";

export interface AgentInvokerOptions {
	workspace?: string;
	configDir?: string;
	outputManager: OutputManager;
	logger: Logger;
	sessionManager?: SessionManager;
	workdir?: string | null;
	defaultOutputDir?: string | null;
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

export type MediaAttachment = ImageAttachment | AudioAttachment;

export class AgentInvoker {
	private loader: AgentLoader;
	private outputManager: OutputManager;
	private logger: Logger;
	private workspace: string;
	private configDir: string;
	private wingmanConfig: WingmanConfigType;
	private mcpManager: MCPClientManager | null = null;
	private sessionManager: SessionManager | null = null;
	private workdir: string | null = null;
	private defaultOutputDir: string | null = null;

	constructor(options: AgentInvokerOptions) {
		this.outputManager = options.outputManager;
		this.logger = options.logger;
		this.workspace = options.workspace || process.cwd();
		this.configDir = options.configDir || ".wingman";
		this.sessionManager = options.sessionManager || null;
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
	): Promise<any> {
		try {
			// Find the agent
			const targetAgent = await this.findAgent(agentName);

			if (!targetAgent) {
				throw new Error(`Agent "${agentName}" not found`);
			}

			this.logger.info(`Invoking agent: ${agentName}`);
			const preview =
				prompt.trim() || (attachments && attachments.length > 0
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

			// Use provided session ID or generate new one for hooks
			const hookSessionId = sessionId || uuidv4();

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
				this.mcpManager = new MCPClientManager(mcpConfigs, this.logger);
				await this.mcpManager.initialize();

				// Get MCP tools and add to agent tools
				const mcpTools = await this.mcpManager.getTools();
				if (mcpTools.length > 0) {
					const existing = new Set(
						(targetAgent.tools || []).map((tool) => tool.name),
					);
					const unique = mcpTools.filter((tool) => !existing.has(tool.name));
					targetAgent.tools = [
						...(targetAgent.tools || []),
						...unique,
					] as any;
					this.logger.info(`Added ${unique.length} MCP tools to agent`);
				}
			}

			// Build middleware array
			const skillsDirectory = this.wingmanConfig?.skills?.skillsDirectory || "skills";
			const middleware = [
				mediaCompatibilityMiddleware({ model: targetAgent.model }),
				additionalMessageMiddleware({
					workspaceRoot: this.workspace,
					workdir: this.workdir,
					defaultOutputDir: this.defaultOutputDir,
					dynamicUiEnabled:
						this.wingmanConfig?.gateway?.dynamicUiEnabled !== false,
					skillsDirectory,
				}),
			];

			// Add hooks middleware if hooks are configured
			if (mergedHooks) {
				this.logger.debug(
					`Adding hooks middleware with ${mergedHooks.PreToolUse?.length || 0} PreToolUse hooks, ${mergedHooks.PostToolUse?.length || 0} PostToolUse hooks, and ${mergedHooks.Stop?.length || 0} Stop hooks`,
				);
				middleware.push(
					createHooksMiddleware(
						mergedHooks,
						this.workspace,
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
			skillsSources.push(
				`/${skillsDirectory.replace(/^\/+|\/+$/g, "")}/`,
			);
			const backendOverrides: Record<string, FilesystemBackend> = {
				"/memories/": new FilesystemBackend({
					rootDir: join(this.workspace, this.configDir, "memories"),
					virtualMode: true,
				}),
			};
			if (existsSync(bundledSkillsPath)) {
				backendOverrides["/skills-bundled/"] = new FilesystemBackend({
					rootDir: bundledSkillsPath,
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
							rootDir: this.workspace,
							virtualMode: true,
						}),
						backendOverrides,
					),
				middleware,
				skills: skillsSources,
				subagents: [...(targetAgent.subagents || [])],
				checkpointer: checkpointer as any,
			});

			this.logger.debug("Agent created, sending message");

			const userContent = buildUserContent(prompt, attachments);

			// Use streaming if session manager is available, otherwise fall back to invoke
			if (this.sessionManager && sessionId) {
				this.logger.debug(`Using streaming with session: ${sessionId}`);

				// Stream the agent response
				const stream = await standaloneAgent.streamEvents(
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
					},
				);

				for await (const chunk of stream) {
					// Forward raw chunks to OutputManager for client-side interpretation
					this.outputManager.emitAgentStream(chunk);
				}

				this.logger.info("Agent streaming completed successfully");
				this.outputManager.emitAgentComplete({ streaming: true });
				return { streaming: true };
			} else {
				// Fall back to blocking invoke for backwards compatibility
				this.logger.debug("Using blocking invoke (no session manager)");

				const result = await standaloneAgent.invoke(
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
					},
				);

				this.logger.info("Agent completed successfully");
				this.outputManager.emitAgentComplete(result);

				return result;
			}
		} catch (error) {
			this.logger.error(
				`Agent invocation failed: ${error instanceof Error ? error.message : String(error)}`,
			);
			this.outputManager.emitAgentError(error as Error);
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
}

export function buildUserContent(
	prompt: string,
	attachments?: MediaAttachment[],
): string | Array<
	| { type: "text"; text: string }
	| { type: "image_url"; image_url: { url: string } }
	| { type: "audio"; source_type: "base64"; data: string; mime_type?: string }
	| { type: "audio"; source_type: "url"; url: string; mime_type?: string }
> {
	const text = prompt?.trim() ?? "";
	if (!attachments || attachments.length === 0) {
		return text;
	}

	const parts: Array<
		| { type: "text"; text: string }
		| { type: "image_url"; image_url: { url: string } }
		| { type: "audio"; source_type: "base64"; data: string; mime_type?: string }
		| { type: "audio"; source_type: "url"; url: string; mime_type?: string }
	> = [];
	if (text) {
		parts.push({ type: "text", text });
	}
	for (const attachment of attachments) {
		if (!attachment?.dataUrl) continue;
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

function isAudioAttachment(attachment: MediaAttachment): attachment is AudioAttachment {
	if ((attachment as AudioAttachment).kind === "audio") return true;
	if (attachment.mimeType?.startsWith("audio/")) return true;
	if (attachment.dataUrl?.startsWith("data:audio/")) return true;
	return false;
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

function buildAttachmentPreview(attachments: MediaAttachment[]): string {
	let hasAudio = false;
	let hasImage = false;
	for (const attachment of attachments) {
		if (isAudioAttachment(attachment)) {
			hasAudio = true;
		} else {
			hasImage = true;
		}
	}
	if (hasAudio && hasImage) return "[attachments]";
	if (hasAudio) return "[audio]";
	if (hasImage) return "[image]";
	return "";
}
