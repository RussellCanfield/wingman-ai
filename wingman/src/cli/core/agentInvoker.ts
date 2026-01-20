import {
	CompositeBackend,
	createDeepAgent,
	FilesystemBackend,
} from "deepagents";
import { join } from "node:path";
import { v4 as uuidv4 } from "uuid";
import { AgentLoader } from "../../agent/config/agentLoader.js";
import { WingmanConfigLoader } from "../config/loader.js";
import type { OutputManager } from "./outputManager.js";
import type { Logger } from "../../logger.js";
import { additionalMessageMiddleware } from "@/agent/middleware/additional-messages.js";
import { createHooksMiddleware } from "@/agent/middleware/hooks.js";
import { mergeHooks } from "@/agent/middleware/hooks/merger.js";
import type { WingmanAgentConfig } from "@/agent/config/agentConfig.js";
import type { WingmanAgent } from "@/types/agents.js";
import type { WingmanConfigType } from "../config/schema.js";
import { MCPClientManager } from "@/agent/config/mcpClientManager.js";
import type { MCPServersConfig } from "@/types/mcp.js";

export interface AgentInvokerOptions {
	workspace?: string;
	configDir?: string;
	outputManager: OutputManager;
	logger: Logger;
}

export class AgentInvoker {
	private loader: AgentLoader;
	private outputManager: OutputManager;
	private logger: Logger;
	private workspace: string;
	private configDir: string;
	private wingmanConfig: WingmanConfigType;
	private mcpManager: MCPClientManager | null = null;

	constructor(options: AgentInvokerOptions) {
		this.outputManager = options.outputManager;
		this.logger = options.logger;
		this.workspace = options.workspace || process.cwd();
		this.configDir = options.configDir || ".wingman";

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
	async invokeAgent(agentName: string, prompt: string): Promise<any> {
		try {
			// Find the agent
			const targetAgent = await this.findAgent(agentName);

			if (!targetAgent) {
				throw new Error(`Agent "${agentName}" not found`);
			}

			this.logger.info(`Invoking agent: ${agentName}`);
			this.outputManager.emitAgentStart(agentName, prompt);

			this.logger.debug(
				`Found ${this.wingmanConfig.hooks ? "global hooks" : "no global hooks"}`,
			);
			this.logger.debug(
				`Found ${targetAgent.hooks ? "agent-specific hooks" : "no agent-specific hooks"}`,
			);

			// Merge global and agent-specific hooks
			const mergedHooks = mergeHooks(
				this.wingmanConfig.hooks,
				targetAgent.hooks,
			);

			// Generate session ID for hooks
			const sessionId = uuidv4();

			// Initialize MCP client if MCP servers configured
			const mcpConfigs: MCPServersConfig[] = [
				this.wingmanConfig.mcp,
				targetAgent.mcpConfig,
			].filter(Boolean) as MCPServersConfig[];

			if (mcpConfigs.length > 0) {
				this.logger.debug("Initializing MCP client for agent invocation");
				this.mcpManager = new MCPClientManager(mcpConfigs, this.logger);
				await this.mcpManager.initialize();

				// Get MCP tools and add to agent tools
				const mcpTools = await this.mcpManager.getTools();
				if (mcpTools.length > 0) {
					targetAgent.tools = [...(targetAgent.tools || []), ...mcpTools];
					this.logger.info(`Added ${mcpTools.length} MCP tools to agent`);
				}
			}

			// Build middleware array
			const middleware = [additionalMessageMiddleware()];

			// Add hooks middleware if hooks are configured
			if (mergedHooks) {
				this.logger.debug(
					`Adding hooks middleware with ${mergedHooks.PreToolUse?.length || 0} PreToolUse hooks, ${mergedHooks.PostToolUse?.length || 0} PostToolUse hooks, and ${mergedHooks.Stop?.length || 0} Stop hooks`,
				);
				middleware.push(
					createHooksMiddleware(
						mergedHooks,
						this.workspace,
						sessionId,
						this.logger,
					),
				);
			}

			// Create a standalone DeepAgent for this specific agent
			const standaloneAgent = createDeepAgent({
				systemPrompt: targetAgent.systemPrompt,
				tools: targetAgent.tools,
				model: targetAgent.model as any,
				backend: () =>
					new CompositeBackend(
						new FilesystemBackend({
							rootDir: this.workspace,
							virtualMode: true,
						}),
						{
							"/memories/": new FilesystemBackend({
								rootDir: join(this.workspace, this.configDir, "memories"),
								virtualMode: true,
							}),
						},
					),
				middleware,
				skills: ["/skills/"],
				subagents: [...(targetAgent.subagents || [])],
			});

			this.logger.debug("Agent created, sending message");

			// Invoke the agent
			const result = await standaloneAgent.invoke(
				{
					messages: [
						{
							role: "user",
							content: prompt,
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
