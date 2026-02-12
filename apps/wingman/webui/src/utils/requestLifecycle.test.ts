import { describe, expect, it } from "vitest";
import { shouldMarkRequestActive } from "./requestLifecycle";

describe("shouldMarkRequestActive", () => {
	it("returns true for active and terminal agent events", () => {
		expect(shouldMarkRequestActive("agent-start")).toBe(true);
		expect(shouldMarkRequestActive("agent-stream")).toBe(true);
		expect(shouldMarkRequestActive("agent-complete")).toBe(true);
		expect(shouldMarkRequestActive("agent-error")).toBe(true);
	});

	it("returns false for queued and session events", () => {
		expect(shouldMarkRequestActive("request-queued")).toBe(false);
		expect(shouldMarkRequestActive("session-message")).toBe(false);
	});

	it("returns false for invalid payload types", () => {
		expect(shouldMarkRequestActive(undefined)).toBe(false);
		expect(shouldMarkRequestActive(null)).toBe(false);
		expect(shouldMarkRequestActive(123)).toBe(false);
		expect(shouldMarkRequestActive({ type: "agent-stream" })).toBe(false);
	});
});
