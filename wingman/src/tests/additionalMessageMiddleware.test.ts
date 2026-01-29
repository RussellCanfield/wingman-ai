import { describe, expect, it } from "vitest";
import { HumanMessage } from "langchain";
import { additionalMessageMiddleware } from "../agent/middleware/additional-messages.js";

describe("additionalMessageMiddleware", () => {
	it("injects the additional message when missing", async () => {
		const middleware = additionalMessageMiddleware();
		const input = { messages: [new HumanMessage("Hello")] };

		const result = await middleware.beforeAgent!(input);

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

		const first = await middleware.beforeAgent!(input);
		const second = await middleware.beforeAgent!({
			messages: first.messages,
		});

		const injectedCount = second.messages.filter((message) => {
			const source = (message as { additional_kwargs?: { source?: string } })
				?.additional_kwargs?.source;
			return source === "additional-message-middleware";
		}).length;

		expect(injectedCount).toBe(1);
	});
});
