import { describe, expect, test } from "vitest";
import { findThreadNeedingHydration } from "./threadHydration.js";
import type { SessionThread } from "./gatewayModels.js";

function makeThread(partial: Partial<SessionThread>): SessionThread {
	return {
		id: "thread-1",
		agentId: "main",
		name: "Thread",
		createdAt: Date.now(),
		updatedAt: Date.now(),
		lastMessagePreview: "",
		messageCount: 0,
		messagesLoaded: false,
		messages: [],
		...partial,
	};
}

describe("findThreadNeedingHydration", () => {
	test("returns active thread when messages are not loaded", () => {
		const thread = makeThread({ id: "a", messagesLoaded: false });
		const result = findThreadNeedingHydration([thread], "a");
		expect(result?.id).toBe("a");
	});

	test("returns undefined when active thread is already loaded", () => {
		const thread = makeThread({ id: "a", messagesLoaded: true });
		const result = findThreadNeedingHydration([thread], "a");
		expect(result).toBeUndefined();
	});

	test("returns undefined when active thread id is missing", () => {
		const thread = makeThread({ id: "a", messagesLoaded: false });
		const result = findThreadNeedingHydration([thread], "");
		expect(result).toBeUndefined();
	});
});
