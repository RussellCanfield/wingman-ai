import { describe, expect, it, vi } from "vitest";
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
		{
			command: string;
			args?: string[];
			env: Record<string, string>;
			defaultToolTimeout?: number;
		}
	>;
	outputHandling: {
		image: "artifact";
		audio: "artifact";
		resource: "artifact";
	};
} =>
	(
		manager as unknown as {
			buildClientConfig: () => {
				mcpServers: Record<
					string,
					{
						command: string;
						args?: string[];
						env: Record<string, string>;
						defaultToolTimeout?: number;
					}
				>;
				outputHandling: {
					image: "artifact";
					audio: "artifact";
					resource: "artifact";
				};
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

	it("wraps stdio servers with proxy command when enabled", () => {
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
			proxyConfig: {
				enabled: true,
				command: "uvx",
				baseArgs: ["invariant-gateway@latest", "mcp"],
				projectName: "wingman-gateway",
				apiKey: "test-api-key",
				apiUrl: "https://explorer.invariantlabs.ai",
			},
		});
		const clientConfig = getClientConfig(manager);
		const server = clientConfig.mcpServers["fal-ai"];

		expect(server.command).toBe("uvx");
		expect(server.args).toEqual([
			"invariant-gateway@latest",
			"mcp",
			"--project-name",
			"wingman-gateway",
			"--exec",
			"bun",
			"run",
			"src/tools/mcp-fal-ai.ts",
		]);
		expect(server.env.EXISTING).toBe("value");
		expect(server.env.INVARIANT_API_KEY).toBe("test-api-key");
		expect(server.env.INVARIANT_API_URL).toBe(
			"https://explorer.invariantlabs.ai",
		);
		expect(server.env.GUARDRAILS_API_URL).toBe(
			"https://explorer.invariantlabs.ai",
		);
	});

	it("keeps MCP multimodal output handling in artifact mode", () => {
		const configs: MCPServersConfig[] = [
			{
				servers: [
					{
						name: "fal-ai",
						transport: "stdio",
						command: "bun",
						args: ["run", "src/tools/mcp-fal-ai.ts"],
					},
				],
			},
		];
		const manager = new MCPClientManager(configs, testLogger);
		const clientConfig = getClientConfig(manager);

		expect(clientConfig.outputHandling).toEqual({
			image: "artifact",
			audio: "artifact",
			resource: "artifact",
		});
	});

	it("lists resources from MCP client", async () => {
		const listResources = vi.fn().mockResolvedValue({
			fal: [
				{
					uri: "fal://jobs/123",
					name: "Job 123",
					description: "Generated asset",
					mimeType: "application/json",
				},
			],
		});
		const manager = new MCPClientManager([], testLogger);
		(manager as unknown as { client: { listResources: typeof listResources } })
			.client = { listResources };

		const result = await manager.listResources(["fal"]);
		expect(listResources).toHaveBeenCalledWith("fal");
		expect(result).toEqual({
			fal: [
				{
					uri: "fal://jobs/123",
					name: "Job 123",
					description: "Generated asset",
					mimeType: "application/json",
				},
			],
		});
	});

	it("lists resource templates from MCP client", async () => {
		const listResourceTemplates = vi.fn().mockResolvedValue({
			fal: [
				{
					uriTemplate: "fal://jobs/{jobId}",
					name: "Fal Job",
					description: "Job by ID",
					mimeType: "application/json",
				},
			],
		});
		const manager = new MCPClientManager([], testLogger);
		(
			manager as unknown as {
				client: { listResourceTemplates: typeof listResourceTemplates };
			}
		).client = { listResourceTemplates };

		const result = await manager.listResourceTemplates(["fal"]);
		expect(listResourceTemplates).toHaveBeenCalledWith("fal");
		expect(result).toEqual({
			fal: [
				{
					uriTemplate: "fal://jobs/{jobId}",
					name: "Fal Job",
					description: "Job by ID",
					mimeType: "application/json",
				},
			],
		});
	});

	it("reads resources from MCP client", async () => {
		const readResource = vi.fn().mockResolvedValue([
			{
				uri: "fal://jobs/123",
				mimeType: "application/json",
				text: '{"status":"completed"}',
			},
		]);
		const manager = new MCPClientManager([], testLogger);
		(manager as unknown as { client: { readResource: typeof readResource } })
			.client = { readResource };

		const result = await manager.readResource("fal", "fal://jobs/123");
		expect(readResource).toHaveBeenCalledWith("fal", "fal://jobs/123");
		expect(result).toEqual([
			{
				uri: "fal://jobs/123",
				mimeType: "application/json",
				text: '{"status":"completed"}',
			},
		]);
	});

	it("calls close on cleanup", async () => {
		const close = vi.fn().mockResolvedValue(undefined);
		const manager = new MCPClientManager([], testLogger);
		(manager as unknown as { client: { close: typeof close } | null }).client = {
			close,
		};

		await manager.cleanup();

		expect(close).toHaveBeenCalledTimes(1);
		expect(
			(manager as unknown as { client: { close: typeof close } | null }).client,
		).toBeNull();
	});
});
