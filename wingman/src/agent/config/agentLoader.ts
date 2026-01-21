import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, normalize } from "node:path";
import * as yaml from "js-yaml";
import {
	validateAgentConfig,
	WingmanDirectory,
	type WingmanAgentConfig,
} from "./agentConfig.js";
import { createTools, type ToolOptions } from "./toolRegistry.js";
import { ModelFactory } from "./modelFactory.js";
import { createLogger } from "../../logger.js";
import type { WingmanAgent } from "@/types/agents.js";
import type { WingmanConfigType } from "../../cli/config/schema.js";
import { MCPServersConfig } from "@/types/mcp.js";

const logger = createLogger();

/**
 * Load and validate agent configurations from multiple sources
 */
export class AgentLoader {
	constructor(
		private configDir = WingmanDirectory,
		private workspace: string = process.cwd(),
		private wingmanConfig?: WingmanConfigType,
	) {}

	loadAllAgentConfigs(): WingmanAgentConfig[] {
		const agents: WingmanAgentConfig[] = [];

		const agentsDir = join(this.workspace, this.configDir, "agents");

		if (existsSync(agentsDir) && statSync(agentsDir).isDirectory()) {
			logger.info(`Loading agents from directory: ${agentsDir}`);

			const agentDirs = readdirSync(agentsDir, { withFileTypes: true })
				.filter((dirent) => dirent.isDirectory())
				.map((dirent) => dirent.name);

			for (const agentDir of agentDirs) {
				const agentFilePath = join(agentsDir, agentDir, "agent.md");

				if (!existsSync(agentFilePath)) {
					logger.warn(`Skipping ${agentDir}: agent.md not found`);
					continue;
				}

				try {
					const json = this.loadFromMarkdown(
						agentFilePath,
						join(agentsDir, agentDir),
					);

					const validation = validateAgentConfig(json);
					if (!validation.success) {
						logger.error(
							`Failed to validate ${agentFilePath}:\n${validation.error}`,
						);
						continue;
					}

					agents.push(validation.data);
					logger.info(`Loaded agent config: ${validation.data.name}`);
				} catch (error) {
					logger.error(`Failed to load agent from ${agentFilePath}: ${error}`);
				}
			}
		} else {
			logger.info(`No agents directory found at: ${agentsDir}`);
		}

		return agents;
	}

	/**
	 * Parse frontmatter from markdown content
	 */
	private parseFrontmatter(content: string): {
		metadata: Record<string, any>;
		prompt: string;
	} {
		const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
		const match = content.match(frontmatterRegex);

		if (!match) {
			throw new Error("Invalid agent.md format: missing frontmatter");
		}

		const [, frontmatter, prompt] = match;

		try {
			const metadata = yaml.load(frontmatter) as Record<string, any>;

			if (!metadata || typeof metadata !== "object") {
				throw new Error("Frontmatter must be a valid YAML object");
			}

			return { metadata, prompt: prompt.trim() };
		} catch (error) {
			throw new Error(`Failed to parse frontmatter: ${error}`);
		}
	}

	/**
	 * Load agent configuration from markdown file
	 */
	private loadFromMarkdown(filePath: string, agentDir: string): any {
		const content = readFileSync(filePath, "utf-8");
		const { metadata, prompt } = this.parseFrontmatter(content);

		// Build agent config from frontmatter
		const config: any = {
			...metadata,
			systemPrompt: prompt,
		};

		// Resolve subagent prompts if they use promptFile
		if (config.subAgents && Array.isArray(config.subAgents)) {
			for (const subagent of config.subAgents) {
				if (subagent.promptFile) {
					const promptPath = join(agentDir, subagent.promptFile);
					if (!existsSync(promptPath)) {
						throw new Error(`Subagent prompt file not found: ${promptPath}`);
					}

					const subagentContent = readFileSync(promptPath, "utf-8");

					// Check if subagent file has frontmatter
					if (subagentContent.startsWith("---")) {
						const parsed = this.parseFrontmatter(subagentContent);
						Object.assign(subagent, parsed.metadata);
						subagent.systemPrompt = parsed.prompt;
					} else {
						subagent.systemPrompt = subagentContent.trim();
					}

					delete subagent.promptFile;
				}
			}
		}

		return config;
	}

	/**
	 * Load a specific agent configuration by name
	 */
	async loadAgent(agentName: string): Promise<WingmanAgent> {
		let agent: WingmanAgent | undefined = undefined;

		const customAgentsDir = join(
			this.workspace,
			this.configDir,
			"agents",
			agentName,
		);
		if (
			existsSync(customAgentsDir) &&
			statSync(customAgentsDir).isDirectory()
		) {
			logger.info(`Loading agent from directory: ${customAgentsDir}`);
			agent = await this.loadFromDirectory(customAgentsDir);
		}

		if (!agent) {
			throw new Error(`Agent "${agentName}" not found in ${this.configDir}`);
		}

		return agent;
	}

	/**
	 * Load agents from markdown files in a directory
	 */
	private async loadFromDirectory(dirPath: string): Promise<WingmanAgent> {
		const agentFilePath = join(dirPath, "agent.md");

		try {
			if (!existsSync(agentFilePath)) {
				throw new Error(`Agent config file not found: ${agentFilePath}`);
			}

			logger.info(`Loading agent from markdown: ${agentFilePath}`);
			const json = this.loadFromMarkdown(agentFilePath, dirPath);

			const validation = validateAgentConfig(json);
			if (!validation.success) {
				throw new Error(
					`Failed to validate ${agentFilePath}:\n${validation.error}`,
				);
			}

			const agent = await this.createAgent(validation.data);

			// Add subagents if specified (only for top-level agents, not for subagents)
			if (agent.subagents && agent.subagents.length > 0) {
				logger.info(
					`Agent "${agent.name}" has ${agent.subagents.length} subagent(s)`,
				);

				for (const subagent of agent.subagents) {
					if ("subagents" in subagent && subagent.subagents) {
						logger.warn(
							`Subagent "${subagent.name}" has its own subagents, which is not currently supported. Ignoring nested subagents.`,
						);
						subagent.subagents = [];
					}
				}
			}

			logger.info(`Loaded custom agent: ${agent.name} from ${dirPath}`);
			return agent;
		} catch (error) {
			throw new Error(`Failed to load agent from ${dirPath}: ${error}`);
		}
	}

	/**
	 * Create a WingmanAgent instance from a user config
	 */
	private async createAgent(config: WingmanAgentConfig): Promise<WingmanAgent> {
		const agent: WingmanAgent = {
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
				searchConfig: this.wingmanConfig?.search,
				// Pass both global and agent-specific MCP configs
				mcpConfigs: [this.wingmanConfig?.mcp, config.mcp].filter(
					Boolean,
				) as any[],
			};

			agent.tools = await createTools(config.tools, toolOptions);
		}

		// Store MCP config on agent for reference
		if (config.mcp) {
			agent.mcpConfig = config.mcp as MCPServersConfig;
		}

		// Add model override if specified
		if (config.model) {
			try {
				agent.model = ModelFactory.createModel(config.model);
				logger.info(`Agent "${config.name}" using model: ${config.model}`);
			} catch (error) {
				logger.error(
					`Failed to create model for agent "${config.name}": ${error}`,
				);
				logger.info(`Agent "${config.name}" will use default model`);
			}
		}

		// Add subagents if specified
		if (config.subAgents) {
			agent.subagents = config.subAgents as any;
		}

		return agent;
	}
}
