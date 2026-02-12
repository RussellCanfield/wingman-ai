import { describe, expect, it } from "vitest";
import { mergeAssistantStreamText } from "./assistantStream";

describe("mergeAssistantStreamText", () => {
	it("appends incoming chunks", () => {
		expect(mergeAssistantStreamText("Hello", " world")).toBe("Hello world");
	});

	it("returns existing content when incoming text is empty", () => {
		expect(mergeAssistantStreamText("Current", "")).toBe("Current");
	});

	it("uses incoming content when no existing text is present", () => {
		expect(mergeAssistantStreamText("", "- Item one\n- Item two")).toBe(
			"- Item one\n- Item two",
		);
	});

	it("appends overlapping chunks exactly as received", () => {
		let output = mergeAssistantStreamText("", "Done -");
		output = mergeAssistantStreamText(output, " - I");
		output = mergeAssistantStreamText(output, " I generated a");
		expect(output).toBe("Done - - I I generated a");
	});

	it("appends overlapping markdown list chunks exactly as received", () => {
		let output = mergeAssistantStreamText("", "- Item one\n- Item two");
		output = mergeAssistantStreamText(output, " - Item two\n- Item three");
		expect(output).toBe("- Item one\n- Item two - Item two\n- Item three");
	});
});
