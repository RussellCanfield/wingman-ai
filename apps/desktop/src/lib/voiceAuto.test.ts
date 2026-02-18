import { describe, expect, test } from "vitest";
import { shouldAutoSpeak } from "./voiceAuto.js";

describe("shouldAutoSpeak", () => {
	test("returns false when disabled", () => {
		expect(
			shouldAutoSpeak({
				text: "hello",
				enabled: false,
				spokenMessages: new Set(),
				requestId: "msg-1",
			}),
		).toBe(false);
	});

	test("returns false when message is empty", () => {
		expect(
			shouldAutoSpeak({
				text: "   ",
				enabled: true,
				spokenMessages: new Set(),
				requestId: "msg-1",
			}),
		).toBe(false);
	});

	test("returns false when message was already spoken", () => {
		expect(
			shouldAutoSpeak({
				text: "hello",
				enabled: true,
				spokenMessages: new Set(["msg-1"]),
				requestId: "msg-1",
			}),
		).toBe(false);
	});

	test("returns true for first eligible message", () => {
		expect(
			shouldAutoSpeak({
				text: "hello",
				enabled: true,
				spokenMessages: new Set(),
				requestId: "msg-1",
			}),
		).toBe(true);
	});
});
