import { describe, expect, it } from "vitest";
import { mediaCompatibilityMiddleware } from "../agent/middleware/media-compat.js";

async function runBeforeAgent(
	middleware: ReturnType<typeof mediaCompatibilityMiddleware>,
	input: { messages: Array<{ content?: unknown }> },
): Promise<{ messages: Array<{ content?: unknown }> }> {
	const beforeAgent =
		typeof middleware.beforeAgent === "function"
			? middleware.beforeAgent
			: middleware.beforeAgent?.hook;
	if (!beforeAgent) {
		throw new Error("beforeAgent hook not configured");
	}
	return (await (beforeAgent as any)(input, {})) as {
		messages: Array<{ content?: unknown }>;
	};
}

describe("mediaCompatibilityMiddleware", () => {
	it("strips audio blocks for Anthropic models and preserves other blocks", async () => {
		const middleware = mediaCompatibilityMiddleware({
			model: { constructor: { name: "ChatAnthropic" } },
		});
		const input = {
			messages: [
				{
					content: [
						{ type: "text", text: "Hello" },
						{ type: "audio", source_type: "base64", data: "abc" },
					],
				},
			],
		};

		const result = await runBeforeAgent(middleware, input);
		const content = result.messages[0]?.content as Array<{ type?: string }>;

		expect(Array.isArray(content)).toBe(true);
		expect(content).toHaveLength(1);
		expect(content[0]?.type).toBe("text");
	});

	it("replaces content with a placeholder when only audio blocks remain", async () => {
		const middleware = mediaCompatibilityMiddleware({
			model: { constructor: { name: "ChatAnthropic" } },
		});
		const input = {
			messages: [
				{
					content: [{ type: "audio_url", audio_url: { url: "https://x/y" } }],
				},
			],
		};

		const result = await runBeforeAgent(middleware, input);
		const content = result.messages[0]?.content as string;

		expect(typeof content).toBe("string");
		expect(content).toContain("Audio omitted");
	});

	it("leaves audio blocks untouched for non-Anthropic models", async () => {
		const middleware = mediaCompatibilityMiddleware({
			model: { constructor: { name: "ChatOpenAI" } },
		});
		const input = {
			messages: [
				{
					content: [
						{ type: "text", text: "Hello" },
						{ type: "input_audio", input_audio: { data: "abc", format: "wav" } },
					],
				},
			],
		};

		const result = await runBeforeAgent(middleware, input);
		const content = result.messages[0]?.content as Array<{ type?: string }>;

		expect(Array.isArray(content)).toBe(true);
		expect(content).toHaveLength(2);
		expect(content[1]?.type).toBe("input_audio");
	});
});
