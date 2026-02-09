import { describe, expect, it } from "vitest";
import { computeComposerTextareaLayout, shouldRefocusComposer } from "./composer";

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
