import { describe, expect, it } from "vitest";
import { isAssistantTextStreamChunk } from "./streamChunkKind";

describe("isAssistantTextStreamChunk", () => {
	it("returns true for on_chat_model_stream events", () => {
		expect(
			isAssistantTextStreamChunk({
				event: "on_chat_model_stream",
			}),
		).toBe(true);
	});

	it("returns false for non-text lifecycle and tool events", () => {
		expect(isAssistantTextStreamChunk({ event: "on_chain_start" })).toBe(false);
		expect(isAssistantTextStreamChunk({ event: "on_chain_end" })).toBe(false);
		expect(isAssistantTextStreamChunk({ event: "on_tool_start" })).toBe(false);
		expect(isAssistantTextStreamChunk({ event: "on_tool_end" })).toBe(false);
	});

	it("returns false for invalid payloads", () => {
		expect(isAssistantTextStreamChunk(null)).toBe(false);
		expect(isAssistantTextStreamChunk("text")).toBe(false);
		expect(isAssistantTextStreamChunk({})).toBe(false);
	});
});
