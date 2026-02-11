import path from "node:path";
import { describe, expect, it } from "vitest";
import { HumanMessage } from "langchain";
import { additionalMessageMiddleware } from "../agent/middleware/additional-messages.js";

describe("additionalMessageMiddleware", () => {
	it("injects the additional message when missing", async () => {
		const middleware = additionalMessageMiddleware();
		const input = { messages: [new HumanMessage("Hello")] };

		const beforeAgent =
			typeof middleware.beforeAgent === "function"
				? middleware.beforeAgent
				: middleware.beforeAgent?.hook;
		if (!beforeAgent) {
			throw new Error("beforeAgent hook not configured");
		}
		const result = (await (beforeAgent as any)(input, {})) as {
			messages: unknown[];
		};

		expect(result.messages).toHaveLength(2);
		const injected = result.messages[0] as unknown as {
			additional_kwargs?: { source?: string };
		};
		expect(injected.additional_kwargs?.source).toBe(
			"additional-message-middleware",
		);
		expect(injected).toBeInstanceOf(HumanMessage);
	});

	it("adds confidentiality guidance without exposing machine details", async () => {
		const workspaceRoot = path.resolve("repo");
		const workdir = path.join(workspaceRoot, "output");
		const middleware = additionalMessageMiddleware({
			workspaceRoot,
			workdir,
		});
		const input = { messages: [new HumanMessage("Hello")] };

		const beforeAgent =
			typeof middleware.beforeAgent === "function"
				? middleware.beforeAgent
				: middleware.beforeAgent?.hook;
		if (!beforeAgent) {
			throw new Error("beforeAgent hook not configured");
		}
		const result = (await (beforeAgent as any)(input, {})) as {
			messages: unknown[];
		};

		const injected = result.messages[0] as unknown as {
			content?: string;
		};
		const content = injected.content ?? "";

		expect(content).toContain("Confidentiality");
		expect(content).toContain("inspect system/tool output internally");
		expect(content).toContain("Do not disclose");
		expect(content).toContain("Do not quote internal tool call IDs");
		expect(content).toContain("Working Directory");
		expect(content).toContain("current working directory");
		expect(content).toContain("Use relative paths");
		expect(content).not.toContain("Operating System:");
		expect(content).not.toContain("Architecture:");
		expect(content).not.toContain("Default Shell:");
		expect(content).toContain("session output directory");
		expect(content).toContain("output");
		expect(content).not.toContain(workdir);
		expect(content).not.toContain(workspaceRoot);
	});

	it("uses virtual output path when workdir is outside the workspace root", async () => {
		const workspaceRoot = path.resolve("repo");
		const workdir = path.resolve("external-output");
		const middleware = additionalMessageMiddleware({
			workspaceRoot,
			workdir,
			outputVirtualPath: "/workdir/",
		});
		const input = { messages: [new HumanMessage("Hello")] };

		const beforeAgent =
			typeof middleware.beforeAgent === "function"
				? middleware.beforeAgent
				: middleware.beforeAgent?.hook;
		if (!beforeAgent) {
			throw new Error("beforeAgent hook not configured");
		}
		const result = (await (beforeAgent as any)(input, {})) as {
			messages: unknown[];
		};

		const injected = result.messages[0] as unknown as {
			content?: string;
		};
		const content = injected.content ?? "";

		expect(content).toContain("session output directory");
		expect(content).toContain("/workdir/");
		expect(content).not.toContain("(path hidden)");
		expect(content).not.toContain(workdir);
	});

	it("does not inject the additional message twice", async () => {
		const middleware = additionalMessageMiddleware();
		const input = { messages: [new HumanMessage("Hello")] };

		const beforeAgent =
			typeof middleware.beforeAgent === "function"
				? middleware.beforeAgent
				: middleware.beforeAgent?.hook;
		if (!beforeAgent) {
			throw new Error("beforeAgent hook not configured");
		}
		const first = (await (beforeAgent as any)(input, {})) as {
			messages: unknown[];
		};
		const second = (await (beforeAgent as any)(
			{
				messages: first.messages,
			},
			{},
		)) as {
			messages: unknown[];
		};

		const messages = second.messages as Array<{
			additional_kwargs?: { source?: string };
		}>;
		const injectedCount = messages.filter((message) => {
			const source = message.additional_kwargs?.source;
			return source === "additional-message-middleware";
		}).length;

		expect(injectedCount).toBe(1);
	});
});
