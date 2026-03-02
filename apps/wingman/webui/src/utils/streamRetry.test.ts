import { describe, expect, it } from "vitest";
import { resolveActiveStreamMessageId } from "./streamRetry";

describe("resolveActiveStreamMessageId", () => {
	it("keeps state when incoming message id is missing", () => {
		expect(
			resolveActiveStreamMessageId({
				currentActiveMessageId: undefined,
				incomingMessageId: undefined,
			}),
		).toEqual({
			nextActiveMessageId: undefined,
			shouldResetBufferedText: false,
		});

		expect(
			resolveActiveStreamMessageId({
				currentActiveMessageId: "run-1",
				incomingMessageId: undefined,
			}),
		).toEqual({
			nextActiveMessageId: "run-1",
			shouldResetBufferedText: false,
		});
	});

	it("starts tracking when first explicit message id arrives", () => {
		expect(
			resolveActiveStreamMessageId({
				currentActiveMessageId: undefined,
				incomingMessageId: " run-1 ",
			}),
		).toEqual({
			nextActiveMessageId: "run-1",
			shouldResetBufferedText: false,
		});
	});

	it("does not reset when incoming id matches current", () => {
		expect(
			resolveActiveStreamMessageId({
				currentActiveMessageId: "run-1",
				incomingMessageId: "run-1",
			}),
		).toEqual({
			nextActiveMessageId: "run-1",
			shouldResetBufferedText: false,
		});
	});

	it("resets when incoming id changes", () => {
		expect(
			resolveActiveStreamMessageId({
				currentActiveMessageId: "run-1",
				incomingMessageId: "run-2",
			}),
		).toEqual({
			nextActiveMessageId: "run-2",
			shouldResetBufferedText: true,
		});
	});

	it("treats blank incoming ids as missing", () => {
		expect(
			resolveActiveStreamMessageId({
				currentActiveMessageId: "run-1",
				incomingMessageId: "   ",
			}),
		).toEqual({
			nextActiveMessageId: "run-1",
			shouldResetBufferedText: false,
		});
	});
});
