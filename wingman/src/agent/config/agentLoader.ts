import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { SubAgent } from "deepagents";
import {
	validateAgentConfig,
	validateAgentsConfigFile,
	type UserAgentConfig,
} from "./agentConfig.js";
import { createTools, type ToolOptions } from "./toolRegistry.js";
import { ModelFactory } from "./modelFactory.js";
import { createLogger } from "../../logger.js";

const logger = createLogger();

/**
 * Load and validate agent configurations from multiple sources
 */
export class AgentConfigLoader {
	constructor(
		private configDir = ".wingman",
		private workspace: string = process.cwd(),
	) {}

	/**
	 * Load agent configurations from multiple locations in priority order:
	 * 1. Root-level agents/ directory (built-in agents)
	 * 2. .wingman/agents.config.json (user custom agents - single file)
	 * 3. .wingman/agents/ directory (user custom agents - directory)
	 */
	loadAgentConfigs(): SubAgent[] {
		const allAgents: SubAgent[] = [];

		// 1. Load built-in agents from root-level agents/ directory
		const rootAgentsDir = join(this.workspace, "agents");
		if (existsSync(rootAgentsDir) && statSync(rootAgentsDir).isDirectory()) {
			logger.info(`Loading built-in agents from: ${rootAgentsDir}`);
			const builtInAgents = this.loadFromDirectory(rootAgentsDir);
			allAgents.push(...builtInAgents);
		}

		// 2. Try single file for custom agents
		const singleFile = join(this.workspace, this.configDir, "agents.config.json");
		if (existsSync(singleFile)) {
			logger.info(`Loading custom agents from: ${singleFile}`);
			const customAgents = this.loadFromFile(singleFile);
			allAgents.push(...customAgents);
		}

		// 3. Try directory for custom agents
		const customAgentsDir = join(this.workspace, this.configDir, "agents");
		if (existsSync(customAgentsDir) && statSync(customAgentsDir).isDirectory()) {
			logger.info(`Loading custom agents from directory: ${customAgentsDir}`);
			const customAgents = this.loadFromDirectory(customAgentsDir);
			allAgents.push(...customAgents);
		}

		if (allAgents.length === 0) {
			logger.warn(
				`No agent configs found. Checked: ${rootAgentsDir}, ${singleFile}, ${customAgentsDir}`,
			);
		} else {
			logger.info(
				`Loaded ${allAgents.length} total agent(s): ${allAgents.map((a) => a.name).join(", ")}`,
			);
		}

		return allAgents;
	}

	/**
	 * Load agents from a single agents.config.json file
	 */
	private loadFromFile(filePath: string): SubAgent[] {
		try {
			const content = readFileSync(filePath, "utf-8");
			const json = JSON.parse(content);

			const validation = validateAgentsConfigFile(json);
			if (!validation.success) {
				logger.error(`Failed to validate ${filePath}:\n${validation.error}`);
				return [];
			}

			const agents = validation.data.agents.map((config) =>
				this.createSubAgent(config),
			);

			logger.info(
				`Loaded ${agents.length} custom agent(s): ${agents.map((a) => a.name).join(", ")}`,
			);
			return agents;
		} catch (error) {
			if (error instanceof SyntaxError) {
				logger.error(`Invalid JSON in ${filePath}: ${error.message}`);
			} else {
				logger.error(`Failed to load agents from ${filePath}: ${error}`);
			}
			return [];
		}
	}

	/**
	 * Load agents from individual .json files in a directory
	 */
	private loadFromDirectory(dirPath: string): SubAgent[] {
		try {
			const files = readdirSync(dirPath).filter((f) => f.endsWith(".json"));

			if (files.length === 0) {
				logger.warn(`No .json files found in ${dirPath}`);
				return [];
			}

			const agents: SubAgent[] = [];

			for (const file of files) {
				const filePath = join(dirPath, file);
				try {
					const content = readFileSync(filePath, "utf-8");
					const json = JSON.parse(content);

					const validation = validateAgentConfig(json);
					if (!validation.success) {
						logger.error(`Failed to validate ${file}:\n${validation.error}`);
						continue;
					}

					const agent = this.createSubAgent(validation.data);
					agents.push(agent);
					logger.info(`Loaded custom agent: ${agent.name} from ${file}`);
				} catch (error) {
					if (error instanceof SyntaxError) {
						logger.error(`Invalid JSON in ${file}: ${error.message}`);
					} else {
						logger.error(`Failed to load ${file}: ${error}`);
					}
				}
			}

			logger.info(`Loaded ${agents.length} custom agent(s) from ${dirPath}`);
			return agents;
		} catch (error) {
			logger.error(`Failed to read directory ${dirPath}: ${error}`);
			return [];
		}
	}

	/**
	 * Create a SubAgent instance from a user config
	 */
	private createSubAgent(
		config: UserAgentConfig,
		isSubagent = false,
	): SubAgent & { subagents?: SubAgent[] } {
		const subAgent: SubAgent & { subagents?: SubAgent[] } = {
			name: config.name,
			description: config.description,
			systemPrompt: config.systemPrompt,
		};

		// Add tools if specified
		if (config.tools && config.tools.length > 0) {
			const toolOptions: ToolOptions = {
				workspace: this.workspace,
				blockedCommands: config.blockedCommands,
				allowScriptExecution: config.allowScriptExecution,
				timeout: config.commandTimeout,
			};

			subAgent.tools = createTools(config.tools, toolOptions);
		}

		// Add model override if specified
		if (config.model) {
			try {
				subAgent.model = ModelFactory.createModel(config.model);
				logger.info(`Agent "${config.name}" using model: ${config.model}`);
			} catch (error) {
				logger.error(
					`Failed to create model for agent "${config.name}": ${error}`,
				);
				logger.info(`Agent "${config.name}" will use default model`);
			}
		}

		// Add subagents if specified (only for top-level agents, not for subagents)
		if (!isSubagent && config.subagents && config.subagents.length > 0) {
			logger.info(
				`Agent "${config.name}" has ${config.subagents.length} subagent(s)`,
			);
			subAgent.subagents = config.subagents.map((subagentConfig) => {
				// Recursively create subagents, but mark them as subagents to prevent nesting
				return this.createSubAgent(subagentConfig as any, true);
			});
		}

		return subAgent;
	}
}
