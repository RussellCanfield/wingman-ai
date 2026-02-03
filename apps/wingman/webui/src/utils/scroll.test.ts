import { describe, expect, it } from "vitest";
import { shouldAutoScroll } from "./scroll";

describe("shouldAutoScroll", () => {
	it("returns true when within the default threshold", () => {
		const result = shouldAutoScroll({
			scrollHeight: 1000,
			scrollTop: 900,
			clientHeight: 80,
		});
		expect(result).toBe(true);
	});

	it("returns false when beyond the threshold", () => {
		const result = shouldAutoScroll({
			scrollHeight: 1000,
			scrollTop: 800,
			clientHeight: 100,
		});
		expect(result).toBe(false);
	});

	it("respects a custom threshold", () => {
		const result = shouldAutoScroll({
			scrollHeight: 1000,
			scrollTop: 880,
			clientHeight: 100,
			threshold: 10,
		});
		expect(result).toBe(false);
	});
});
