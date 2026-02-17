import { describe, expect, it, vi } from "vitest";
import { createMCPResourceTools } from "../tools/mcp_resources.js";
import type { MCPClientManager } from "../config/mcpClientManager.js";

const createManagerStub = () => {
	const listResources = vi.fn();
	const listResourceTemplates = vi.fn();
	const readResource = vi.fn();
	const manager = {
		listResources,
		listResourceTemplates,
		readResource,
	} as unknown as MCPClientManager;
	return { manager, listResources, listResourceTemplates, readResource };
};

describe("mcp resource tools", () => {
	it("lists resources and templates", async () => {
		const { manager, listResources, listResourceTemplates } = createManagerStub();
		listResources.mockResolvedValue({
			fal: [{ uri: "fal://jobs/1", name: "Job 1", mimeType: "application/json" }],
		});
		listResourceTemplates.mockResolvedValue({
			fal: [{ uriTemplate: "fal://jobs/{id}", name: "Job by id" }],
		});

		const [listTool] = createMCPResourceTools(manager);
		const output = await listTool.invoke({ includeTemplates: true });
		const parsed = JSON.parse(String(output));

		expect(listResources).toHaveBeenCalledWith([]);
		expect(listResourceTemplates).toHaveBeenCalledWith([]);
		expect(parsed.resourceCount).toBe(1);
		expect(parsed.resourceTemplateCount).toBe(1);
		expect(parsed.resources.fal[0].uri).toBe("fal://jobs/1");
	});

	it("reads resource content without inlining binary blobs by default", async () => {
		const { manager, readResource } = createManagerStub();
		readResource.mockResolvedValue([
			{
				uri: "fal://jobs/1",
				mimeType: "application/json",
				text: "abcdefghijklmnopqrstuvwxyz",
				blob: "YWJjZA==",
			},
		]);

		const tools = createMCPResourceTools(manager);
		const readTool = tools.find((entry) => entry.name === "mcp_read_resource");
		if (!readTool) {
			throw new Error("mcp_read_resource tool missing");
		}

		const output = await readTool.invoke({
			server: "fal",
			uri: "fal://jobs/1",
			maxTextChars: 10,
		});
		const parsed = JSON.parse(String(output));

		expect(readResource).toHaveBeenCalledWith("fal", "fal://jobs/1");
		expect(parsed.content[0].text).toBe("abcdefghij");
		expect(parsed.content[0].truncated).toBe(true);
		expect(parsed.content[0].blobLength).toBe(8);
		expect(parsed.content[0].blob).toBeUndefined();
	});

	it("can include binary blobs when requested", async () => {
		const { manager, readResource } = createManagerStub();
		readResource.mockResolvedValue([
			{
				uri: "fal://jobs/2",
				mimeType: "image/png",
				blob: "YWJjZA==",
			},
		]);

		const tools = createMCPResourceTools(manager);
		const readTool = tools.find((entry) => entry.name === "mcp_read_resource");
		if (!readTool) {
			throw new Error("mcp_read_resource tool missing");
		}

		const output = await readTool.invoke({
			server: "fal",
			uri: "fal://jobs/2",
			includeBinary: true,
		});
		const parsed = JSON.parse(String(output));

		expect(parsed.content[0].blob).toBe("YWJjZA==");
	});
});
