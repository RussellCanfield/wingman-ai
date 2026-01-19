import { createDeepAgent, type SubAgent } from "deepagents";
import { AgentConfigLoader } from "../../agent/config/agentLoader.js";
import type { OutputManager } from "./outputManager.js";
import type { Logger } from "../../logger.js";

export interface AgentInvokerOptions {
	workspace?: string;
	configDir?: string;
	outputManager: OutputManager;
	logger: Logger;
}

export class AgentInvoker {
	private loader: AgentConfigLoader;
	private outputManager: OutputManager;
	private logger: Logger;

	constructor(options: AgentInvokerOptions) {
		this.outputManager = options.outputManager;
		this.logger = options.logger;
		this.loader = new AgentConfigLoader(
			options.configDir || ".wingman",
			options.workspace || process.cwd(),
		);
	}

	/**
	 * Get all available agents
	 */
	getAvailableAgents(): SubAgent[] {
		return this.loader.loadAgentConfigs();
	}

	/**
	 * Find an agent by name
	 */
	findAgent(name: string): SubAgent | undefined {
		const agents = this.getAvailableAgents();
		return agents.find((a) => a.name === name);
	}

	/**
	 * Invoke a specific agent directly (bypassing main orchestration)
	 */
	async invokeAgent(agentName: string, prompt: string): Promise<any> {
		// Find the agent
		const targetAgent = this.findAgent(agentName);

		if (!targetAgent) {
			const available = this.getAvailableAgents()
				.map((a) => a.name)
				.join(", ");
			throw new Error(
				`Agent "${agentName}" not found. Available agents: ${available}`,
			);
		}

		this.logger.info(`Invoking agent: ${agentName}`);
		this.outputManager.emitAgentStart(agentName, prompt);

		try {
			// Create a standalone DeepAgent for this specific agent
			// No subagents, no delegation - direct invocation only
			const standaloneAgent = createDeepAgent({
				systemPrompt: targetAgent.systemPrompt,
				tools: targetAgent.tools,
				model: targetAgent.model as any, // deepagents uses LanguageModelLike
				// No subagents - we're invoking this agent directly
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
		const agents = this.getAvailableAgents();
		return agents.map((a) => ({
			name: a.name,
			description: a.description,
		}));
	}
}
