import { describe, expect, it } from "vitest";
import { appendAssistantErrorFeedback } from "./assistantError";

describe("appendAssistantErrorFeedback", () => {
	it("adds an error line when assistant content already exists", () => {
		const result = appendAssistantErrorFeedback(
			"Partial response",
			"Provider timeout",
		);

		expect(result).toContain("Partial response");
		expect(result).toContain("Error: Provider timeout");
	});

	it("does not duplicate error details when already present", () => {
		const existing = "Partial response\n\nError: Provider timeout";
		const result = appendAssistantErrorFeedback(existing, "Provider timeout");

		expect(result).toBe(existing);
	});

	it("does not append feedback for cancel-style errors", () => {
		const result = appendAssistantErrorFeedback(
			"Partial response",
			"Request cancelled by user",
		);

		expect(result).toBe("Partial response");
	});
});
