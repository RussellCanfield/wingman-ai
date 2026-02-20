#!/usr/bin/env bun

import { createInterface } from "node:readline";
import {
	detectAssistantFailureMessage,
	parseWingmanJsonOutput,
} from "../src/bench/adapters/helpers.js";
import { AgentInvoker } from "../src/cli/core/agentInvoker.js";
import { OutputManager } from "../src/cli/core/outputManager.js";
import { createLogger, type LogLevel } from "../src/logger.js";

interface BridgeRequest {
	id: string;
	type: "ping" | "invoke";
	prompt?: string;
}

interface BridgeResponse {
	id: string;
	ok: boolean;
	error?: string;
	assistantText?: string;
	tokenUsage?: {
		inputTokens: number;
		outputTokens: number;
		totalTokens: number;
	};
}

interface BridgeOptions {
	agent: string;
	model?: string;
	workspace: string;
	configDir: string;
	workdir?: string;
	logLevel: LogLevel;
}

function normalizeWingmanModel(model: string | undefined): string | undefined {
	if (!model) return undefined;
	const trimmed = model.trim();
	if (!trimmed) return undefined;
	if (trimmed.includes(":")) return trimmed;
	const slash = trimmed.indexOf("/");
	if (slash > 0 && slash < trimmed.length - 1) {
		return `${trimmed.slice(0, slash)}:${trimmed.slice(slash + 1)}`;
	}
	return trimmed;
}

function parseArgs(argv: string[]): BridgeOptions {
	const args = argv.slice(2);
	const options: BridgeOptions = {
		agent: "coding",
		workspace: process.cwd(),
		configDir: ".wingman",
		logLevel: "silent",
	};

	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === "--agent" && args[i + 1]) {
			options.agent = args[i + 1];
			i += 1;
			continue;
		}
		if (arg.startsWith("--agent=")) {
			options.agent = arg.slice("--agent=".length);
			continue;
		}
		if (arg === "--model" && args[i + 1]) {
			options.model = args[i + 1];
			i += 1;
			continue;
		}
		if (arg.startsWith("--model=")) {
			options.model = arg.slice("--model=".length);
			continue;
		}
		if (arg === "--workspace" && args[i + 1]) {
			options.workspace = args[i + 1];
			i += 1;
			continue;
		}
		if (arg.startsWith("--workspace=")) {
			options.workspace = arg.slice("--workspace=".length);
			continue;
		}
		if (arg === "--config-dir" && args[i + 1]) {
			options.configDir = args[i + 1];
			i += 1;
			continue;
		}
		if (arg.startsWith("--config-dir=")) {
			options.configDir = arg.slice("--config-dir=".length);
			continue;
		}
		if (arg === "--workdir" && args[i + 1]) {
			options.workdir = args[i + 1];
			i += 1;
			continue;
		}
		if (arg.startsWith("--workdir=")) {
			options.workdir = arg.slice("--workdir=".length);
			continue;
		}
		if (arg === "--log-level" && args[i + 1]) {
			options.logLevel = args[i + 1] as LogLevel;
			i += 1;
			continue;
		}
		if (arg.startsWith("--log-level=")) {
			options.logLevel = arg.slice("--log-level=".length) as LogLevel;
		}
	}

	return options;
}

function writeResponse(response: BridgeResponse): void {
	process.stdout.write(`${JSON.stringify(response)}\n`);
}

