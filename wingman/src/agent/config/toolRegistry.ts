import type { StructuredTool } from "@langchain/core/tools";
import { internetSearch } from "../tools/internet_search.js";
import { webCrawler } from "../tools/web_crawler.js";
import { createCommandExecuteTool } from "../tools/command_execute.js";
import { createThinkingTool } from "../tools/think.js";
import type { AvailableToolName } from "./agentConfig.js";
import { createLogger } from "../../logger.js";

const logger = createLogger();

export interface ToolOptions {
	workspace?: string;
	blockedCommands?: string[];
	allowScriptExecution?: boolean;
	timeout?: number;
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
	} = options;

	logger.debug(`Creating tool: ${name}`, {
		workspace,
		blockedCommands,
		allowScriptExecution,
		timeout,
	});

	switch (name) {
		case "internet_search":
			return internetSearch;

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
 */
export function createTools(
	toolNames: AvailableToolName[],
	options: ToolOptions = {},
): StructuredTool[] {
	const tools: StructuredTool[] = [];

	for (const name of toolNames) {
		const tool = createTool(name, options);
		if (tool) {
			tools.push(tool);
		} else {
			logger.warn(`Skipping unknown tool: ${name}`);
		}
	}

	logger.info(`Created ${tools.length} tools: ${toolNames.join(", ")}`);
	return tools;
}

/**
 * Get list of all available tool names
 */
export function getAvailableTools(): AvailableToolName[] {
	return ["internet_search", "web_crawler", "command_execute", "think"];
}
