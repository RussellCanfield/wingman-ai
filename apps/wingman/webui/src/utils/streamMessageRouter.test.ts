import { describe, expect, it } from "vitest";
import {
	clearStreamMessageTargets,
	resolveTextMessageTargetId,
	resolveToolMessageTargetId,
} from "./streamMessageRouter";

describe("streamMessageRouter", () => {
	it("uses fallback message id when text event has no stream id", () => {
		const state = new Map<string, Map<string, string>>();
		const messageId = resolveTextMessageTargetId({
			state,
			requestId: "req-1",
			fallbackMessageId: "assistant-1",
		});
		expect(messageId).toBe("assistant-1");
	});

	it("keeps delta text without ids on fallback message", () => {
		const state = new Map<string, Map<string, string>>();
		const messageId = resolveTextMessageTargetId({
			state,
			requestId: "req-1a",
			fallbackMessageId: "assistant-1a",
			isDelta: true,
		});
		expect(messageId).toBe("assistant-1a");
	});

	it("keeps text chunks from same run on one message id", () => {
		const state = new Map<string, Map<string, string>>();
		const first = resolveTextMessageTargetId({
			state,
			requestId: "req-2",
			fallbackMessageId: "assistant-2",
			streamMessageId: "run-A",
		});
		const second = resolveTextMessageTargetId({
			state,
			requestId: "req-2",
			fallbackMessageId: "assistant-2",
			streamMessageId: "run-A",
		});

		expect(first).toBe(second);
		expect(first).not.toBe("assistant-2");
	});

	it("routes different runs to different derived message ids", () => {
		const state = new Map<string, Map<string, string>>();
		const first = resolveTextMessageTargetId({
			state,
			requestId: "req-3",
			fallbackMessageId: "assistant-3",
			streamMessageId: "run-A",
		});
		const second = resolveTextMessageTargetId({
			state,
			requestId: "req-3",
			fallbackMessageId: "assistant-3",
			streamMessageId: "run-B",
		});

		expect(first).not.toBe(second);
	});

	it("routes non-delta no-id events to unique derived messages", () => {
		const state = new Map<string, Map<string, string>>();
		const first = resolveTextMessageTargetId({
			state,
			requestId: "req-3a",
			fallbackMessageId: "assistant-3a",
			isDelta: false,
			eventKey: "evt-1",
		});
		const second = resolveTextMessageTargetId({
			state,
			requestId: "req-3a",
			fallbackMessageId: "assistant-3a",
			isDelta: false,
			eventKey: "evt-2",
		});
		const firstAgain = resolveTextMessageTargetId({
			state,
			requestId: "req-3a",
			fallbackMessageId: "assistant-3a",
			isDelta: false,
			eventKey: "evt-1",
		});

		expect(first).not.toBe("assistant-3a");
		expect(second).not.toBe("assistant-3a");
		expect(first).not.toBe(second);
		expect(firstAgain).toBe(first);
	});

	it("prefers event keys for non-delta routing even when run id is present", () => {
		const state = new Map<string, Map<string, string>>();
		const first = resolveTextMessageTargetId({
			state,
			requestId: "req-3b",
			fallbackMessageId: "assistant-3b",
			streamMessageId: "run-shared",
			isDelta: false,
			eventKey: "evt-a",
		});
		const second = resolveTextMessageTargetId({
			state,
			requestId: "req-3b",
			fallbackMessageId: "assistant-3b",
			streamMessageId: "run-shared",
			isDelta: false,
			eventKey: "evt-b",
		});

		expect(first).not.toBe(second);
	});

	it("routes tool events to parent run message when available", () => {
		const state = new Map<string, Map<string, string>>();
		const textMessageId = resolveTextMessageTargetId({
			state,
			requestId: "req-4",
			fallbackMessageId: "assistant-4",
			streamMessageId: "parent-run",
		});

		const toolMessageId = resolveToolMessageTargetId({
			state,
			requestId: "req-4",
			fallbackMessageId: "assistant-4",
			runId: "tool-run",
			parentRunIds: ["parent-run"],
		});

		expect(toolMessageId).toBe(textMessageId);
	});

	it("aliases tool run ids when parent mapping is used", () => {
		const state = new Map<string, Map<string, string>>();
		const textMessageId = resolveTextMessageTargetId({
			state,
			requestId: "req-4a",
			fallbackMessageId: "assistant-4a",
			streamMessageId: "parent-run",
		});

		const startMessageId = resolveToolMessageTargetId({
			state,
			requestId: "req-4a",
			fallbackMessageId: "assistant-4a",
			runId: "tool-run",
			parentRunIds: ["parent-run"],
		});
		const endMessageId = resolveToolMessageTargetId({
			state,
			requestId: "req-4a",
			fallbackMessageId: "assistant-4a",
			runId: "tool-run",
		});

		expect(startMessageId).toBe(textMessageId);
		expect(endMessageId).toBe(textMessageId);
	});

	it("clears per-request mappings after completion", () => {
		const state = new Map<string, Map<string, string>>();
		resolveTextMessageTargetId({
			state,
			requestId: "req-5",
			fallbackMessageId: "assistant-5",
			streamMessageId: "run-A",
		});
		expect(state.has("req-5")).toBe(true);
		clearStreamMessageTargets(state, "req-5");
		expect(state.has("req-5")).toBe(false);
	});
});
