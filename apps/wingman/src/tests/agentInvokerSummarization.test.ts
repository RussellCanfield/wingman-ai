import { describe, expect, it } from "vitest";
import { validateConfig } from "../cli/config/schema.js";
import {
	chunkHasAssistantText,
	configureDeepAgentSummarizationMiddleware,
	detectStreamErrorMessage,
	detectToolEventContext,
	evaluateStreamingCompletion,
	isRootLangGraphTerminalEvent,
	resolveHumanInTheLoopSettings,
	resolveModelRetryMiddlewareSettings,
	resolveSummarizationMiddlewareSettings,
	resolveToolRetryMiddlewareSettings,
	selectStreamingFallbackText,
	trackRootLangGraphRunId,
} from "../cli/core/agentInvoker.js";

const parseConfig = (input: unknown) => {
	const result = validateConfig(input);
	if (!result.success || !result.data) {
		throw new Error(result.error || "Expected config validation to succeed");
	}
	return result.data;
};

describe("resolveSummarizationMiddlewareSettings", () => {
	it("returns default summarization settings from config defaults", () => {
		const config = parseConfig({});
		expect(resolveSummarizationMiddlewareSettings(config)).toEqual({
			maxTokensBeforeSummary: 12000,
			messagesToKeep: 8,
		});
	});

	it("returns null when summarization is disabled", () => {
		const config = parseConfig({
			summarization: {
				enabled: false,
			},
		});
		expect(resolveSummarizationMiddlewareSettings(config)).toBeNull();
	});

	it("returns custom summarization settings when configured", () => {
		const config = parseConfig({
			summarization: {
				enabled: true,
				maxTokensBeforeSummary: 20000,
				messagesToKeep: 10,
			},
		});
		expect(resolveSummarizationMiddlewareSettings(config)).toEqual({
			maxTokensBeforeSummary: 20000,
			messagesToKeep: 10,
		});
	});
});

describe("configureDeepAgentSummarizationMiddleware", () => {
	it("replaces built-in summarization middleware with configured settings", () => {
		const agent = {
			options: {
				middleware: [
					{ name: "todoListMiddleware" },
					{ name: "SummarizationMiddleware", marker: "old" },
				],
			},
		};

		configureDeepAgentSummarizationMiddleware(
			agent,
			{ maxTokensBeforeSummary: 9000, messagesToKeep: 5 },
			"openai:gpt-4o-mini",
		);

		expect(agent.options.middleware).toHaveLength(2);
		expect(agent.options.middleware[1]?.name).toBe("SummarizationMiddleware");
		expect(agent.options.middleware[1]?.marker).toBeUndefined();
	});

	it("removes built-in summarization middleware when disabled", () => {
		const agent = {
			options: {
				middleware: [
					{ name: "todoListMiddleware" },
					{ name: "SummarizationMiddleware" },
					{ name: "patchToolCallsMiddleware" },
				],
			},
		};

		configureDeepAgentSummarizationMiddleware(agent, null);

		expect(
			agent.options.middleware.map((m: { name: string }) => m.name),
		).toEqual(["todoListMiddleware", "patchToolCallsMiddleware"]);
	});
});

describe("resolveModelRetryMiddlewareSettings", () => {
	it("returns default retry settings when config defaults are used", () => {
		const config = parseConfig({});
		expect(resolveModelRetryMiddlewareSettings(config)).toEqual({
			maxRetries: 2,
			backoffFactor: 2,
			initialDelayMs: 1000,
			maxDelayMs: 60000,
			jitter: true,
			onFailure: "continue",
		});
	});

	it("returns configured retry settings when enabled", () => {
		const config = parseConfig({
			modelRetry: {
				enabled: true,
				maxRetries: 3,
				backoffFactor: 1.5,
				initialDelayMs: 250,
				maxDelayMs: 5000,
				jitter: false,
				onFailure: "error",
			},
		});
		expect(resolveModelRetryMiddlewareSettings(config)).toEqual({
			maxRetries: 3,
			backoffFactor: 1.5,
			initialDelayMs: 250,
			maxDelayMs: 5000,
			jitter: false,
			onFailure: "error",
		});
	});
});

