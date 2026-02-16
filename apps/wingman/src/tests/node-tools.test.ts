import { describe, expect, it, vi } from "vitest";
import { getAvailableTools } from "@/agent/config/toolRegistry.js";
import {
	createNodeNotifyTool,
	createNodeRunTool,
} from "@/agent/tools/node_invoke.js";

describe("node tools", () => {
	it("exposes node tools in available tool names", () => {
		const tools = getAvailableTools();
		expect(tools).toContain("node_notify");
		expect(tools).toContain("node_run");
	});

	it("routes node_notify through the injected node invoker", async () => {
		const nodeInvoker = vi.fn(async () => ({
			nodeId: "node-123",
			payload: {
				delivered: true,
			},
		}));
		const tool = createNodeNotifyTool({
			nodeInvoker,
			defaultTargetClientId: "desktop-abc",
		});

		const result = (await tool.invoke({
			body: "Build finished",
		})) as {
			ok: boolean;
			nodeId: string;
			delivered: boolean;
		};

		expect(result.ok).toBe(true);
		expect(result.nodeId).toBe("node-123");
		expect(result.delivered).toBe(true);
		expect(nodeInvoker).toHaveBeenCalledWith(
			expect.objectContaining({
				tool: "system.notify",
				targetClientId: "desktop-abc",
			}),
		);
	});

	it("returns command result fields from node_run", async () => {
		const nodeInvoker = vi.fn(async () => ({
			nodeId: "node-789",
			payload: {
				exitCode: 0,
				stdout: "ok",
				stderr: "",
			},
		}));
		const tool = createNodeRunTool({
			nodeInvoker,
		});

		const result = (await tool.invoke({
			command: "/bin/echo",
			args: ["hello"],
			target: {
				nodeId: "node-789",
			},
		})) as {
			ok: boolean;
			nodeId: string;
			exitCode: number;
			stdout: string;
			stderr: string;
		};

		expect(result.ok).toBe(true);
		expect(result.nodeId).toBe("node-789");
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("ok");
		expect(result.stderr).toBe("");
		expect(nodeInvoker).toHaveBeenCalledWith(
			expect.objectContaining({
				tool: "system.run",
				targetNodeId: "node-789",
			}),
		);
	});

	it("returns an availability error outside gateway runtime", async () => {
		const tool = createNodeRunTool();
		const result = (await tool.invoke({
			command: "pwd",
		})) as {
			ok: boolean;
			error: string;
		};
		expect(result.ok).toBe(false);
		expect(result.error).toContain("only available");
	});
});
