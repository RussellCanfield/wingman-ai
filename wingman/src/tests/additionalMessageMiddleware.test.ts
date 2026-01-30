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
