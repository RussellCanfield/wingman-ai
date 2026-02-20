import { describe, expect, it } from "vitest";
import {
	detectAssistantFailureMessage,
	parseWingmanJsonOutput,
} from "../bench/adapters/helpers";

describe("parseWingmanJsonOutput", () => {
	it("extracts assistant text from ai-role messages", () => {
		const output = JSON.stringify({
			type: "agent-complete",
			result: {
				messages: [
					{ role: "user", content: "ignore" },
					{ role: "ai", content: "hello from ai role" },
				],
			},
		});

		const parsed = parseWingmanJsonOutput(output);
		expect(parsed.assistantText).toBe("hello from ai role");
	});

	it("extracts assistant text from serialized AIMessage payloads", () => {
		const output = JSON.stringify({
			type: "agent-complete",
			result: {
				messages: [
					{
						id: ["langchain_core", "messages", "AIMessage"],
						kwargs: {
							content: [{ type: "text", text: "hello from kwargs content" }],
						},
					},
				],
			},
		});

		const parsed = parseWingmanJsonOutput(output);
		expect(parsed.assistantText).toBe("hello from kwargs content");
	});
});

describe("detectAssistantFailureMessage", () => {
	it("detects provider bad request failures", () => {
		const error = detectAssistantFailureMessage(
			"Model call failed after 3 attempts with BadRequestError: 400 status code (no body)",
		);
		expect(error).toContain("BadRequestError");
	});

	it("ignores normal assistant content", () => {
		expect(
			detectAssistantFailureMessage(
				'{"state_analysis":"ok","commands":[],"is_task_complete":false}',
			),
		).toBeUndefined();
	});
});
