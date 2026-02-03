import { describe, expect, it } from "vitest";
import { shouldAutoSpeak } from "./voiceAuto";

describe("shouldAutoSpeak", () => {
	it("returns false when auto is disabled", () => {
		const spoken = new Set<string>();
		expect(
			shouldAutoSpeak({
				text: "Hello",
				enabled: false,
				spokenMessages: spoken,
				requestId: "req-1",
			}),
		).toBe(false);
	});

	it("returns false when text is empty", () => {
		const spoken = new Set<string>();
		expect(
			shouldAutoSpeak({
				text: "   ",
				enabled: true,
				spokenMessages: spoken,
				requestId: "req-1",
			}),
		).toBe(false);
	});

	it("returns false when message was already spoken", () => {
		const spoken = new Set<string>(["req-1"]);
		expect(
			shouldAutoSpeak({
				text: "Hello",
				enabled: true,
				spokenMessages: spoken,
				requestId: "req-1",
			}),
		).toBe(false);
	});

	it("returns true when enabled with new spoken message", () => {
		const spoken = new Set<string>();
		expect(
			shouldAutoSpeak({
				text: "Hello",
				enabled: true,
				spokenMessages: spoken,
				requestId: "req-2",
			}),
		).toBe(true);
	});
});
