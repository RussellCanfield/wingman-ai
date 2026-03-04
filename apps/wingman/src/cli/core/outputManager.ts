import { EventEmitter } from "node:events";
import type { OutputMode, OutputEvent } from "../types.js";
import { getLogFilePath } from "../../logger.js";

export class OutputManager extends EventEmitter {
	private mode: OutputMode;

	constructor(mode: OutputMode = "interactive") {
		super();
		this.mode = mode;
	}

	/**
	 * Detect output mode based on TTY status
	 * If stdout is a TTY, use interactive mode
	 * Otherwise (pipe, redirect, etc.), use JSON mode
	 */
	static detectMode(): OutputMode {
		return process.stdout.isTTY ? "interactive" : "json";
	}

	/**
	 * Get the current output mode
	 */
	getMode(): OutputMode {
		return this.mode;
	}

	/**
	 * Emit an output event
	 * In JSON mode: writes to stdout as single-line JSON
	 * In interactive mode: emits event for Ink components to handle
	 */
	emitEvent(event: OutputEvent): void {
		if (this.mode === "json") {
			process.stdout.write(`${JSON.stringify(event)}\n`);
		} else {
			// Emit for Ink components to listen to
			this.emit("output-event", event);
		}
	}

	/**
	 * Emit a log event
	 */
	emitLog(
		level: "debug" | "info" | "warn" | "error",
		message: string,
		args?: any[],
	): void {
		this.emitEvent({
			type: "log",
			level,
			message,
			timestamp: new Date().toISOString(),
			args,
		});
	}

	/**
	 * Emit agent start event
	 */
	emitAgentStart(agent: string, prompt: string): void {
		this.emitEvent({
			type: "agent-start",
			agent,
			prompt,
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * Emit agent stream chunk
	 * Forwards raw chunks from deepagents/LangGraph for client-side interpretation
	 */
	emitAgentStream(
		chunk: any,
		tokenUsage?: {
			inputTokens: number;
			outputTokens: number;
			totalTokens: number;
		},
		estimatedContextTokens?: number,
	): void {
		this.emitEvent({
			type: "agent-stream",
			chunk,
			...(tokenUsage ? { tokenUsage } : {}),
			...(typeof estimatedContextTokens === "number" &&
			Number.isFinite(estimatedContextTokens) &&
			estimatedContextTokens > 0
				? { estimatedContextTokens: Math.round(estimatedContextTokens) }
				: {}),
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * Emit explicit context summarization start signal
	 */
	emitContextSummarizing(): void {
		this.emitEvent({
			type: "context-summarizing",
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * Emit explicit context summarization signal
	 */
	emitContextSummarized(payload: {
		inputTokens: number;
		peakInputTokens: number;
		thresholdTokens: number;
	}): void {
		this.emitEvent({
			type: "context-summarized",
			inputTokens: payload.inputTokens,
			peakInputTokens: payload.peakInputTokens,
			thresholdTokens: payload.thresholdTokens,
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * Emit agent completion
	 */
	emitAgentComplete(result: any): void {
		this.emitEvent({
			type: "agent-complete",
			result,
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * Emit agent error
	 */
	emitAgentError(error: Error | string): void {
		const errorMsg = error instanceof Error ? error.message : error;
		const stack = error instanceof Error ? error.stack : undefined;
		const logFile = getLogFilePath();

		this.emitEvent({
			type: "agent-error",
			error: errorMsg,
			stack,
			logFile,
			timestamp: new Date().toISOString(),
		});
	}
}
