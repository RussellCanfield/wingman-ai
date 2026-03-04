import { describe, expect, it } from "vitest";
import { OutputManager } from "../cli/core/outputManager.js";

describe("OutputManager context summarized events", () => {
	it("emits context-summarizing metadata in interactive mode", () => {
		const outputManager = new OutputManager("interactive");
		const events: Array<Record<string, unknown>> = [];
		outputManager.on("output-event", (event) => {
			events.push(event as unknown as Record<string, unknown>);
		});

		outputManager.emitContextSummarizing();

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			type: "context-summarizing",
		});
		expect(typeof events[0]?.timestamp).toBe("string");
	});

	it("emits context-summarized metadata in interactive mode", () => {
		const outputManager = new OutputManager("interactive");
		const events: Array<Record<string, unknown>> = [];
		outputManager.on("output-event", (event) => {
			events.push(event as unknown as Record<string, unknown>);
		});

		outputManager.emitContextSummarized({
			inputTokens: 5400,
			peakInputTokens: 11200,
			thresholdTokens: 12000,
		});

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			type: "context-summarized",
			inputTokens: 5400,
			peakInputTokens: 11200,
			thresholdTokens: 12000,
		});
		expect(typeof events[0]?.timestamp).toBe("string");
	});
});
