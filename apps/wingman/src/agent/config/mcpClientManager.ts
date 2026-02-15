import type { StructuredTool } from "@langchain/core/tools";
import { tool as createTool } from "@langchain/core/tools";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import type { Logger } from "@/logger.js";
import type {
	MCPServerConfiguration,
	MCPServersConfig,
	MCPSSEConfig,
	MCPStdioConfig,
} from "@/types/mcp.js";

type MCPClientStdioServerConfig = {
	transport: "stdio";
	command: string;
	args: string[];
	env: Record<string, string>;
	defaultToolTimeout?: number;
};

type MCPClientSseServerConfig = {
	transport: "sse";
	url: string;
	headers: Record<string, string>;
	defaultToolTimeout?: number;
};

type MCPClientServerConfig =
	| MCPClientStdioServerConfig
	| MCPClientSseServerConfig;

type MCPClientConfig = {
	mcpServers: Record<string, MCPClientServerConfig>;
	useStandardContentBlocks: boolean;
	outputHandling: {
		image: "artifact";
		audio: "artifact";
		resource: "artifact";
	};
};

export type MCPProxyConfig = {
	enabled?: boolean;
	command?: string;
	baseArgs?: string[];
	projectName?: string;
	pushExplorer?: boolean;
	apiKey?: string;
	apiUrl?: string;
};

/**
 * Manages MCP server connections and tool retrieval
 * Handles server lifecycle: initialization, tool loading, and cleanup
 */
export class MCPClientManager {
	private client: MultiServerMCPClient | null = null;
	private logger: Logger;
	private serverConfigs: MCPServerConfiguration[];
	private executionWorkspace: string | null;
	private proxyConfig: MCPProxyConfig | undefined;

	constructor(
		configs: MCPServersConfig[],
		logger: Logger,
		options?: {
			executionWorkspace?: string | null;
			proxyConfig?: MCPProxyConfig;
		},
	) {
		this.logger = logger;
		this.serverConfigs = this.mergeConfigs(configs);
		this.executionWorkspace = options?.executionWorkspace?.trim() || null;
		this.proxyConfig = options?.proxyConfig;
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
	private buildClientConfig(): MCPClientConfig {
		const mcpServers: Record<string, MCPClientServerConfig> = {};

		for (const server of this.serverConfigs) {
			if (server.transport === "stdio") {
				const stdioServer = server as MCPStdioConfig;
				const resolvedEnv: Record<string, string> = {};
				for (const [key, value] of Object.entries(stdioServer.env || {})) {
					resolvedEnv[key] = resolveEnvValue(value);
				}
				const runtimeEnv = this.applyRuntimeEnv(resolvedEnv);
				const defaultToolTimeout = getDefaultToolTimeout(stdioServer);
				mcpServers[server.name] = this.buildStdioServerConfig(
					stdioServer,
					runtimeEnv,
					defaultToolTimeout,
				);
			} else if (server.transport === "sse") {
				const sseServer = server as MCPSSEConfig;
				const defaultToolTimeout = getDefaultToolTimeout(sseServer);
				mcpServers[server.name] = {
					transport: "sse",
					url: sseServer.url,
					headers: sseServer.headers || {},
					...(defaultToolTimeout !== undefined ? { defaultToolTimeout } : {}),
				};
			}
		}

		return {
			mcpServers,
			useStandardContentBlocks: false,
			// Keep large binary outputs out of LLM context; they remain available in tool artifacts.
			outputHandling: {
				image: "artifact",
				audio: "artifact",
				resource: "artifact",
			},
		};
	}

	private buildStdioServerConfig(
		server: MCPStdioConfig,
		env: Record<string, string>,
		defaultToolTimeout?: number,
	): MCPClientStdioServerConfig {
		const baseConfig: MCPClientStdioServerConfig = {
			transport: "stdio",
			command: server.command,
			args: server.args || [],
			env,
			...(defaultToolTimeout !== undefined ? { defaultToolTimeout } : {}),
		};

		if (!this.proxyConfig?.enabled) {
			return baseConfig;
		}

		const proxyCommand = this.proxyConfig.command?.trim() || "uvx";
		const proxyBaseArgs =
			this.proxyConfig.baseArgs && this.proxyConfig.baseArgs.length > 0
				? this.proxyConfig.baseArgs
				: ["invariant-gateway@latest", "mcp"];
		const proxyEnv: Record<string, string> = { ...env };
		if (this.proxyConfig.apiKey) {
			proxyEnv.INVARIANT_API_KEY = this.proxyConfig.apiKey;
		}
		if (this.proxyConfig.apiUrl) {
			proxyEnv.INVARIANT_API_URL = this.proxyConfig.apiUrl;
			proxyEnv.GUARDRAILS_API_URL = this.proxyConfig.apiUrl;
		}

		const proxyArgs = [
			...proxyBaseArgs,
			"--project-name",
			this.proxyConfig.projectName || "wingman-gateway",
			...(this.proxyConfig.pushExplorer ? ["--push-explorer"] : []),
			"--exec",
			baseConfig.command,
			...(baseConfig.args || []),
		];

		return {
			transport: "stdio",
			command: proxyCommand,
			args: proxyArgs,
			env: proxyEnv,
			...(defaultToolTimeout !== undefined ? { defaultToolTimeout } : {}),
		};
	}

	private applyRuntimeEnv(env: Record<string, string>): Record<string, string> {
		if (!this.executionWorkspace) return env;
		const next = { ...env };
		next.WINGMAN_WORKDIR = this.executionWorkspace;
		return next;
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
			this.logger.debug(
				"No MCP client initialized, returning empty tools array",
			);
			return [];
		}

		try {
			this.logger.debug("Retrieving tools from MCP servers");
			const tools = await this.client.getTools();
			const sanitized = this.sanitizeToolNames(tools);
			this.logger.info(
				`Retrieved ${sanitized.length} tool(s) from MCP servers`,
			);
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
			if (sanitized === original) {
				return tool;
			}

			const originalLabel = `Original tool name: ${original}`;
			const description = tool.description
				? `${tool.description}\n\n${originalLabel}`
				: originalLabel;

			const toolWithSchema = tool as StructuredTool & {
				schema?: unknown;
				inputSchema?: unknown;
			};
			const schema = toolWithSchema.schema ?? toolWithSchema.inputSchema;
			if (!schema) {
				try {
					tool.name = sanitized;
					tool.description = description;
					return tool;
				} catch {
					return tool;
				}
			}

			return createTool(async (input) => tool.invoke(input), {
				name: sanitized,
				description,
				schema: schema as never,
			});
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

function resolveEnvValue(value: string): string {
	const match = value.match(/^\$\{([A-Z0-9_]+)\}$/);
	if (!match) return value;
	const envValue = process.env[match[1]];
	return envValue ?? "";
}

function getDefaultToolTimeout(
	server: MCPServerConfiguration,
): number | undefined {
	const candidate = server.defaultToolTimeout;
	if (typeof candidate !== "number") return undefined;
	if (!Number.isFinite(candidate) || candidate <= 0) return undefined;
	return Math.floor(candidate);
}