describe("resolveToolRetryMiddlewareSettings", () => {
	it("returns null by default", () => {
		const config = parseConfig({});
		expect(resolveToolRetryMiddlewareSettings(config)).toBeNull();
	});

	it("returns configured retry settings and tool filter when enabled", () => {
		const config = parseConfig({
			toolRetry: {
				enabled: true,
				maxRetries: 4,
				backoffFactor: 2,
				initialDelayMs: 500,
				maxDelayMs: 10000,
				jitter: true,
				onFailure: "continue",
				tools: ["internet_search", "web_crawler"],
			},
		});
		expect(resolveToolRetryMiddlewareSettings(config)).toEqual({
			maxRetries: 4,
			backoffFactor: 2,
			initialDelayMs: 500,
			maxDelayMs: 10000,
			jitter: true,
			onFailure: "continue",
			tools: ["internet_search", "web_crawler"],
		});
	});
});

describe("resolveHumanInTheLoopSettings", () => {
	it("returns null by default", () => {
		const config = parseConfig({});
		expect(resolveHumanInTheLoopSettings(config)).toBeNull();
	});

	it("returns null when enabled but no tool policy is defined", () => {
		const config = parseConfig({
			humanInTheLoop: {
				enabled: true,
				interruptOn: {},
			},
		});
		expect(resolveHumanInTheLoopSettings(config)).toBeNull();
	});

	it("returns interrupt map when enabled with tool policies", () => {
		const config = parseConfig({
			humanInTheLoop: {
				enabled: true,
				interruptOn: {
					command_execute: {
						allowedDecisions: ["approve", "reject"],
						description: "Command execution requires approval",
					},
					internet_search: false,
				},
			},
		});
		expect(resolveHumanInTheLoopSettings(config)).toEqual({
			interruptOn: {
				command_execute: {
					allowedDecisions: ["approve", "reject"],
					description: "Command execution requires approval",
				},
				internet_search: false,
			},
		});
	});
});

describe("detectToolEventContext", () => {
	it("extracts tool context for tool start events", () => {
		const detected = detectToolEventContext({
			event: "on_tool_start",
			name: "glob",
		});
		expect(detected).toEqual({
			event: "on_tool_start",
			toolName: "glob",
		});
	});

	it("extracts tool context for tool error events", () => {
		const detected = detectToolEventContext({
			event: "on_tool_error",
			name: "grep",
		});
		expect(detected).toEqual({
			event: "on_tool_error",
			toolName: "grep",
		});
	});

	it("returns null for non-tool events", () => {
		const detected = detectToolEventContext({
			event: "on_chat_model_stream",
			data: { chunk: { text: "hello" } },
		});
		expect(detected).toBeNull();
	});
});

describe("chunkHasAssistantText", () => {
	it("detects text in on_chat_model_stream chunks", () => {
		expect(
			chunkHasAssistantText({
				event: "on_chat_model_stream",
				data: { chunk: { content: [{ type: "text", text: "hello" }] } },
			}),
		).toBe(true);
	});

	it("detects text in on_llm_stream chunks", () => {
		expect(
			chunkHasAssistantText({
				event: "on_llm_stream",
				data: { chunk: { text: "delta" } },
			}),
		).toBe(true);
	});

	it("returns false when chunk has no assistant text", () => {
		expect(
			chunkHasAssistantText({
				event: "on_tool_start",
				name: "glob",
			}),
		).toBe(false);
	});
});

describe("selectStreamingFallbackText", () => {
	it("returns assistant text introduced during the current invocation", () => {
		const selected = selectStreamingFallbackText(
			[
				{
					role: "assistant",
					content: "stale message",
				},
			],
			[
				{
					role: "assistant",
					content: "stale message",
				},
				{
					role: "assistant",
					content: "fresh fallback",
				},
			],
		);
		expect(selected).toBe("fresh fallback");
	});

	it("returns undefined when no new assistant text is introduced", () => {
		const selected = selectStreamingFallbackText(
			[
				{
					role: "assistant",
					content: "existing response",
				},
			],
			[
				{
					role: "user",
					content: "not assistant",
				},
				{
					role: "assistant",
					content: "existing response",
				},
			],
		);
		expect(selected).toBeUndefined();
	});

	it("handles repeated assistant messages by count", () => {
		const selected = selectStreamingFallbackText(
			[
				{
					role: "assistant",
					content: "repeat",
				},
			],
			[
				{
					role: "assistant",
					content: "repeat",
				},
				{
					role: "assistant",
					content: "repeat",
				},
			],
		);
		expect(selected).toBe("repeat");
	});
});

