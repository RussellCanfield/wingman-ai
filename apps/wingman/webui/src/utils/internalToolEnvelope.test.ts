import { describe, expect, it } from "vitest";
import { sanitizeAssistantDisplayText } from "./internalToolEnvelope";

describe("sanitizeAssistantDisplayText", () => {
	it("strips leaked internal tool envelope text from mixed-language content", () => {
		const input =
			'I\'ve applied both patches; next I\'ll run the updated tests and full build.անոցassistant to=multi_tool_use.parallel մեկնաբանություն json {"tool_uses":[{"recipient_name":"functions.command_execute","parameters":{"command":"bun test packages/adapters/tests/openaiCompatibleClient.test.ts"}}]}';

		const result = sanitizeAssistantDisplayText(input);

		expect(result).toBe(
			"I've applied both patches; next I'll run the updated tests and full build.անոց",
		);
	});

	it("drops chunks that are only internal tool envelope text", () => {
		const input =
			'assistant to=multi_tool_use.parallel commentary json {"tool_uses":[{"recipient_name":"functions.grep","parameters":{"pattern":"x"}}]}';

		const result = sanitizeAssistantDisplayText(input);

		expect(result).toBeUndefined();
	});

	it("keeps normal prose that references function names", () => {
		const input =
			"Use `functions.command_execute` and check the result in the next line.";

		const result = sanitizeAssistantDisplayText(input);

		expect(result).toBe(input);
	});
});
