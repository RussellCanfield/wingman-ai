import { describe, expect, it } from "vitest";
import { parseStreamEvents } from "./streaming";

describe("parseStreamEvents", () => {
	it("captures output_image blocks as attachment events", () => {
		const chunk = {
			event: "on_chat_model_stream",
			run_id: "run-image-1",
			data: {
				chunk: {
					content: [
						{
							type: "output_image",
							image_url: "https://cdn.example.com/generated.png",
						},
					],
				},
			},
			metadata: { langgraph_node: "image-generator" },
		};

		const result = parseStreamEvents(chunk);

		expect(result.attachmentEvents).toHaveLength(1);
		expect(result.attachmentEvents[0]).toMatchObject({
			kind: "image",
			dataUrl: "https://cdn.example.com/generated.png",
			messageId: "run-image-1",
			node: "image-generator",
			isDelta: true,
		});
	});

	it("captures structured image blocks from streamed AI messages", () => {
		const chunk = [
			"stream-images",
			"messages",
			[
				{
					type: "ai",
					content: [
						{ type: "text", text: "Image ready." },
						{
							type: "image",
							source_type: "base64",
							mime_type: "image/png",
							data: "abc123",
						},
					],
				},
				{ langgraph_node: "image-generator" },
			],
		];

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(1);
		expect(result.textEvents[0]?.text).toBe("Image ready.");
		expect(result.attachmentEvents).toHaveLength(1);
		expect(result.attachmentEvents[0]).toMatchObject({
			kind: "image",
			dataUrl: "data:image/png;base64,abc123",
			node: "image-generator",
		});
	});

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

	it("preserves newline-only chat model delta chunks", () => {
		const chunk = {
			event: "on_chat_model_stream",
			run_id: "run-newline",
			data: { chunk: { content: "\n\n" } },
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(1);
		expect(result.textEvents[0]).toMatchObject({
			text: "\n\n",
			messageId: "run-newline",
			isDelta: true,
		});
	});

	it("preserves trailing line returns in chat model delta chunks", () => {
		const chunk = {
			event: "on_chat_model_stream",
			run_id: "run-heading",
			data: { chunk: { content: "## Heading\n" } },
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(1);
		expect(result.textEvents[0]?.text).toBe("## Heading\n");
	});

	it("normalizes return-symbol list separators to newlines", () => {
		const chunk = {
			event: "on_chat_model_stream",
			run_id: "run-list-return-symbol",
			data: {
				chunk: {
					content: [
						{
							type: "text",
							text: "- Item one↵- Item two↵- Item three",
							index: 0,
						},
					],
				},
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(1);
		expect(result.textEvents[0]).toMatchObject({
			messageId: "run-list-return-symbol",
			isDelta: true,
			text: "- Item one\n- Item two\n- Item three",
		});
	});

	it("extracts token usage from on_chat_model_end usage metadata", () => {
		const chunk = {
			event: "on_chat_model_end",
			run_id: "run-usage-1",
			metadata: { langgraph_node: "main" },
			data: {
				output: {
					usage_metadata: {
						input_tokens: 8420,
						output_tokens: 512,
						total_tokens: 8932,
					},
				},
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(0);
		expect(result.toolEvents).toHaveLength(0);
		expect(result.usageEvents).toHaveLength(1);
		expect(result.usageEvents[0]).toMatchObject({
			inputTokens: 8420,
			outputTokens: 512,
			totalTokens: 8932,
			messageId: "run-usage-1",
			node: "main",
		});
	});

	it("extracts token usage from on_llm_end usage payloads", () => {
		const chunk = {
			event: "on_llm_end",
			run_id: "run-usage-2",
			data: {
				output: {
					usage: {
						prompt_tokens: 6400,
						completion_tokens: 400,
						total_tokens: 6800,
					},
				},
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.usageEvents).toHaveLength(1);
		expect(result.usageEvents[0]).toMatchObject({
			inputTokens: 6400,
			outputTokens: 400,
			totalTokens: 6800,
			messageId: "run-usage-2",
		});
	});

	it("extracts token usage from explicit tokenUsage payloads", () => {
		const chunk = {
			tokenUsage: {
				inputTokens: 9300,
				outputTokens: 712,
				totalTokens: 10012,
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.usageEvents).toHaveLength(1);
		expect(result.usageEvents[0]).toMatchObject({
			inputTokens: 9300,
			outputTokens: 712,
			totalTokens: 10012,
		});
	});

	it("attaches estimated context tokens to extracted usage events", () => {
		const chunk = {
			tokenUsage: {
				inputTokens: 9300,
				outputTokens: 712,
				totalTokens: 10012,
			},
			estimatedContextTokens: 8889,
		};

		const result = parseStreamEvents(chunk);

		expect(result.usageEvents).toHaveLength(1);
		expect(result.usageEvents[0]).toMatchObject({
			inputTokens: 9300,
			outputTokens: 712,
			totalTokens: 10012,
			estimatedContextTokens: 8889,
		});
	});

	it("creates a synthetic usage event when only estimated context tokens are present", () => {
		const chunk = {
			estimatedContextTokens: 7777,
		};

		const result = parseStreamEvents(chunk);

		expect(result.usageEvents).toHaveLength(1);
		expect(result.usageEvents[0]).toMatchObject({
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
			estimatedContextTokens: 7777,
		});
	});

	it("ignores on_chain_end text payloads", () => {
		const chunk = {
			event: "on_chain_end",
			run_id: "chain-1",
			data: {
				output: {
					messages: [
						{ type: "human", content: "hello?" },
						{ type: "ai", content: "Hey! How can I help?" },
					],
				},
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(0);
		expect(result.toolEvents).toHaveLength(0);
	});

	it("extracts token usage from on_chain_end output messages", () => {
		const chunk = {
			event: "on_chain_end",
			run_id: "chain-usage-1",
			metadata: { langgraph_node: "orchestrator" },
			data: {
				output: {
					messages: [
						{
							type: "human",
							content: [{ type: "text", text: "Prompt" }],
						},
						{
							id: "assistant-final",
							type: "ai",
							content: [{ type: "text", text: "Final response" }],
							usage_metadata: {
								input_tokens: 8842,
								output_tokens: 611,
								total_tokens: 9453,
							},
						},
					],
				},
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(0);
		expect(result.usageEvents).toHaveLength(1);
		expect(result.usageEvents[0]).toMatchObject({
			inputTokens: 8842,
			outputTokens: 611,
			totalTokens: 9453,
			messageId: "assistant-final",
			node: "orchestrator",
		});
	});

	it("extracts on_chain_end image attachments without replaying text", () => {
		const chunk = {
			event: "on_chain_end",
			run_id: "chain-image-1",
			metadata: { langgraph_node: "image-generator" },
			data: {
				output: {
					messages: [
						{ type: "human", content: "Generate a dragon." },
						{
							type: "ai",
							id: "ai-image-1",
							content: [
								{ type: "text", text: "Generated image." },
								{
									type: "output_image",
									image_url: "https://cdn.example.com/dragon.png",
								},
							],
						},
					],
				},
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(0);
		expect(result.toolEvents).toHaveLength(0);
		expect(result.attachmentEvents).toHaveLength(1);
		expect(result.attachmentEvents[0]).toMatchObject({
			kind: "image",
			dataUrl: "https://cdn.example.com/dragon.png",
			messageId: "ai-image-1",
			node: "image-generator",
			isDelta: false,
		});
	});

	it("does not re-emit historical image attachments from prior AI messages", () => {
		const chunk = {
			event: "on_chain_end",
			run_id: "chain-image-2",
			data: {
				output: {
					messages: [
						{
							type: "ai",
							id: "ai-old-image",
							content: [
								{
									type: "output_image",
									image_url: "https://cdn.example.com/old.png",
								},
							],
						},
						{
							type: "ai",
							id: "ai-latest-text",
							content: [{ type: "text", text: "Done." }],
						},
					],
				},
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(0);
		expect(result.attachmentEvents).toHaveLength(0);
		expect(result.toolEvents).toHaveLength(0);
	});

	it("does not emit prior image attachments from chain input history", () => {
		const chunk = {
			event: "on_chain_end",
			run_id: "chain-image-3",
			data: {
				output: {},
				input: {
					messages: [
						{ type: "human", content: "new prompt" },
						{
							type: "ai",
							id: "ai-old-image-input",
							content: [
								{
									type: "output_image",
									image_url: "https://cdn.example.com/old-input.png",
								},
							],
						},
					],
				},
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(0);
		expect(result.attachmentEvents).toHaveLength(0);
		expect(result.toolEvents).toHaveLength(0);
	});

	it("does not re-emit image attachments that appear in both chain input and output", () => {
		const chunk = {
			event: "on_chain_end",
			run_id: "chain-image-4",
			data: {
				input: {
					messages: [
						{
							type: "ai",
							id: "ai-old-image",
							content: [
								{
									type: "output_image",
									image_url: "https://cdn.example.com/old-shared.png",
								},
							],
						},
					],
				},
				output: {
					messages: [
						{
							type: "ai",
							id: "ai-old-image",
							content: [
								{
									type: "output_image",
									image_url: "https://cdn.example.com/old-shared.png",
								},
							],
						},
						{ type: "human", content: "next prompt" },
					],
				},
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(0);
		expect(result.attachmentEvents).toHaveLength(0);
		expect(result.toolEvents).toHaveLength(0);
	});

	it("emits only new image attachments when output contains both prior and new images", () => {
		const chunk = {
			event: "on_chain_end",
			run_id: "chain-image-5",
			data: {
				input: {
					messages: [
						{
							type: "ai",
							id: "ai-old-image-2",
							content: [
								{
									type: "output_image",
									image_url: "https://cdn.example.com/old-only.png",
								},
							],
						},
					],
				},
				output: {
					messages: [
						{
							type: "ai",
							id: "ai-new-image-2",
							content: [
								{
									type: "output_image",
									image_url: "https://cdn.example.com/old-only.png",
								},
								{
									type: "output_image",
									image_url: "https://cdn.example.com/new-only.png",
								},
							],
						},
					],
				},
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(0);
		expect(result.toolEvents).toHaveLength(0);
		expect(result.attachmentEvents).toHaveLength(1);
		expect(result.attachmentEvents[0]).toMatchObject({
			kind: "image",
			dataUrl: "https://cdn.example.com/new-only.png",
			messageId: "ai-new-image-2",
			isDelta: false,
		});
	});

	it("does not emit stale image when snapshot ends with a new user turn", () => {
		const chunk = {
			event: "on_chain_stream",
			run_id: "chain-image-6",
			data: {
				output: {
					messages: [
						{ type: "human", content: "first prompt" },
						{
							type: "ai",
							id: "ai-first-image",
							content: [
								{
									type: "output_image",
									image_url: "https://cdn.example.com/first.png",
								},
							],
						},
						{ type: "human", content: "second prompt" },
					],
				},
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(0);
		expect(result.attachmentEvents).toHaveLength(0);
		expect(result.toolEvents).toHaveLength(0);
	});

	it("extracts model failure text from after_model chain-end input messages", () => {
		const chunk = {
			event: "on_chain_end",
			name: "todoListMiddleware.after_model",
			run_id: "chain-run-err-1",
			metadata: { langgraph_node: "model" },
			data: {
				output: {},
				input: {
					messages: [
						{
							type: "constructor",
							id: ["langchain_core", "messages", "HumanMessage"],
							kwargs: { content: "Generate an image" },
						},
						{
							type: "constructor",
							id: ["langchain_core", "messages", "AIMessage"],
							kwargs: {
								id: "ai-error-1",
								content:
									"Model call failed after 3 attempts with Error: xAI image generation failed: Prompt too long",
							},
						},
					],
				},
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.toolEvents).toHaveLength(0);
		expect(result.textEvents).toHaveLength(1);
		expect(result.textEvents[0]).toMatchObject({
			text: "Model call failed after 3 attempts with Error: xAI image generation failed: Prompt too long",
			messageId: "ai-error-1",
			node: "model",
			isDelta: true,
		});
	});

	it("extracts model failure text from Command.update.messages wrappers", () => {
		const chunk = {
			event: "on_chain_end",
			run_id: "chain-run-err-2",
			name: "ChannelWrite<branch:to:todoListMiddleware.after_model>",
			data: {
				output: [
					{
						lg_name: "Command",
						update: {
							messages: [
								{
									lc: 1,
									type: "constructor",
									id: ["langchain_core", "messages", "AIMessage"],
									kwargs: {
										id: "ai-error-2",
										content:
											"Model call failed after 3 attempts with Error: xAI image generation failed: Prompt len is larger than the maximum allowed length which is 8000",
									},
								},
							],
						},
					},
				],
				input: {},
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(1);
		expect(result.textEvents[0]).toMatchObject({
			text: "Model call failed after 3 attempts with Error: xAI image generation failed: Prompt len is larger than the maximum allowed length which is 8000",
			messageId: "ai-error-2",
			isDelta: true,
		});
	});

	it("ignores stale model failure text when a later assistant message exists", () => {
		const chunk = {
			event: "on_chain_end",
			run_id: "chain-run-err-stale-1",
			name: "todoListMiddleware.after_model",
			data: {
				input: {
					messages: [
						{ type: "human", content: "Generate an image" },
						{
							type: "ai",
							id: "ai-error-stale-1",
							content:
								"Model call failed after 3 attempts with Error: xAI image generation failed: Prompt too long",
						},
						{
							type: "ai",
							id: "ai-success-stale-1",
							content: "Image created successfully",
						},
					],
				},
			},
		};

		const result = parseStreamEvents(chunk);
		expect(result.textEvents).toHaveLength(0);
	});

	it("ignores model failure text when snapshot has a newer user turn", () => {
		const chunk = {
			event: "on_chain_end",
			run_id: "chain-run-err-stale-2",
			name: "todoListMiddleware.after_model",
			data: {
				input: {
					messages: [
						{ type: "human", content: "First prompt" },
						{
							type: "ai",
							id: "ai-error-stale-2",
							content:
								"Model call failed after 3 attempts with Error: xAI image generation failed: Prompt too long",
						},
						{ type: "human", content: "Second prompt" },
					],
				},
			},
		};

		const result = parseStreamEvents(chunk);
		expect(result.textEvents).toHaveLength(0);
	});

	it("ignores model failure snapshots on on_chain_start events", () => {
		const chunk = {
			event: "on_chain_start",
			run_id: "chain-run-start-1",
			data: {
				input: {
					messages: [
						{
							type: "constructor",
							id: ["langchain_core", "messages", "AIMessage"],
							kwargs: {
								id: "ai-error-start-1",
								content:
									"Model call failed after 3 attempts with Error: xAI image generation failed: Prompt len is larger than the maximum allowed length which is 8000",
							},
						},
					],
				},
			},
		};

		const result = parseStreamEvents(chunk);
		expect(result.textEvents).toHaveLength(0);
	});

	it("does not throw when chain event payload omits input/messages", () => {
		const chunk = {
			event: "on_chain_end",
			run_id: "chain-empty-1",
			name: "ChannelWrite<...>",
			data: {
				output: {},
				input: undefined,
			},
		};

		expect(() => parseStreamEvents(chunk)).not.toThrow();
		const result = parseStreamEvents(chunk);
		expect(result.textEvents).toHaveLength(0);
	});

	it("ignores chat-model stream chunks that are not AI messages", () => {
		const chunk = {
			event: "on_chat_model_stream",
			run_id: "run-human",
			data: {
				chunk: {
					type: "constructor",
					id: ["langchain_core", "messages", "HumanMessageChunk"],
					kwargs: {
						content: [{ type: "text", text: "this should not render" }],
					},
				},
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(0);
		expect(result.toolEvents).toHaveLength(0);
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

	it("strips leaked internal tool envelope text while preserving assistant content", () => {
		const chunk = {
			event: "on_chat_model_stream",
			run_id: "run-leak-1",
			data: {
				chunk: {
					content:
						'I\'ll inspect integration usage first.\nassistant to=multi_tool_use.parallel commentary json {"tool_uses":[{"recipient_name":"functions.read_file","parameters":{"file_path":"./a.ts"}}]}',
				},
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(1);
		expect(result.textEvents[0]?.text).toBe(
			"I'll inspect integration usage first.",
		);
	});

	it("drops chunks that are only leaked internal tool envelopes", () => {
		const chunk = {
			content:
				'assistant to=multi_tool_use.parallel commentary json {"tool_uses":[{"recipient_name":"functions.grep","parameters":{"pattern":"x"}}]}',
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(0);
	});

	it("keeps normal prose that references function names", () => {
		const chunk = {
			content:
				"Use `functions.read_file` for local file access and `functions.grep` for quick search.",
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(1);
		expect(result.textEvents[0]?.text).toContain("functions.read_file");
	});

	it("strips trailing symbol-noise lines from streamed text", () => {
		const chunk = {
			content:
				"I've switched to file-based textures; next I'll run npm run build and confirm output.\n#+#+#+#+#+",
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(1);
		expect(result.textEvents[0]?.text).toBe(
			"I've switched to file-based textures; next I'll run npm run build and confirm output.",
		);
	});

	it("drops chunks that are only symbol noise", () => {
		const chunk = {
			content: "  +#+#+#+#+#+#+  ",
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(0);
	});

	it("ignores lifecycle end events with historical messages", () => {
		const chunk = {
			event: "on_chain_end",
			data: {
				output: {
					messages: [
						{
							type: "human",
							content: [{ type: "text", text: "Prompt" }],
						},
						{
							type: "ai",
							content: [{ type: "text", text: "- Item one\n- Item two" }],
						},
					],
				},
			},
		};

		const result = parseStreamEvents(chunk);

		expect(result.textEvents).toHaveLength(0);
		expect(result.toolEvents).toHaveLength(0);
	});
});
