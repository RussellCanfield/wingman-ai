import type { StructuredTool } from "@langchain/core/tools";
import type { MCPServersConfig } from "@/types/mcp.js";
import type { SearchConfig } from "../../cli/config/schema.js";
import { createLogger } from "../../logger.js";
import { createBackgroundTerminalTool } from "../tools/background_terminal.js";
import { createBrowserControlTool } from "../tools/browser_control.js";
import { createCodeSearchTool } from "../tools/code_search.js";
import { createCommandExecuteTool } from "../tools/command_execute.js";
import { createGitStatusTool } from "../tools/git_status.js";
import { createInternetSearchTool } from "../tools/internet_search.js";
import {
	getSharedTerminalSessionManager,
	type TerminalSessionManager,
} from "../tools/terminal_session_manager.js";
import { createThinkingTool } from "../tools/think.js";
import {
	createUiPresentTool,
	createUiRegistryGetTool,
	createUiRegistryListTool,
} from "../tools/ui_registry.js";
import { webCrawler } from "../tools/web_crawler.js";
import type { AvailableToolName } from "./agentConfig.js";
import { MCPClientManager } from "./mcpClientManager.js";

const logger = createLogger();

export interface ToolOptions {
	workspace?: string;
	executionWorkspace?: string;
	blockedCommands?: string[];
	allowScriptExecution?: boolean;
	timeout?: number;
	browserProfile?: string;
	browserTransport?: "auto" | "playwright" | "relay";
	browserProfilesDirectory?: string;
	browserProfiles?: Record<string, string>;
	browserExtensions?: string[];
	browserExtensionsDirectory?: string;
	browserExtensionsById?: Record<string, string>;
	browserDefaultExtensions?: string[];
	browserRelay?: {
		enabled?: boolean;
		host?: string;
		port?: number;
		requireAuth?: boolean;
		authToken?: string;
	};
	terminalOwnerId?: string;
	terminalSessionManager?: TerminalSessionManager;
	searchConfig?: SearchConfig;
	mcpConfigs?: MCPServersConfig[];
	skillsDirectory?: string;
	dynamicUiEnabled?: boolean;
}

export const UI_TOOL_NAMES: AvailableToolName[] = [
	"ui_registry_list",
	"ui_registry_get",
	"ui_present",
];

/**
 * Create a tool by name with optional configuration
 */
export function createTool(
	name: AvailableToolName,
	options: ToolOptions = {},
): StructuredTool | null {
	const {
		workspace = process.cwd(),
		executionWorkspace,
		blockedCommands,
		allowScriptExecution = true,
		timeout = 300000,
		terminalOwnerId = "default",
		terminalSessionManager = getSharedTerminalSessionManager(),
		searchConfig = { provider: "duckduckgo", maxResults: 5 },
		skillsDirectory = "skills",
		dynamicUiEnabled = true,
	} = options;
	const runtimeWorkspace = executionWorkspace || workspace;

	logger.debug(`Creating tool: ${name}`, {
		workspace,
		executionWorkspace: runtimeWorkspace,
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

		case "browser_control":
			return createBrowserControlTool({
				workspace: runtimeWorkspace,
				configWorkspace: workspace,
				launchTimeoutMs: timeout,
				browserProfile: options.browserProfile,
				browserTransport: options.browserTransport,
				profilesRootDir: options.browserProfilesDirectory,
				profilePaths: options.browserProfiles,
				browserExtensions: options.browserExtensions,
				extensionsRootDir: options.browserExtensionsDirectory,
				extensionPaths: options.browserExtensionsById,
				defaultExtensions: options.browserDefaultExtensions,
				relayConfig: options.browserRelay,
			});

		case "command_execute":
			return createCommandExecuteTool(
				runtimeWorkspace,
				process.env as Record<string, string>,
				blockedCommands,
				allowScriptExecution,
				timeout,
			);

		case "background_terminal":
			return createBackgroundTerminalTool({
				workspace: runtimeWorkspace,
				ownerId: terminalOwnerId,
				sessionManager: terminalSessionManager,
				envVariables: process.env as Record<string, string>,
				blockedCommands,
				allowScriptExecution,
				commandTimeout: timeout,
			});

		case "think":
			return createThinkingTool();

		case "code_search":
			return createCodeSearchTool(runtimeWorkspace);

		case "git_status":
			return createGitStatusTool(runtimeWorkspace);

		case "ui_registry_list":
			return createUiRegistryListTool(workspace, skillsDirectory);

		case "ui_registry_get":
			return createUiRegistryGetTool(workspace, skillsDirectory);

		case "ui_present":
			return createUiPresentTool(workspace, skillsDirectory, dynamicUiEnabled);

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
			const mcpManager = new MCPClientManager(options.mcpConfigs, logger, {
				executionWorkspace:
					options.executionWorkspace || options.workspace || null,
			});
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
	return [
		"internet_search",
		"web_crawler",
		"browser_control",
		"command_execute",
		"background_terminal",
		"think",
		"code_search",
		"git_status",
		...UI_TOOL_NAMES,
	];
}