function extractAssistantTextFromResult(result: unknown): string {
	if (!result || typeof result !== "object") return "";
	const record = result as Record<string, unknown>;
	const messages = Array.isArray(record.messages) ? record.messages : [];
	const chunks: string[] = [];

	const getNormalized = (value: unknown): string | null => {
		if (typeof value !== "string") return null;
		const normalized = value.trim().toLowerCase();
		return normalized.length > 0 ? normalized : null;
	};

	const isAssistantLikeMessage = (typed: Record<string, unknown>): boolean => {
		const role = getNormalized(typed.role);
		if (role === "assistant" || role === "ai") {
			return true;
		}
		const type = getNormalized(typed.type);
		if (type === "assistant" || type === "ai") {
			return true;
		}
		const id = Array.isArray(typed.id)
			? typed.id.filter((part): part is string => typeof part === "string")
			: [];
		return id.some((part) => part.toLowerCase().includes("aimessage"));
	};

	const pushContentText = (content: unknown): boolean => {
		if (typeof content === "string") {
			const text = content.trim();
			if (text) {
				chunks.push(text);
				return true;
			}
			return false;
		}
		if (!Array.isArray(content)) return false;
		let found = false;
		for (const part of content) {
			if (!part || typeof part !== "object") continue;
			const text = (part as Record<string, unknown>).text;
			if (typeof text === "string" && text.trim()) {
				chunks.push(text.trim());
				found = true;
			}
		}
		return found;
	};

	for (const message of messages) {
		if (!message || typeof message !== "object") continue;
		const typed = message as Record<string, unknown>;
		if (!isAssistantLikeMessage(typed)) continue;
		if (pushContentText(typed.content)) continue;
		const kwargs =
			typed.kwargs && typeof typed.kwargs === "object"
				? (typed.kwargs as Record<string, unknown>)
				: null;
		if (kwargs && pushContentText(kwargs.content)) {
			continue;
		}
		const data =
			typed.data && typeof typed.data === "object"
				? (typed.data as Record<string, unknown>)
				: null;
		if (data && pushContentText(data.content)) {
			continue;
		}
	}
	return chunks.join("").trim();
}

async function main(): Promise<void> {
	const options = parseArgs(process.argv);
	const outputManager = new OutputManager("interactive");
	const logger = createLogger(options.logLevel);
	const invoker = new AgentInvoker({
		workspace: options.workspace,
		configDir: options.configDir,
		workdir: options.workdir || null,
		outputManager,
		logger,
	});

	const rl = createInterface({
		input: process.stdin,
		crlfDelay: Number.POSITIVE_INFINITY,
	});

	for await (const line of rl) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		let request: BridgeRequest;
		try {
			request = JSON.parse(trimmed) as BridgeRequest;
		} catch {
			writeResponse({
				id: "unknown",
				ok: false,
				error: "Invalid JSON request.",
			});
			continue;
		}

		if (!request.id || !request.type) {
			writeResponse({
				id: request.id || "unknown",
				ok: false,
				error: "Request must include id and type.",
			});
			continue;
		}

		if (request.type === "ping") {
			writeResponse({ id: request.id, ok: true });
			continue;
		}

		if (request.type !== "invoke") {
			writeResponse({
				id: request.id,
				ok: false,
				error: `Unsupported request type: ${request.type}`,
			});
			continue;
		}

		if (!request.prompt || request.prompt.trim().length === 0) {
			writeResponse({
				id: request.id,
				ok: false,
				error: "Invoke request requires non-empty prompt.",
			});
			continue;
		}

		const events: unknown[] = [];
		const onEvent = (event: unknown) => {
			events.push(event);
		};
		outputManager.on("output-event", onEvent);

		try {
			const invokeResult = await invoker.invokeAgent(
				options.agent,
				request.prompt,
				undefined,
				undefined,
				{
					modelOverride: normalizeWingmanModel(options.model),
				},
			);

			const eventOutput = events
				.map((event) => JSON.stringify(event))
				.join("\n");
			const parsed = parseWingmanJsonOutput(eventOutput);
			const assistantText =
				parsed.assistantText || extractAssistantTextFromResult(invokeResult);
			const assistantFailure =
				parsed.errorMessage || detectAssistantFailureMessage(assistantText);

			if (assistantFailure) {
				writeResponse({
					id: request.id,
					ok: false,
					error: assistantFailure,
				});
				continue;
			}

			if (!assistantText) {
				writeResponse({
					id: request.id,
					ok: false,
					error: "Agent returned empty assistant response.",
				});
				continue;
			}

			writeResponse({
				id: request.id,
				ok: true,
				assistantText,
				tokenUsage: parsed.tokenUsage,
			});
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: String(error || "Unknown error");
			writeResponse({
				id: request.id,
				ok: false,
				error: message,
			});
		} finally {
			outputManager.off("output-event", onEvent);
		}
	}
}

await main();
