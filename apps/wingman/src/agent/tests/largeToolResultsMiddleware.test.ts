import { ToolMessage } from "@langchain/core/messages";
import { Command, isCommand } from "@langchain/langgraph";
import { describe, expect, it, vi } from "vitest";
import { createLargeToolResultsMiddleware } from "../middleware/large-tool-results.js";

const buildToolMessage = (content: string, toolCallId = "call.1") =>
	new ToolMessage({
		content,
		tool_call_id: toolCallId,
		name: "code_search",
	});

describe("large tool results middleware", () => {
	it("passes through tool results below the eviction threshold", async () => {
		const backend = { write: vi.fn() };
		const middleware = createLargeToolResultsMiddleware({
			backend: () => backend,
			toolTokenLimitBeforeEvict: 100,
		});
		const wrapToolCall = middleware.wrapToolCall;
		if (!wrapToolCall) {
			throw new Error("wrapToolCall middleware was not defined");
		}

		const message = buildToolMessage("small result");
		const result = await wrapToolCall(
			{ toolCall: { id: "call.1", name: "code_search" } } as any,
			async () => message,
		);

		expect(result).toBe(message);
		expect(backend.write).not.toHaveBeenCalled();
	});

	it("skips built-in filesystem tools that already manage large outputs", async () => {
		const backend = { write: vi.fn() };
		const middleware = createLargeToolResultsMiddleware({
			backend: () => backend,
			toolTokenLimitBeforeEvict: 1,
		});
		const wrapToolCall = middleware.wrapToolCall;
		if (!wrapToolCall) {
			throw new Error("wrapToolCall middleware was not defined");
		}

		const message = new ToolMessage({
			content: "this would normally be evicted",
			tool_call_id: "call.2",
			name: "read_file",
		});
		const result = await wrapToolCall(
			{ toolCall: { id: "call.2", name: "read_file" } } as any,
			async () => message,
		);

		expect(result).toBe(message);
		expect(backend.write).not.toHaveBeenCalled();
	});

	it("offloads oversized tool messages to the agent filesystem", async () => {
		const backend = {
			write: vi.fn().mockResolvedValue({
				path: "/large_tool_results/call_3.txt",
				filesUpdate: {
					"/large_tool_results/call_3.txt": {
						content: ["abcdefghij"],
						created_at: "2026-03-06T00:00:00.000Z",
						modified_at: "2026-03-06T00:00:00.000Z",
					},
				},
			}),
		};
		const middleware = createLargeToolResultsMiddleware({
			backend: () => backend,
			toolTokenLimitBeforeEvict: 1,
		});
		const wrapToolCall = middleware.wrapToolCall;
		if (!wrapToolCall) {
			throw new Error("wrapToolCall middleware was not defined");
		}

		const result = await wrapToolCall(
			{ toolCall: { id: "call.3", name: "code_search" } } as any,
			async () => buildToolMessage("abcdefghij", "call.3"),
		);

		expect(isCommand(result)).toBe(true);
		const update = (result as Command).update as {
			files?: Record<string, unknown>;
			messages?: unknown[];
		};
		expect(update.files).toEqual(
			expect.objectContaining({
				"/large_tool_results/call_3.txt": expect.any(Object),
			}),
		);
		expect(update.messages).toHaveLength(1);
		expect(ToolMessage.isInstance(update.messages?.[0])).toBe(true);
		expect(String((update.messages?.[0] as ToolMessage).content)).toContain(
			"/large_tool_results/call_3.txt",
		);
		expect(backend.write).toHaveBeenCalledWith(
			"/large_tool_results/call_3.txt",
			"abcdefghij",
		);
	});

	it("falls back to a preview-only replacement when persistence fails", async () => {
		const backend = {
			write: vi.fn().mockResolvedValue({
				error: "disk full",
			}),
		};
		const middleware = createLargeToolResultsMiddleware({
			backend: () => backend,
			toolTokenLimitBeforeEvict: 1,
		});
		const wrapToolCall = middleware.wrapToolCall;
		if (!wrapToolCall) {
			throw new Error("wrapToolCall middleware was not defined");
		}

		const commandResult = new Command({
			update: {
				files: {
					"/existing.txt": { content: ["ok"] },
				},
				messages: [buildToolMessage("abcdefghij", "call.4")],
			},
		});
		const result = await wrapToolCall(
			{ toolCall: { id: "call.4", name: "code_search" } } as any,
			async () => commandResult,
		);

		expect(isCommand(result)).toBe(true);
		const update = (result as Command).update as {
			files?: Record<string, unknown>;
			messages?: unknown[];
		};
		expect(update.files).toEqual({
			"/existing.txt": { content: ["ok"] },
		});
		expect(update.messages).toHaveLength(1);
		expect(ToolMessage.isInstance(update.messages?.[0])).toBe(true);
		expect(String((update.messages?.[0] as ToolMessage).content)).toContain(
			"could not be persisted",
		);
		expect(backend.write).toHaveBeenCalledWith(
			"/large_tool_results/call_4.txt",
			"abcdefghij",
		);
	});
});
