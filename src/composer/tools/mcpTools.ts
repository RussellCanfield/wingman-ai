import { type DynamicTool, tool } from "@langchain/core/tools";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { MCPToolConfig } from "@shared/types/Settings";

export const createMCPTool = (mcpConfig: MCPToolConfig) => {
	if (mcpConfig.type === "command") {
		return new McpStdioClient(mcpConfig);
	}

	return new McpSSEClient(mcpConfig);
};

export class McpStdioClient {
	transport: StdioClientTransport;
	client: Client;

	constructor(private readonly mcpConfig: MCPToolConfig) {
		if (!mcpConfig.command) {
			throw new Error("MCP tool command is required");
		}

		// Split the command string by spaces, but respect quoted arguments
		const commandParts = mcpConfig.command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];

		// The first part is the command, the rest are arguments
		const command = commandParts[0];
		const args = commandParts.slice(1).map((arg) => {
			// Remove quotes from quoted arguments
			return arg.startsWith('"') && arg.endsWith('"') ? arg.slice(1, -1) : arg;
		});

		this.transport = new StdioClientTransport({
			command: command!,
			args,
		});

		this.client = new Client(
			{
				name: "wingman-ai-client",
				version: "1.0.0",
			},
			{
				capabilities: {
					prompts: {},
					resources: {},
					tools: {},
				},
			},
		);
	}

	getName() {
		return this.mcpConfig.name;
	}

	async connect() {
		return this.client.connect(this.transport);
	}

	async close() {
		return this.client.close();
	}

	async getTools() {
		return this.client.listTools();
	}

	async createTools() {
		const remoteTools = await this.getTools();

		const createdTools: DynamicTool[] = [];

		for (const remoteTool of remoteTools.tools) {
			createdTools.push(
				//@ts-expect-error
				tool(
					async (input) => {
						try {
							console.log(
								`MCP Remote tool called: ${this.mcpConfig.name}`,
								input,
							);
							return this.client.callTool({
								name: remoteTool.name,
								arguments: {
									...input,
								},
							});
						} catch (e) {
							//@ts-expect-error
							return `Tool failed to execute due to: ${e.message}`;
						}
					},
					{
						name: remoteTool.name,
						description: remoteTool.description,
						schema:
							//Empty types come back from MCP server as type object, set these as undefined
							JSON.stringify(remoteTool.inputSchema ?? "") ===
							'{"type":"object"}'
								? undefined
								: remoteTool.inputSchema,
					},
				),
			);
		}

		return createdTools;
	}
}

export class McpSSEClient {
	transport: SSEClientTransport;
	client: Client;

	constructor(private readonly mcpConfig: MCPToolConfig) {
		if (!mcpConfig.endpoint) {
			throw new Error("MCP tool command is required");
		}

		this.transport = new SSEClientTransport(new URL(mcpConfig.endpoint));
		this.client = new Client(
			{
				name: "wingman-ai-client",
				version: "1.0.0",
			},
			{
				capabilities: {
					prompts: {},
					resources: {},
					tools: {},
				},
			},
		);
	}

	getName() {
		return this.mcpConfig.name;
	}

	async connect() {
		return this.client.connect(this.transport);
	}

	async close() {
		return this.client.close();
	}

	async getTools() {
		return this.client.listTools();
	}

	async createTools() {
		const remoteTools = await this.getTools();

		const createdTools: DynamicTool[] = [];

		for (const remoteTool of remoteTools.tools) {
			createdTools.push(
				//@ts-expect-error
				tool(
					async (input) => {
						try {
							console.log(
								`MCP Remote tool called: ${this.mcpConfig.name}`,
								input,
							);
							return this.client.callTool({
								name: remoteTool.name,
								arguments: {
									...input,
								},
							});
						} catch (e) {
							//@ts-expect-error
							return `Tool failed to execute due to: ${e.message}`;
						}
					},
					{
						name: remoteTool.name,
						description: remoteTool.description,
						schema: //Empty types come back from MCP server as type object, set these as undefined
							JSON.stringify(remoteTool.inputSchema ?? "") ===
							'{"type":"object"}'
								? undefined
								: remoteTool.inputSchema,
					},
				),
			);
		}

		return createdTools;
	}
}
