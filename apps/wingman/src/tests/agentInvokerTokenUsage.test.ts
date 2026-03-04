import { describe, expect, it } from "vitest";
import {
	estimateContextTokensFromChunk,
	extractTokenUsageSnapshot,
	mergeTokenUsageSnapshots,
} from "../cli/core/agentInvoker.js";

describe("agentInvoker token usage extraction", () => {
	it("extracts usage from nested usage_metadata payloads", () => {
		const usage = extractTokenUsageSnapshot({
			event: "on_chat_model_end",
			data: {
				output: {
					usage_metadata: {
						input_tokens: 8420,
						output_tokens: 512,
						total_tokens: 8932,
					},
				},
			},
		});

		expect(usage).toEqual({
			inputTokens: 8420,
			outputTokens: 512,
			totalTokens: 8932,
		});
	});

	it("extracts usage from explicit tokenUsage payloads", () => {
		const usage = extractTokenUsageSnapshot({
			tokenUsage: {
				inputTokens: 9300,
				outputTokens: 712,
				totalTokens: 10012,
			},
		});

		expect(usage).toEqual({
			inputTokens: 9300,
			outputTokens: 712,
			totalTokens: 10012,
		});
	});

	it("merges snapshots by keeping the highest observed counters", () => {
		const merged = mergeTokenUsageSnapshots(
			{
				inputTokens: 4000,
				outputTokens: 300,
				totalTokens: 4300,
			},
			{
				inputTokens: 6200,
				outputTokens: 280,
				totalTokens: 6480,
			},
		);

		expect(merged).toEqual({
			inputTokens: 6200,
			outputTokens: 300,
			totalTokens: 6480,
		});
	});

	it("estimates context tokens from stream chunks containing message arrays", () => {
		const toolCalls = [
			{ id: "call-1", name: "search", args: { q: "wingman" } },
		];
		const estimate = estimateContextTokensFromChunk({
			event: "on_chain_start",
			data: {
				input: {
					messages: [
						{
							id: ["langchain_core", "messages", "HumanMessage"],
							kwargs: { content: "Hello there" },
						},
						{
							id: ["langchain_core", "messages", "AIMessage"],
							kwargs: {
								content: "I can help with that.",
								tool_calls: toolCalls,
							},
						},
						{
							id: ["langchain_core", "messages", "ToolMessage"],
							kwargs: {
								content: "Search complete",
								tool_call_id: "call-1",
							},
						},
					],
				},
			},
		});

		const expectedChars =
			"Hello there".length +
			"I can help with that.".length +
			JSON.stringify(toolCalls).length +
			"Search complete".length +
			"call-1".length;
		expect(estimate).toBe(Math.ceil(expectedChars / 4));
	});

	it("returns null when no message arrays are present", () => {
		expect(
			estimateContextTokensFromChunk({
				event: "on_tool_start",
				name: "read_file",
				data: { input: { path: "/tmp/file.txt" } },
			}),
		).toBeNull();
	});
});
