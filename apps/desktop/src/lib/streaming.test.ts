import { describe, expect, test } from "vitest";
import { parseStreamEvents } from "./streaming.js";

describe("parseStreamEvents", () => {
	test("extracts content from simple chunk", () => {
		const parsed = parseStreamEvents({ content: "Hello" });
		expect(parsed.textEvents).toHaveLength(1);
		expect(parsed.textEvents[0].text).toBe("Hello");
	});

	test("extracts tool-start events", () => {
		const parsed = parseStreamEvents({
			event: "on_tool_start",
			run_id: "run-1",
			name: "search",
			data: { input: { query: "wingman" } },
		});

		expect(parsed.toolEvents).toHaveLength(1);
		expect(parsed.toolEvents[0].status).toBe("running");
		expect(parsed.toolEvents[0].name).toBe("search");
	});

	test("extracts streamed chat model delta", () => {
		const parsed = parseStreamEvents({
			event: "on_llm_stream",
			run_id: "req-1",
			data: { chunk: { text: "A" } },
		});

		expect(parsed.textEvents).toHaveLength(1);
		expect(parsed.textEvents[0].isDelta).toBe(true);
		expect(parsed.textEvents[0].messageId).toBe("req-1");
	});

	test("extracts content from gateway agent-stream wrapper", () => {
		const parsed = parseStreamEvents({
			type: "agent-stream",
			chunk: { content: "Hello from stream" },
		});

		expect(parsed.textEvents).toHaveLength(1);
		expect(parsed.textEvents[0].text).toBe("Hello from stream");
	});

	test("extracts content from nested agent-event wrapper", () => {
		const parsed = parseStreamEvents({
			type: "agent-event",
			data: {
				type: "agent-stream",
				chunk: { content: "Nested hello" },
			},
		});

		expect(parsed.textEvents).toHaveLength(1);
		expect(parsed.textEvents[0].text).toBe("Nested hello");
	});
});
