import { describe, expect, it } from "vitest";
import type { ChatMessage } from "./lib/gatewayModels.js";
import {
	resolveLastAssistantMessageId,
	shouldShowAssistantTypingIndicator,
} from "./chatStreamingIndicators.js";

function createAssistantMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
	return {
		id: "assistant-1",
		role: "assistant",
		content: "",
		createdAt: 1,
		...overrides,
	};
}

describe("chatStreamingIndicators", () => {
	it("returns the most recent assistant message id", () => {
		const result = resolveLastAssistantMessageId([
			{ id: "user-1", role: "user", content: "hi", createdAt: 1 },
			{ id: "assistant-1", role: "assistant", content: "hello", createdAt: 2 },
			{ id: "assistant-2", role: "assistant", content: "again", createdAt: 3 },
		]);

		expect(result).toBe("assistant-2");
	});

	it("returns true when assistant is active, streaming, and has no text/activity", () => {
		const result = shouldShowAssistantTypingIndicator({
			message: createAssistantMessage({ id: "assistant-typing" }),
			isStreaming: true,
			activeAssistantMessageId: "assistant-typing",
		});

		expect(result).toBe(true);
	});

	it("returns false when assistant message has text", () => {
		const result = shouldShowAssistantTypingIndicator({
			message: createAssistantMessage({
				id: "assistant-text",
				content: "already streaming text",
			}),
			isStreaming: true,
			activeAssistantMessageId: "assistant-text",
		});

		expect(result).toBe(false);
	});

	it("returns false when tool activity is attached to the message", () => {
		const result = shouldShowAssistantTypingIndicator({
			message: createAssistantMessage({
				id: "assistant-tool",
				toolEvents: [{ id: "tool-1", name: "edit_file", status: "running" }],
			}),
			isStreaming: true,
			activeAssistantMessageId: "assistant-tool",
		});

		expect(result).toBe(false);
	});

	it("returns false for non-active assistant messages", () => {
		const result = shouldShowAssistantTypingIndicator({
			message: createAssistantMessage({ id: "assistant-old" }),
			isStreaming: true,
			activeAssistantMessageId: "assistant-new",
		});

		expect(result).toBe(false);
	});
});
