import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import path from "node:path";
import fs from "node:fs";

export class MCPAdapter {
	client: MultiServerMCPClient | undefined;
	configPath: string;

	constructor(private readonly workspacePath: string) {
		this.configPath = path.join(workspacePath, ".wingman", "mcp.json");
	}

	async initialize() {
		try {
			if (this.client) {
				this.client.close();
			}

			const mcpFileContents = await fs.promises.readFile(
				this.configPath,
				"utf-8",
			);
			if (!mcpFileContents) {
				throw new Error(`MCP config file not found at ${this.configPath}`);
			}
			const mcpConfig = JSON.parse(mcpFileContents) as { mcpServers: any };
			if (!mcpConfig) {
				throw new Error(
					`MCP config file is empty or invalid at ${this.configPath}`,
				);
			}

			this.client = new MultiServerMCPClient({
				throwOnLoadError: true,
				prefixToolNameWithServerName: true,
				additionalToolNamePrefix: "mcp",
				mcpServers: mcpConfig.mcpServers,
			});
		} catch (e) {
			console.error(e);
		}
	}

	async getTools() {
		return this.client?.getTools();
	}

	async close() {
		return this.client?.close();
	}
}
