import { describe, expect, it } from "vitest";
import {
	computeComposerTextareaLayout,
	resolveComposerStatusHint,
	shouldRefocusComposer,
} from "./composer";

describe("computeComposerTextareaLayout", () => {
	it("caps height at max lines and enables overflow", () => {
		const result = computeComposerTextareaLayout({
			scrollHeight: 320,
			lineHeight: 24,
			paddingTop: 10,
			paddingBottom: 10,
			maxLines: 4,
		});

		expect(result).toEqual({
			heightPx: 116,
			overflowY: "auto",
		});
	});

	it("enforces minimum single-line height", () => {
		const result = computeComposerTextareaLayout({
			scrollHeight: 10,
			lineHeight: 24,
			paddingTop: 10,
			paddingBottom: 10,
			maxLines: 4,
		});

		expect(result).toEqual({
			heightPx: 44,
			overflowY: "hidden",
		});
	});
});

describe("shouldRefocusComposer", () => {
	it("returns true when streaming just ended", () => {
		expect(
			shouldRefocusComposer({
				wasStreaming: true,
				isStreaming: false,
			}),
		).toBe(true);
	});

	it("returns false otherwise", () => {
		expect(
			shouldRefocusComposer({
				wasStreaming: false,
				isStreaming: false,
			}),
		).toBe(false);
		expect(
			shouldRefocusComposer({
				wasStreaming: true,
				isStreaming: true,
			}),
		).toBe(false);
	});
});

describe("resolveComposerStatusHint", () => {
	it("returns streaming detail before any idle hint", () => {
		expect(
			resolveComposerStatusHint({
				recording: false,
				isStreaming: true,
				queuedPromptCount: 2,
				loadingThreadMessages: false,
			}),
		).toBe("Streaming response... 2 queued");
	});

	it("returns the sync status while thread history is loading", () => {
		expect(
			resolveComposerStatusHint({
				recording: false,
				isStreaming: false,
				queuedPromptCount: 0,
				loadingThreadMessages: true,
			}),
		).toBe("Syncing session history...");
	});

	it("omits the idle keyboard hint", () => {
		expect(
			resolveComposerStatusHint({
				recording: false,
				isStreaming: false,
				queuedPromptCount: 0,
				loadingThreadMessages: false,
			}),
		).toBeNull();
	});
});
