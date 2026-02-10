import { describe, expect, it } from "vitest";
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
			metadata: { langgraph_node: "researcher" },
		};

		const result = parseStreamEvents(chunk);

		expect(result.toolEvents).toHaveLength(1);
		expect(result.toolEvents[0]).toMatchObject({
			id: "tool-1",
			name: "search",
			node: "researcher",
			runId: "tool-1",
			status: "running",
		});
	});

	it("captures tool error lifecycle events", () => {
		const chunk = {
			event: "on_tool_error",
			name: "grep",
			run_id: "tool-err-1",
			data: {
				error: { message: "Command failed with exit code 1" },
			},
			metadata: { langgraph_node: "implementor" },
		};

		const result = parseStreamEvents(chunk);

		expect(result.toolEvents).toHaveLength(1);
		expect(result.toolEvents[0]).toMatchObject({
			id: "tool-err-1",
			name: "grep",
			node: "implementor",
			runId: "tool-err-1",
			status: "error",
			error: "Command failed with exit code 1",
		});
	});

	it("correlates tool lifecycle when run_id is missing", () => {
		const started = parseStreamEvents({
			event: "on_tool_start",
			name: "command_execute",
			metadata: { langgraph_node: "implementor", langgraph_step: 22 },
			parent_ids: ["task-run-1"],
			data: { input: { command: "bun run test" } },
		});
		const completed = parseStreamEvents({
			event: "on_tool_end",
			name: "command_execute",
			metadata: { langgraph_node: "implementor", langgraph_step: 22 },
			parent_ids: ["task-run-1"],
			data: { output: "ok" },
		});

		expect(started.toolEvents).toHaveLength(1);
		expect(completed.toolEvents).toHaveLength(1);
		expect(started.toolEvents[0].id).toBe(completed.toolEvents[0].id);
		expect(started.toolEvents[0].runId).toBe(completed.toolEvents[0].runId);
		expect(completed.toolEvents[0].status).toBe("completed");
	});

	it("captures tool run ancestry metadata for correlation", () => {
		const chunk = {
			event: "on_tool_start",
			name: "edit_file",
			run_id: "tool-child-1",
			parent_ids: ["task-run-1", "root-run-1"],
			data: {
				input: { file_path: "/tmp/a.ts", old_string: "a", new_string: "b" },
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.toolEvents).toHaveLength(1);
		expect(result.toolEvents[0]).toMatchObject({
			id: "tool-child-1",
			runId: "tool-child-1",
			parentRunIds: ["task-run-1", "root-run-1"],
		});
	});

	it("extracts node from langgraph tags when direct metadata is absent", () => {
		const chunk = {
			event: "on_tool_start",
			name: "search",
			run_id: "tool-tags-1",
			data: { input: { q: "wingman" } },
			metadata: { tags: ["trace", "langgraph_node:reviewer"] },
		};

		const result = parseStreamEvents(chunk);

		expect(result.toolEvents).toHaveLength(1);
		expect(result.toolEvents[0]).toMatchObject({
			id: "tool-tags-1",
			node: "reviewer",
		});
	});

	it("extracts node from checkpoint namespace metadata", () => {
		const chunk = {
			event: "on_chat_model_stream",
			run_id: "run-namespace-1",
			data: { chunk: { content: "hello from worker" } },
			metadata: { langgraph_checkpoint_ns: "__pregel_pull/researcher:step-3" },
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(1);
		expect(result.textEvents[0].node).toBe("researcher");
	});

	it("captures tool node metadata from message payloads", () => {
		const chunk = [
			"stream-tools",
			"messages",
			[
				{
					type: "ai",
					tool_calls: [{ id: "tool-msg-1", name: "task", args: { work: "x" } }],
				},
				{ langgraph_node: "implementor" },
			],
		];

		const result = parseStreamEvents(chunk);

		expect(result.toolEvents).toHaveLength(1);
		expect(result.toolEvents[0]).toMatchObject({
			id: "tool-msg-1",
			name: "task",
			node: "implementor",
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
						components: [
							{ component: "stat_grid", props: { title: "Weather" } },
						],
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
			metadata: { langgraph_node: "composer" },
			data: {
				output: {
					temperature: 72,
					ui: {
						registry: "webui",
						components: [
							{ component: "stat_grid", props: { title: "Weather" } },
						],
					},
				},
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.toolEvents).toHaveLength(1);
		expect(result.toolEvents[0].ui).toMatchObject({
			registry: "webui",
		});
		expect(result.toolEvents[0].node).toBe("composer");
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

	it("unwraps gateway agent-stream wrappers", () => {
		const chunk = {
			type: "agent-event",
			data: {
				type: "agent-stream",
				chunk: { content: "nested stream hello" },
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(1);
		expect(result.textEvents[0].text).toBe("nested stream hello");
	});
});
