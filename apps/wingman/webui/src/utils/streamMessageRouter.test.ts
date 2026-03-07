import { describe, expect, it } from "vitest";
import {
	clearStreamMessageTargets,
	getRequestMessageTargetIds,
	resolveTextMessageTargetId,
	resolveToolMessageTargetId,
} from "./streamMessageRouter";

describe("streamMessageRouter", () => {
	it("keeps text on the current assistant message", () => {
		const state = new Map();

		const first = resolveTextMessageTargetId({
			state,
			requestId: "req-1",
			fallbackMessageId: "assistant-1",
		});
		const second = resolveTextMessageTargetId({
			state,
			requestId: "req-1",
			fallbackMessageId: "assistant-1",
		});

		expect(first).toBe("assistant-1");
		expect(second).toBe("assistant-1");
		expect(getRequestMessageTargetIds(state, "req-1", "assistant-1")).toEqual([
			"assistant-1",
		]);
	});

	it("starts a new assistant message when a new tool phase begins after text", () => {
		const state = new Map();

		resolveTextMessageTargetId({
			state,
			requestId: "req-2",
			fallbackMessageId: "assistant-2",
		});
		const toolMessageId = resolveToolMessageTargetId({
			state,
			requestId: "req-2",
			fallbackMessageId: "assistant-2",
			runId: "tool-run-1",
		});
		const textAfterToolMessageId = resolveTextMessageTargetId({
			state,
			requestId: "req-2",
			fallbackMessageId: "assistant-2",
		});

		expect(toolMessageId).not.toBe("assistant-2");
		expect(textAfterToolMessageId).toBe(toolMessageId);
		expect(getRequestMessageTargetIds(state, "req-2", "assistant-2")).toEqual([
			"assistant-2",
			toolMessageId,
		]);
	});

	it("keeps multiple tools in the same tool phase on one message", () => {
		const state = new Map();

		resolveTextMessageTargetId({
			state,
			requestId: "req-3",
			fallbackMessageId: "assistant-3",
		});
		const firstToolMessageId = resolveToolMessageTargetId({
			state,
			requestId: "req-3",
			fallbackMessageId: "assistant-3",
			runId: "tool-run-1",
		});
		const secondToolMessageId = resolveToolMessageTargetId({
			state,
			requestId: "req-3",
			fallbackMessageId: "assistant-3",
			runId: "tool-run-2",
		});

		expect(secondToolMessageId).toBe(firstToolMessageId);
	});

	it("starts another assistant message when a later tool phase begins", () => {
		const state = new Map();

		resolveTextMessageTargetId({
			state,
			requestId: "req-4",
			fallbackMessageId: "assistant-4",
		});
		const firstToolMessageId = resolveToolMessageTargetId({
			state,
			requestId: "req-4",
			fallbackMessageId: "assistant-4",
			runId: "tool-run-1",
		});
		resolveTextMessageTargetId({
			state,
			requestId: "req-4",
			fallbackMessageId: "assistant-4",
		});
		const secondToolMessageId = resolveToolMessageTargetId({
			state,
			requestId: "req-4",
			fallbackMessageId: "assistant-4",
			runId: "tool-run-2",
		});

		expect(secondToolMessageId).not.toBe(firstToolMessageId);
		expect(getRequestMessageTargetIds(state, "req-4", "assistant-4")).toEqual([
			"assistant-4",
			firstToolMessageId,
			secondToolMessageId,
		]);
	});

	it("keeps tool updates on the message where the run started", () => {
		const state = new Map();

		resolveTextMessageTargetId({
			state,
			requestId: "req-5",
			fallbackMessageId: "assistant-5",
		});
		const firstToolMessageId = resolveToolMessageTargetId({
			state,
			requestId: "req-5",
			fallbackMessageId: "assistant-5",
			runId: "tool-run-1",
		});
		resolveTextMessageTargetId({
			state,
			requestId: "req-5",
			fallbackMessageId: "assistant-5",
		});
		resolveToolMessageTargetId({
			state,
			requestId: "req-5",
			fallbackMessageId: "assistant-5",
			runId: "tool-run-2",
		});
		const toolUpdateMessageId = resolveToolMessageTargetId({
			state,
			requestId: "req-5",
			fallbackMessageId: "assistant-5",
			runId: "tool-run-1",
		});

		expect(toolUpdateMessageId).toBe(firstToolMessageId);
	});

	it("inherits a parent tool message for nested tool runs", () => {
		const state = new Map();

		resolveTextMessageTargetId({
			state,
			requestId: "req-6",
			fallbackMessageId: "assistant-6",
		});
		const parentToolMessageId = resolveToolMessageTargetId({
			state,
			requestId: "req-6",
			fallbackMessageId: "assistant-6",
			runId: "tool-run-parent",
		});
		const childToolMessageId = resolveToolMessageTargetId({
			state,
			requestId: "req-6",
			fallbackMessageId: "assistant-6",
			runId: "tool-run-child",
			parentRunIds: ["tool-run-parent"],
		});

		expect(childToolMessageId).toBe(parentToolMessageId);
	});

	it("clears per-request state after completion", () => {
		const state = new Map();

		resolveTextMessageTargetId({
			state,
			requestId: "req-7",
			fallbackMessageId: "assistant-7",
		});

		expect(state.has("req-7")).toBe(true);
		clearStreamMessageTargets(state, "req-7");
		expect(state.has("req-7")).toBe(false);
		expect(getRequestMessageTargetIds(state, "req-7", "assistant-7")).toEqual([
			"assistant-7",
		]);
	});
});
