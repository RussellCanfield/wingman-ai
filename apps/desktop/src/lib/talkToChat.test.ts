import { describe, expect, test } from "vitest";
import { resolveTalkStopTranscript } from "./talkToChat.js";

describe("resolveTalkStopTranscript", () => {
	test("returns null when recording is starting", () => {
		expect(resolveTalkStopTranscript(false, "hello")).toBeNull();
	});

	test("returns trimmed transcript when stopping with content", () => {
		expect(resolveTalkStopTranscript(true, "  hello world  ")).toBe("hello world");
	});

	test("returns null when stopping with empty transcript", () => {
		expect(resolveTalkStopTranscript(true, "   ")).toBeNull();
	});
});

