import { describe, expect, test } from "vitest";
import { shouldShowTranscriptionFire } from "./overlayEffects.js";

describe("shouldShowTranscriptionFire", () => {
	test("shows effect only while recording", () => {
		expect(shouldShowTranscriptionFire(true)).toBe(true);
		expect(shouldShowTranscriptionFire(false)).toBe(false);
	});
});
