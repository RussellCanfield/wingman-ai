import type { StructuredTool } from "@langchain/core/tools";
import { createInternetSearchTool } from "../tools/internet_search.js";
import { webCrawler } from "../tools/web_crawler.js";
import { createCommandExecuteTool } from "../tools/command_execute.js";
import { createThinkingTool } from "../tools/think.js";
import type { AvailableToolName } from "./agentConfig.js";
import type { SearchConfig } from "../../cli/config/schema.js";
import { createLogger } from "../../logger.js";
import { MCPClientManager } from "./mcpClientManager.js";
import type { MCPServersConfig } from "@/types/mcp.js";

const logger = createLogger();

export interface ToolOptions {
	workspace?: string;
	blockedCommands?: string[];
	allowScriptExecution?: boolean;
	timeout?: number;
	searchConfig?: SearchConfig;
	mcpConfigs?: MCPServersConfig[];
}

/**
 * Create a tool by name with optional configuration
 */
export function createTool(
	name: AvailableToolName,
	options: ToolOptions = {},
): StructuredTool | null {
	const {
		workspace = process.cwd(),
		blockedCommands,
		allowScriptExecution = true,
		timeout = 300000,
		searchConfig = { provider: "duckduckgo", maxResults: 5 },
	} = options;

	logger.debug(`Creating tool: ${name}`, {
		workspace,
		blockedCommands,
		allowScriptExecution,
		timeout,
		searchConfig,
	});

	switch (name) {
		case "internet_search":
			return createInternetSearchTool(searchConfig);

		case "web_crawler":
			return webCrawler;

		case "command_execute":
			return createCommandExecuteTool(
				workspace,
				process.env as Record<string, string>,
				blockedCommands,
				allowScriptExecution,
				timeout,
			);

		case "think":
			return createThinkingTool();

		default:
			logger.warn(`Unknown tool name: ${name}`);
			return null;
	}
}

/**
 * Create multiple tools from an array of tool names
 * NOW ALSO includes MCP tools if configured
 */
export async function createTools(
	toolNames: AvailableToolName[],
	options: ToolOptions = {},
): Promise<StructuredTool[]> {
	const tools: StructuredTool[] = [];

	// Create standard Wingman tools
	for (const name of toolNames) {
		const tool = createTool(name, options);
		if (tool) {
			tools.push(tool);
		} else {
			logger.warn(`Skipping unknown tool: ${name}`);
		}
	}

	// Add MCP tools if configured
	if (options.mcpConfigs && options.mcpConfigs.length > 0) {
		try {
			const mcpManager = new MCPClientManager(options.mcpConfigs, logger);
			await mcpManager.initialize();
			const mcpTools = await mcpManager.getTools();

			if (mcpTools.length > 0) {
				tools.push(...mcpTools);
				logger.info(`Added ${mcpTools.length} MCP tool(s)`);
			}

			// Note: We don't cleanup here because tools will be used later
			// Cleanup should happen in agentInvoker after agent completes
		} catch (error) {
			logger.error(
				`Failed to load MCP tools: ${error instanceof Error ? error.message : String(error)}`,
			);
			// Continue with other tools - MCP failure is non-fatal
		}
	}

	logger.info(
		`Created ${tools.length} total tools: ${toolNames.join(", ")}${options.mcpConfigs?.length ? " + MCP tools" : ""}`,
	);
	return tools;
}

/**
 * Get list of all available tool names
 */
export function getAvailableTools(): AvailableToolName[] {
	return ["internet_search", "web_crawler", "command_execute", "think"];
}
