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

	test("extracts streamed image attachments", () => {
		const parsed = parseStreamEvents({
			event: "on_chat_model_stream",
			run_id: "img-run-1",
			data: {
				chunk: {
					content: [
						{
							type: "output_image",
							image_url: "https://cdn.example.com/desktop-image.png",
						},
					],
				},
			},
		});

		expect(parsed.attachmentEvents).toHaveLength(1);
		expect(parsed.attachmentEvents[0]).toMatchObject({
			kind: "image",
			dataUrl: "https://cdn.example.com/desktop-image.png",
			messageId: "img-run-1",
		});
	});

	test("does not replay prior image attachments from chain input history", () => {
		const parsed = parseStreamEvents({
			event: "on_chain_end",
			run_id: "desktop-chain-image-1",
			data: {
				output: {},
				input: {
					messages: [
						{ type: "human", content: "new prompt" },
						{
							type: "ai",
							id: "desktop-ai-old-image",
							content: [
								{
									type: "output_image",
									image_url: "https://cdn.example.com/desktop-old.png",
								},
							],
						},
					],
				},
			},
		});

		expect(parsed.textEvents).toHaveLength(0);
		expect(parsed.attachmentEvents).toHaveLength(0);
		expect(parsed.toolEvents).toHaveLength(0);
	});

	test("does not re-emit image attachments present in both chain input and output", () => {
		const parsed = parseStreamEvents({
			event: "on_chain_end",
			run_id: "desktop-chain-image-2",
			data: {
				input: {
					messages: [
						{
							type: "ai",
							id: "desktop-ai-old-image-shared",
							content: [
								{
									type: "output_image",
									image_url: "https://cdn.example.com/desktop-shared.png",
								},
							],
						},
					],
				},
				output: {
					messages: [
						{
							type: "ai",
							id: "desktop-ai-old-image-shared",
							content: [
								{
									type: "output_image",
									image_url: "https://cdn.example.com/desktop-shared.png",
								},
							],
						},
					],
				},
			},
		});

		expect(parsed.textEvents).toHaveLength(0);
		expect(parsed.attachmentEvents).toHaveLength(0);
		expect(parsed.toolEvents).toHaveLength(0);
	});

	test("does not emit stale image when stream snapshot ends with a new user turn", () => {
		const parsed = parseStreamEvents({
			event: "on_chain_stream",
			run_id: "desktop-chain-image-3",
			data: {
				output: {
					messages: [
						{ type: "human", content: "first prompt" },
						{
							type: "ai",
							id: "desktop-ai-first-image",
							content: [
								{
									type: "output_image",
									image_url: "https://cdn.example.com/desktop-first.png",
								},
							],
						},
						{ type: "human", content: "second prompt" },
					],
				},
			},
		});

		expect(parsed.textEvents).toHaveLength(0);
		expect(parsed.attachmentEvents).toHaveLength(0);
		expect(parsed.toolEvents).toHaveLength(0);
	});

	test("extracts model failure text from after_model chain-end input messages", () => {
		const parsed = parseStreamEvents({
			event: "on_chain_end",
			name: "todoListMiddleware.after_model",
			run_id: "chain-run-err-1",
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
								id: "desktop-ai-error-1",
								content:
									"Model call failed after 3 attempts with Error: xAI image generation failed: Prompt too long",
							},
						},
					],
				},
			},
		});

		expect(parsed.textEvents).toHaveLength(1);
		expect(parsed.textEvents[0]).toMatchObject({
			text: "Model call failed after 3 attempts with Error: xAI image generation failed: Prompt too long",
			messageId: "desktop-ai-error-1",
			isDelta: true,
		});
	});

	test("extracts model failure text from command wrapper output updates", () => {
		const parsed = parseStreamEvents({
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
									type: "constructor",
									id: ["langchain_core", "messages", "AIMessage"],
									kwargs: {
										id: "desktop-ai-error-2",
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
		});

		expect(parsed.textEvents).toHaveLength(1);
		expect(parsed.textEvents[0]).toMatchObject({
			text: "Model call failed after 3 attempts with Error: xAI image generation failed: Prompt len is larger than the maximum allowed length which is 8000",
			messageId: "desktop-ai-error-2",
			isDelta: true,
		});
	});
});
