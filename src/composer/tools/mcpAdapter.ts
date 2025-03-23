import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import path from "node:path";

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

			this.client = MultiServerMCPClient.fromConfigFile(this.configPath);

			return this.client?.initializeConnections();
		} catch (e) {
			console.error(e);
		}

		return Promise.resolve(new Map()) as ReturnType<
			MultiServerMCPClient["initializeConnections"]
		>;
	}

	async close() {
		return this.client?.close();
	}
}
