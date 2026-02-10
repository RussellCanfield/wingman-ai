import { describe, expect, it } from "vitest";
import type { ChatMessage, Thread } from "../types";
import { appendLocalPromptMessagesToThread } from "./threadState";

const baseThread: Thread = {
	id: "thread-1",
	name: "New Thread",
	agentId: "main",
	messages: [],
	createdAt: 1,
	messageCount: 0,
	messagesLoaded: false,
};

const userMessage: ChatMessage = {
	id: "user-1",
	role: "user",
	content: "Plan this fix",
	createdAt: 100,
};

const assistantMessage: ChatMessage = {
	id: "req-1",
	role: "assistant",
	content: "",
	createdAt: 100,
};

describe("appendLocalPromptMessagesToThread", () => {
	it("appends optimistic user+assistant messages and marks thread loaded", () => {
		const updated = appendLocalPromptMessagesToThread({
			thread: baseThread,
			targetThreadId: "thread-1",
			userMessage,
			assistantMessage,
			attachmentPreview: "",
			now: 200,
			defaultThreadName: "New Thread",
		});

		expect(updated.messages).toHaveLength(2);
		expect(updated.messages[0].id).toBe("user-1");
		expect(updated.messages[1].id).toBe("req-1");
		expect(updated.messagesLoaded).toBe(true);
		expect(updated.name).toBe("Plan this fix");
	});

	it("returns the original thread when the target does not match", () => {
		const updated = appendLocalPromptMessagesToThread({
			thread: baseThread,
			targetThreadId: "thread-2",
			userMessage,
			assistantMessage,
			attachmentPreview: "",
			now: 200,
			defaultThreadName: "New Thread",
		});

		expect(updated).toBe(baseThread);
	});
});
