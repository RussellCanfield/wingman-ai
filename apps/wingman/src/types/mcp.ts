import * as z from "zod";

/**
 * Transport type for MCP server connection
 */
export type MCPTransport = "stdio" | "sse";

/**
 * Base MCP server configuration
 */
export interface MCPServerConfig {
	/** Unique server identifier/name */
	name: string;
	/** Transport protocol */
	transport: MCPTransport;
}

/**
 * Stdio transport configuration (for local subprocess)
 */
export interface MCPStdioConfig extends MCPServerConfig {
	transport: "stdio";
	/** Command to execute (e.g., "node", "python") */
	command: string;
	/** Command arguments (e.g., ["/path/to/server.js"]) */
	args?: string[];
	/** Environment variables for the subprocess */
	env?: Record<string, string>;
}

/**
 * SSE transport configuration (for HTTP/remote servers)
 */
export interface MCPSSEConfig extends MCPServerConfig {
	transport: "sse";
	/** Server URL (e.g., "http://localhost:8000/mcp") */
	url: string;
	/** Optional headers for authentication */
	headers?: Record<string, string>;
}

/**
 * Union type for all MCP server configurations
 */
export type MCPServerConfiguration = MCPStdioConfig | MCPSSEConfig;

/**
 * Container for multiple MCP servers
 */
export interface MCPServersConfig {
	/** List of MCP server configurations */
	servers?: MCPServerConfiguration[];
}

/**
 * Zod schema for Stdio transport configuration
 */
export const MCPStdioConfigSchema = z.object({
	name: z.string().min(1).describe("Unique server name"),
	transport: z.literal("stdio"),
	command: z
		.string()
		.min(1)
		.describe("Command to execute (e.g., 'node', 'python')"),
	args: z.array(z.string()).optional().describe("Command arguments"),
	env: z.record(z.string(), z.string()).optional().describe("Environment variables"),
});

/**
 * Zod schema for SSE transport configuration
 */
export const MCPSSEConfigSchema = z.object({
	name: z.string().min(1).describe("Unique server name"),
	transport: z.literal("sse"),
	url: z.string().url().describe("Server URL"),
	headers: z
		.record(z.string(), z.string())
		.optional()
		.describe("HTTP headers for authentication"),
});

/**
 * Zod schema for MCP server configuration (discriminated union)
 */
export const MCPServerConfigSchema = z.union([
	MCPStdioConfigSchema,
	MCPSSEConfigSchema,
]);

/**
 * Zod schema for MCP servers configuration container
 */
export const MCPServersConfigSchema = z.object({
	servers: z
		.array(MCPServerConfigSchema)
		.optional()
		.describe("List of MCP servers"),
});

export type MCPServersConfigType = z.infer<typeof MCPServersConfigSchema>;

/**
 * Validate MCP server configuration
 */
export function validateMCPConfig(config: unknown): {
	success: boolean;
	data?: MCPServersConfigType;
	error?: string;
} {
	try {
		const validated = MCPServersConfigSchema.parse(config);
		return { success: true, data: validated };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				success: false,
				error: error.issues
					.map((e) => `${e.path.join(".")}: ${e.message}`)
					.join(", "),
			};
		}
		return { success: false, error: String(error) };
	}
}
