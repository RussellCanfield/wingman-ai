import { describe, it, expect } from "vitest";
import { parseStreamEvents } from "./streaming";

describe("parseStreamEvents", () => {
	it("captures chat model stream text with node metadata", () => {
		const chunk = {
			event: "on_chat_model_stream",
			run_id: "run-1",
			data: { chunk: { content: "hello" } },
			metadata: { langgraph_node: "agent" },
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(1);
		expect(result.textEvents[0]).toMatchObject({
			text: "hello",
			messageId: "run-1",
			node: "agent",
			isDelta: true,
		});
	});

	it("parses tuple-based message payloads with langgraph metadata", () => {
		const chunk = [
			"stream-1",
			"messages",
			[
				{ type: "ai", content: "subagent update" },
				{ langgraph_node: "researcher" },
			],
		];

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(1);
		expect(result.textEvents[0].text).toBe("subagent update");
		expect(result.textEvents[0].node).toBe("researcher");
	});

	it("captures tool lifecycle events", () => {
		const chunk = {
			event: "on_tool_start",
			name: "search",
			run_id: "tool-1",
			data: { input: { q: "wingman" } },
		};

		const result = parseStreamEvents(chunk);

		expect(result.toolEvents).toHaveLength(1);
		expect(result.toolEvents[0]).toMatchObject({
			id: "tool-1",
			name: "search",
			status: "running",
		});
	});

	it("extracts UI hints from tool args", () => {
		const chunk = {
			event: "on_tool_start",
			name: "ui_present",
			run_id: "tool-2",
			data: {
				input: {
					location: "Seattle",
					uiOnly: true,
					textFallback: "Seattle: 58°F, Cloudy",
					ui: {
						registry: "webui",
						components: [{ component: "stat_grid", props: { title: "Weather" } }],
					},
				},
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.toolEvents).toHaveLength(1);
		expect(result.toolEvents[0].ui).toMatchObject({
			registry: "webui",
		});
		expect(result.toolEvents[0].uiOnly).toBe(true);
		expect(result.toolEvents[0].textFallback).toBe("Seattle: 58°F, Cloudy");
		expect(result.toolEvents[0].args).toMatchObject({ location: "Seattle" });
	});

	it("extracts UI hints from tool output", () => {
		const chunk = {
			event: "on_tool_end",
			name: "ui_present",
			run_id: "tool-3",
			data: {
				output: {
					temperature: 72,
					ui: {
						registry: "webui",
						components: [{ component: "stat_grid", props: { title: "Weather" } }],
					},
				},
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.toolEvents).toHaveLength(1);
		expect(result.toolEvents[0].ui).toMatchObject({
			registry: "webui",
		});
		expect(result.toolEvents[0].output).toMatchObject({ temperature: 72 });
	});

	it("extracts UI hints from tool output wrapped in kwargs content", () => {
		const chunk = {
			event: "on_tool_end",
			name: "ui_present",
			run_id: "tool-4",
			data: {
				output: {
					kwargs: {
						content: JSON.stringify({
							temperature: 70,
							ui: {
								registry: "webui",
								components: [
									{ component: "stat_grid", props: { title: "Weather" } },
								],
							},
						}),
					},
				},
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.toolEvents).toHaveLength(1);
		expect(result.toolEvents[0].ui).toMatchObject({ registry: "webui" });
		expect(result.toolEvents[0].output).toMatchObject({ temperature: 70 });
	});
});
