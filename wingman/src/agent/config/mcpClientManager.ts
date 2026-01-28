import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import type { StructuredTool } from "@langchain/core/tools";
import type {
	MCPServersConfig,
	MCPServerConfiguration,
	MCPStdioConfig,
	MCPSSEConfig,
} from "@/types/mcp.js";
import type { Logger } from "@/logger.js";

/**
 * Manages MCP server connections and tool retrieval
 * Handles server lifecycle: initialization, tool loading, and cleanup
 */
export class MCPClientManager {
	private client: MultiServerMCPClient | null = null;
	private logger: Logger;
	private serverConfigs: MCPServerConfiguration[];

	constructor(configs: MCPServersConfig[], logger: Logger) {
		this.logger = logger;
		this.serverConfigs = this.mergeConfigs(configs);
	}

	/**
	 * Merge multiple MCP configurations (global + agent-specific)
	 * Agent-specific servers override global ones with same name
	 */
	private mergeConfigs(configs: MCPServersConfig[]): MCPServerConfiguration[] {
		const serverMap = new Map<string, MCPServerConfiguration>();

		for (const config of configs) {
			if (config.servers) {
				for (const server of config.servers) {
					serverMap.set(server.name, server);
				}
			}
		}

		return Array.from(serverMap.values());
	}

	/**
	 * Convert Wingman MCP config to MultiServerMCPClient format
	 */
	private buildClientConfig(): Record<string, any> {
		const clientConfig: Record<string, any> = {};

		for (const server of this.serverConfigs) {
			if (server.transport === "stdio") {
				const stdioServer = server as MCPStdioConfig;
				clientConfig[server.name] = {
					transport: "stdio",
					command: stdioServer.command,
					args: stdioServer.args || [],
					env: stdioServer.env || {},
				};
			} else if (server.transport === "sse") {
				const sseServer = server as MCPSSEConfig;
				clientConfig[server.name] = {
					transport: "sse",
					url: sseServer.url,
					headers: sseServer.headers || {},
				};
			}
		}

		return clientConfig;
	}

	/**
	 * Initialize MCP client and connect to servers
	 */
	async initialize(): Promise<void> {
		if (this.serverConfigs.length === 0) {
			this.logger.debug("No MCP servers configured");
			return;
		}

		try {
			const clientConfig = this.buildClientConfig();
			this.logger.info(
				`Initializing MCP client with ${this.serverConfigs.length} server(s)`,
			);

			this.client = new MultiServerMCPClient(clientConfig);

			this.logger.info("MCP client initialized successfully");
		} catch (error) {
			this.logger.error(
				`Failed to initialize MCP client: ${error instanceof Error ? error.message : String(error)}`,
			);
			throw new Error(`MCP client initialization failed: ${error}`);
		}
	}

	/**
	 * Retrieve all tools from connected MCP servers
	 * Returns LangChain StructuredTools ready for agent use
	 */
	async getTools(): Promise<StructuredTool[]> {
		if (!this.client) {
			this.logger.debug("No MCP client initialized, returning empty tools array");
			return [];
		}

		try {
			this.logger.debug("Retrieving tools from MCP servers");
			const tools = await this.client.getTools();
			const sanitized = this.sanitizeToolNames(tools);
			this.logger.info(`Retrieved ${sanitized.length} tool(s) from MCP servers`);
			return sanitized;
		} catch (error) {
			this.logger.error(
				`Failed to retrieve MCP tools: ${error instanceof Error ? error.message : String(error)}`,
			);
			// Non-fatal: return empty array to allow agent to continue with other tools
			return [];
		}
	}

	private sanitizeToolNames(tools: StructuredTool[]): StructuredTool[] {
		const used = new Map<string, number>();
		const sanitize = (name: string) => {
			const base = name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
			return base.length > 0 ? base : "tool";
		};

		const uniqueName = (name: string) => {
			let candidate = sanitize(name);
			let counter = used.get(candidate) || 0;
			while (used.has(candidate)) {
				counter += 1;
				const suffix = `_${counter}`;
				candidate = `${sanitize(name).slice(0, 128 - suffix.length)}${suffix}`;
			}
			used.set(candidate, counter);
			return candidate;
		};

		return tools.map((tool) => {
			const original = tool.name;
			const sanitized = uniqueName(original);
			if (sanitized !== original) {
				try {
					tool.name = sanitized;
				} catch {
					// ignore if tool name is read-only
				}
				const originalLabel = `Original tool name: ${original}`;
				tool.description = tool.description
					? `${tool.description}\n\n${originalLabel}`
					: originalLabel;
			}
			return tool;
		});
	}

	/**
	 * Cleanup MCP client resources
	 * Call when agent completes or on error
	 */
	async cleanup(): Promise<void> {
		if (!this.client) {
			return;
		}

		try {
			this.logger.debug("Cleaning up MCP client");
			// Note: MultiServerMCPClient is stateless by default
			// but we should still clean up references
			this.client = null;
			this.logger.debug("MCP client cleanup complete");
		} catch (error) {
			this.logger.warn(
				`Error during MCP cleanup: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Check if any MCP servers are configured
	 */
	hasServers(): boolean {
		return this.serverConfigs.length > 0;
	}
}
