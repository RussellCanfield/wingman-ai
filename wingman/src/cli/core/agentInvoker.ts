import {
	CompositeBackend,
	createDeepAgent,
	FilesystemBackend,
} from "deepagents";
import { join } from "node:path";
import { AgentLoader } from "../../agent/config/agentLoader.js";
import type { OutputManager } from "./outputManager.js";
import type { Logger } from "../../logger.js";
import { additionalMessageMiddleware } from "@/agent/middleware/additional-messages.js";
import type { WingmanAgentConfig } from "@/agent/config/agentConfig.js";
import type { WingmanAgent } from "@/types/agents.js";

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

	constructor(options: AgentInvokerOptions) {
		this.outputManager = options.outputManager;
		this.logger = options.logger;
		this.workspace = options.workspace || process.cwd();
		this.configDir = options.configDir || ".wingman";
		this.loader = new AgentLoader(this.configDir, this.workspace);
	}

	findAllAgents(): WingmanAgentConfig[] {
		const agentConfigs = this.loader.loadAllAgentConfigs();
		return agentConfigs;
	}

	/**
	 * Find an agent by name
	 */
	findAgent(name: string): WingmanAgent | undefined {
		return this.loader.loadAgent(name);
	}

	/**
	 * Invoke a specific agent directly (bypassing main orchestration)
	 */
	async invokeAgent(agentName: string, prompt: string): Promise<any> {
		try {
			// Find the agent
			const targetAgent = this.findAgent(agentName);

			if (!targetAgent) {
				throw new Error(`Agent "${agentName}" not found`);
			}

			this.logger.info(`Invoking agent: ${agentName}`);
			this.outputManager.emitAgentStart(agentName, prompt);

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
				middleware: [additionalMessageMiddleware()],
				skills: ["/skills/"],
				subagents: [...(targetAgent.subagents || [])],
			});

			this.logger.debug("Agent created, sending message");

			// Invoke the agent
			const result = await standaloneAgent.invoke({
				messages: [
					{
						role: "user",
						content: prompt,
					},
				],
			});

			this.logger.info("Agent completed successfully");
			this.outputManager.emitAgentComplete(result);

			return result;
		} catch (error) {
			this.logger.error(
				`Agent invocation failed: ${error instanceof Error ? error.message : String(error)}`,
			);
			this.outputManager.emitAgentError(error as Error);
			throw error;
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
