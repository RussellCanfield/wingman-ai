import type { AdapterTokenUsage } from "../types.js";

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
}

function getNumber(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function extractTextFromContent(content: unknown): string {
	if (typeof content === "string") {
		return content;
	}
	if (!Array.isArray(content)) {
		return "";
	}

	const parts: string[] = [];
	for (const part of content) {
		if (!part || typeof part !== "object") {
			continue;
		}
		const typedPart = part as Record<string, unknown>;
		if (typeof typedPart.text === "string") {
			parts.push(typedPart.text);
		}
	}
	return parts.join("");
}

function normalizeRoleLike(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}
	const normalized = value.trim().toLowerCase();
	return normalized.length > 0 ? normalized : null;
}

function isAssistantLikeMessage(message: Record<string, unknown>): boolean {
	const role = normalizeRoleLike(message.role);
	if (role === "assistant" || role === "ai") {
		return true;
	}
	const type = normalizeRoleLike(message.type);
	if (type === "assistant" || type === "ai") {
		return true;
	}
	const id = Array.isArray(message.id)
		? message.id.filter((part): part is string => typeof part === "string")
		: [];
	return id.some((part) => part.toLowerCase().includes("aimessage"));
}

function extractTextFromMessage(message: Record<string, unknown>): string {
	const direct = extractTextFromContent(message.content);
	if (direct) {
		return direct;
	}
	const kwargs = asRecord(message.kwargs);
	if (kwargs) {
		const kwargsContent = extractTextFromContent(kwargs.content);
		if (kwargsContent) {
			return kwargsContent;
		}
		if (typeof kwargs.text === "string") {
			return kwargs.text;
		}
	}
	const data = asRecord(message.data);
	if (data) {
		const dataContent = extractTextFromContent(data.content);
		if (dataContent) {
			return dataContent;
		}
		if (typeof data.text === "string") {
			return data.text;
		}
	}
	return "";
}

const ASSISTANT_FAILURE_PATTERNS = [
	/^model call failed/i,
	/\bbadrequesterror\b/i,
	/\bstatus code\s*[45]\d{2}\b/i,
	/\brate limit\b/i,
	/\binsufficient[_\s-]?quota\b/i,
	/\binvalid api key\b/i,
	/\bauthentication\b/i,
];

export function detectAssistantFailureMessage(
	assistantText: string | null | undefined,
): string | undefined {
	const text = String(assistantText || "").trim();
	if (!text) {
		return undefined;
	}
	for (const pattern of ASSISTANT_FAILURE_PATTERNS) {
		if (pattern.test(text)) {
			return text;
		}
	}
	return undefined;
}

function collectTokenUsage(target: AdapterTokenUsage, payload: unknown): void {
	const record = asRecord(payload);
	if (!record) return;

	const directInput =
		getNumber(record.input_tokens) ||
		getNumber(record.inputTokens) ||
		getNumber(record.prompt_tokens) ||
		getNumber(record.promptTokens);
	const directOutput =
		getNumber(record.output_tokens) ||
		getNumber(record.outputTokens) ||
		getNumber(record.completion_tokens) ||
		getNumber(record.completionTokens);
	const directTotal =
		getNumber(record.total_tokens) || getNumber(record.totalTokens);

	if (directInput > 0)
		target.inputTokens = Math.max(target.inputTokens, directInput);
	if (directOutput > 0) {
		target.outputTokens = Math.max(target.outputTokens, directOutput);
	}
	if (directTotal > 0)
		target.totalTokens = Math.max(target.totalTokens, directTotal);

	const nestedCandidates = [
		record.usage,
		record.usage_metadata,
		record.tokenUsage,
		record.response_metadata,
	];

	for (const nested of nestedCandidates) {
		const nestedRecord = asRecord(nested);
		if (!nestedRecord) continue;
		collectTokenUsage(target, nestedRecord);
	}
}

export function parseWingmanJsonOutput(output: string): {
	assistantText: string;
	tokenUsage: AdapterTokenUsage;
	errorMessage?: string;
} {
	const lines = output.split(/\r?\n/).map((line) => line.trim());
	const assistantParts: string[] = [];
	let errorMessage: string | undefined;
	const tokenUsage: AdapterTokenUsage = {
		inputTokens: 0,
		outputTokens: 0,
		totalTokens: 0,
	};

	for (const line of lines) {
		if (!line) continue;
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			continue;
		}

		const event = asRecord(parsed);
		if (!event || typeof event.type !== "string") {
			continue;
		}

		if (event.type === "agent-error" && typeof event.error === "string") {
			errorMessage = event.error;
		}

		if (event.type === "agent-complete") {
			const result = asRecord(event.result);
			const messages = Array.isArray(result?.messages)
				? (result?.messages as unknown[])
				: [];
			for (const message of messages) {
				const messageRecord = asRecord(message);
				if (!messageRecord || !isAssistantLikeMessage(messageRecord)) {
					continue;
				}
				const text = extractTextFromMessage(messageRecord);
				if (text) {
					assistantParts.push(text);
				}
			}
			collectTokenUsage(tokenUsage, result);
		}

		if (event.type === "agent-stream") {
			const chunk = asRecord(event.chunk);
			if (!chunk) {
				continue;
			}
			collectTokenUsage(tokenUsage, chunk);
			const data = asRecord(chunk.data);
			const streamChunk = asRecord(data?.chunk) || asRecord(data?.message);
			if (!streamChunk) {
				continue;
			}
			const text =
				typeof streamChunk.text === "string"
					? streamChunk.text
					: extractTextFromContent(streamChunk.content);
			if (text) {
				assistantParts.push(text);
			}
		}
	}

	if (tokenUsage.totalTokens === 0) {
		tokenUsage.totalTokens = tokenUsage.inputTokens + tokenUsage.outputTokens;
	}

	return {
		assistantText: assistantParts.join("").trim(),
		tokenUsage,
		errorMessage,
	};
}