describe("detectStreamErrorMessage", () => {
	it("extracts non-tool stream error messages", () => {
		const detected = detectStreamErrorMessage({
			event: "on_chat_model_error",
			data: {
				error: {
					message: "Model call failed after retries",
				},
			},
		});
		expect(detected).toBe("Model call failed after retries");
	});

	it("ignores tool errors and non-error events", () => {
		expect(
			detectStreamErrorMessage({
				event: "on_tool_error",
				data: { error: "tool failed" },
			}),
		).toBeUndefined();
		expect(
			detectStreamErrorMessage({
				event: "on_chat_model_stream",
				data: { chunk: { text: "hello" } },
			}),
		).toBeUndefined();
	});
});

describe("evaluateStreamingCompletion", () => {
	it("blocks with stream_error when no assistant text and stream error exists", () => {
		const result = evaluateStreamingCompletion({
			sawAssistantText: false,
			fallbackText: undefined,
			streamErrorMessage: "provider timeout",
		});

		expect(result).toEqual({
			status: "blocked",
			reason: "stream_error",
			message: "Model call failed: provider timeout",
		});
	});

	it("blocks with empty_stream_response when no text or fallback is present", () => {
		const result = evaluateStreamingCompletion({
			sawAssistantText: false,
			fallbackText: undefined,
			streamErrorMessage: undefined,
		});

		expect(result).toEqual({
			status: "blocked",
			reason: "empty_stream_response",
			message:
				"Model completed without a response. Check provider logs for request errors.",
		});
	});

	it("returns ok when assistant text exists", () => {
		const result = evaluateStreamingCompletion({
			sawAssistantText: true,
			fallbackText: undefined,
			streamErrorMessage: undefined,
		});

		expect(result).toEqual({ status: "ok" });
	});
});

describe("LangGraph lifecycle termination", () => {
	it("tracks root LangGraph run id from parentless on_chain_start", () => {
		const rootRunId = trackRootLangGraphRunId(undefined, {
			event: "on_chain_start",
			name: "LangGraph",
			run_id: "root-run",
			parent_ids: [],
		});
		expect(rootRunId).toBe("root-run");
	});

	it("ignores non-root or non-LangGraph start events", () => {
		const nestedRunId = trackRootLangGraphRunId(undefined, {
			event: "on_chain_start",
			name: "LangGraph",
			run_id: "child-run",
			parent_ids: ["root-run"],
		});
		expect(nestedRunId).toBeUndefined();

		const otherChainRunId = trackRootLangGraphRunId(undefined, {
			event: "on_chain_start",
			name: "CustomChain",
			run_id: "other-run",
			parent_ids: [],
		});
		expect(otherChainRunId).toBeUndefined();
	});

	it("detects terminal root LangGraph on_chain_end by run id", () => {
		expect(
			isRootLangGraphTerminalEvent(
				{
					event: "on_chain_end",
					name: "LangGraph",
					run_id: "root-run",
					parent_ids: [],
				},
				"root-run",
			),
		).toBe(true);
	});

	it("does not treat nested, mismatched, or non-LangGraph chain end as terminal", () => {
		expect(
			isRootLangGraphTerminalEvent(
				{
					event: "on_chain_end",
					name: "LangGraph",
					run_id: "child-run",
					parent_ids: ["root-run"],
				},
				"root-run",
			),
		).toBe(false);
		expect(
			isRootLangGraphTerminalEvent(
				{
					event: "on_chain_end",
					name: "LangGraph",
					run_id: "other-run",
					parent_ids: [],
				},
				"root-run",
			),
		).toBe(false);
		expect(
			isRootLangGraphTerminalEvent(
				{
					event: "on_chain_end",
					name: "CustomChain",
					run_id: "root-run",
					parent_ids: [],
				},
				"root-run",
			),
		).toBe(false);
		expect(
			isRootLangGraphTerminalEvent(
				{
					event: "on_chain_end",
					name: "LangGraph",
					run_id: "root-run",
					parent_ids: [],
				},
				undefined,
			),
		).toBe(false);
	});
});
