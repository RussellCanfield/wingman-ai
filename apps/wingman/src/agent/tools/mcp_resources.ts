import type { StructuredTool } from "@langchain/core/tools";
import { tool } from "langchain";
import * as z from "zod";
import type { MCPClientManager } from "../config/mcpClientManager.js";

const listResourcesSchema = z.object({
	servers: z
		.array(z.string().min(1))
		.optional()
		.describe(
			"Optional server names to filter by. Omit to list resources from all configured MCP servers.",
		),
	includeTemplates: z
		.boolean()
		.optional()
		.default(false)
		.describe("Include resource templates in the response."),
});

const readResourceSchema = z.object({
	server: z
		.string()
		.min(1)
		.describe("MCP server name that owns the resource."),
	uri: z.string().min(1).describe("Resource URI to read."),
	maxTextChars: z
		.number()
		.int()
		.positive()
		.max(200000)
		.optional()
		.default(20000)
		.describe(
			"Maximum text characters to inline per content block in the response.",
		),
	includeBinary: z
		.boolean()
		.optional()
		.default(false)
		.describe("Include base64 binary blobs in the response. Off by default."),
});

export function createMCPResourceTools(
	mcpManager: MCPClientManager,
): StructuredTool[] {
	const listResourcesTool = tool(
		async ({
			servers,
			includeTemplates = false,
		}: {
			servers?: string[];
			includeTemplates?: boolean;
		}) => {
			const filteredServers =
				servers
					?.map((name) => name.trim())
					.filter((name) => name.length > 0) || [];
			const resources = await mcpManager.listResources(filteredServers);
			const resourceCount = Object.values(resources).reduce(
				(total, entries) => total + entries.length,
				0,
			);

			if (!includeTemplates) {
				return JSON.stringify(
					{
						servers: Object.keys(resources),
						resourceCount,
						resources,
					},
					null,
					2,
				);
			}

			const resourceTemplates = await mcpManager.listResourceTemplates(
				filteredServers,
			);
			const resourceTemplateCount = Object.values(resourceTemplates).reduce(
				(total, entries) => total + entries.length,
				0,
			);
			return JSON.stringify(
				{
					servers: Object.keys(resources),
					resourceCount,
					resources,
					resourceTemplateCount,
					resourceTemplates,
				},
				null,
				2,
			);
		},
		{
			name: "mcp_list_resources",
			description:
				"List resources exposed by configured MCP servers, with optional resource templates.",
			schema: listResourcesSchema,
		},
	);

	const readResourceTool = tool(
		async ({
			server,
			uri,
			maxTextChars = 20000,
			includeBinary = false,
		}: {
			server: string;
			uri: string;
			maxTextChars?: number;
			includeBinary?: boolean;
		}) => {
			const content = await mcpManager.readResource(server, uri);
			const blocks = content.map((entry) => {
				const text = typeof entry.text === "string" ? entry.text : "";
				const truncated = text.length > maxTextChars;
				const blob =
					includeBinary && typeof entry.blob === "string" ? entry.blob : undefined;
				return {
					uri: entry.uri,
					...(entry.mimeType ? { mimeType: entry.mimeType } : {}),
					...(text
						? {
								text: truncated ? text.slice(0, maxTextChars) : text,
								textLength: text.length,
								truncated,
							}
						: {}),
					...(typeof entry.blob === "string"
						? { blobLength: entry.blob.length }
						: {}),
					...(blob ? { blob } : {}),
				};
			});

			return JSON.stringify(
				{
					server,
					uri,
					blockCount: blocks.length,
					content: blocks,
				},
				null,
				2,
			);
		},
		{
			name: "mcp_read_resource",
			description:
				"Read content from a specific MCP resource URI on a specific server.",
			schema: readResourceSchema,
		},
	);

	return [listResourcesTool, readResourceTool];
}
