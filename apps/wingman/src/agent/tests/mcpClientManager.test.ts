import { describe, expect, it } from "vitest";
import type { Logger } from "../../logger.js";
import type { MCPServersConfig } from "../../types/mcp.js";
import { MCPClientManager } from "../config/mcpClientManager.js";

const testLogger: Logger = {
	debug: () => {},
	info: () => {},
	warn: () => {},
	error: () => {},
};

const getClientConfig = (
	manager: MCPClientManager,
): {
	mcpServers: Record<
		string,
		{ env: Record<string, string>; defaultToolTimeout?: number }
	>;
} =>
	(
		manager as unknown as {
			buildClientConfig: () => {
				mcpServers: Record<
					string,
					{ env: Record<string, string>; defaultToolTimeout?: number }
				>;
			};
		}
	).buildClientConfig();

describe("MCPClientManager runtime env", () => {
	it("injects workdir for stdio servers", () => {
		const executionWorkspace = "/tmp/wingman-workdir";
		const configs: MCPServersConfig[] = [
			{
				servers: [
					{
						name: "fal-ai",
						transport: "stdio",
						command: "bun",
						args: ["run", "src/tools/mcp-fal-ai.ts"],
						env: { EXISTING: "value" },
					},
				],
			},
		];

		const manager = new MCPClientManager(configs, testLogger, {
			executionWorkspace,
		});
		const clientConfig = getClientConfig(manager);
		const env = clientConfig.mcpServers["fal-ai"].env;

		expect(env.EXISTING).toBe("value");
		expect(env.WINGMAN_WORKDIR).toBe(executionWorkspace);
	});

	it("does not inject workdir when no execution workspace is provided", () => {
		const configs: MCPServersConfig[] = [
			{
				servers: [
					{
						name: "fal-ai",
						transport: "stdio",
						command: "bun",
						args: ["run", "src/tools/mcp-fal-ai.ts"],
						env: { EXISTING: "value" },
					},
				],
			},
		];

		const manager = new MCPClientManager(configs, testLogger);
		const clientConfig = getClientConfig(manager);
		const env = clientConfig.mcpServers["fal-ai"].env;

		expect(env.EXISTING).toBe("value");
		expect(env.WINGMAN_WORKDIR).toBeUndefined();
	});

	it("resolves env placeholders", () => {
		const original = process.env.FAL_API_KEY;
		process.env.FAL_API_KEY = "test-key";
		try {
			const configs: MCPServersConfig[] = [
				{
					servers: [
						{
							name: "fal-ai",
							transport: "stdio",
							command: "bun",
							args: ["run", "src/tools/mcp-fal-ai.ts"],
							env: { FAL_API_KEY: "$" + "{FAL_API_KEY}" },
						},
					],
				},
			];

			const manager = new MCPClientManager(configs, testLogger);
			const clientConfig = getClientConfig(manager);
			expect(clientConfig.mcpServers["fal-ai"].env.FAL_API_KEY).toBe(
				"test-key",
			);
		} finally {
			if (typeof original === "string") {
				process.env.FAL_API_KEY = original;
			} else {
				delete process.env.FAL_API_KEY;
			}
		}
	});

	it("passes through per-server default tool timeout", () => {
		const configs: MCPServersConfig[] = [
			{
				servers: [
					{
						name: "fal-ai",
						transport: "stdio",
						command: "bun",
						args: ["run", "src/tools/mcp-fal-ai.ts"],
						defaultToolTimeout: 300000,
						env: { EXISTING: "value" },
					},
				],
			},
		];

		const manager = new MCPClientManager(configs, testLogger);
		const clientConfig = getClientConfig(manager);
		expect(clientConfig.mcpServers["fal-ai"].defaultToolTimeout).toBe(300000);
	});
});
