/**
 * Parse LangGraph streaming chunks for display
 *
 * LangGraph/DeepAgents streams chunks in various formats:
 * - AIMessage updates with content deltas
 * - Tool calls
 * - Tool results
 * - State updates
 *
 * This parser extracts displayable text for CLI output.
 */

import { v4 as uuidv4 } from "uuid";

export interface ParsedChunk {
	text?: string;
	messageId?: string;
	isDelta?: boolean;
	toolCall?: {
		id: string; // Unique identifier for tracking tool lifecycle
		name: string;
		args?: any;
	};
	toolResult?: {
		id: string; // Links to toolCall.id
		output: any;
		error?: string;
	};
	type: "text" | "tool" | "tool-result" | "state" | "unknown";
	timestamp: number;
}

interface MessageEntry {
	message: any;
	meta?: any;
	sourceKey?: string;
	index?: number;
}

interface NormalizedToolCall {
	id: string;
	name: string;
	args: Record<string, any>;
}

/**
 * Parse a raw LangGraph stream chunk
 * Returns an array of parsed chunks to handle multiple messages/events in a single chunk
 */
export function parseStreamChunk(chunk: any): ParsedChunk[] {
	if (!chunk || typeof chunk !== "object") {
		return [];
	}

	const tokenChunk = parseStreamEventChunk(chunk);
	if (tokenChunk) {
		return [tokenChunk];
	}

	const messageEntries = normalizeMessagesFromChunk(chunk);

	const results: ParsedChunk[] = [];

	if (messageEntries.length > 0) {
		for (const entry of messageEntries) {
			const msg = entry.message;
			const messageType = getMessageType(msg);
			const normalizedType = messageType ? messageType.toLowerCase() : "";
			const isAIMessage = isAIMessageType(normalizedType);
			const isToolMessage = isToolMessageType(normalizedType);
			const messageId = isAIMessage ? getMessageId(msg, entry) : undefined;

			if (isAIMessage) {
				const toolCalls = extractToolCalls(msg, messageId);
				if (toolCalls.length > 0) {
					for (const toolCall of toolCalls) {
						results.push({
							messageId,
							toolCall: toolCall,
							type: "tool",
							timestamp: Date.now(),
						});
					}
				}

				const text = extractTextContent(msg);
				if (text) {
					results.push({
						messageId,
						text,
						isDelta: isMessageDelta(msg, normalizedType),
						type: "text",
						timestamp: Date.now(),
					});
				}
			}

			if (isToolMessage) {
				const toolResult = extractToolResult(msg);
				if (toolResult) {
					results.push({
						toolResult,
						type: "tool-result",
						timestamp: Date.now(),
					});
				}
			}
		}
	}

	// Return early if we found results
	if (results.length > 0) {
		return results;
	}

	// Handle direct message format
	if (chunk.content) {
		if (typeof chunk.content === "string") {
			return [
				{
					text: chunk.content,
					type: "text",
					timestamp: Date.now(),
				},
			];
		}
	}

	// Handle tool calls at top level
	if (chunk.tool_calls && Array.isArray(chunk.tool_calls)) {
		const toolResults: ParsedChunk[] = [];
		for (const toolCall of chunk.tool_calls) {
			const normalized = normalizeToolCall(toolCall);
			if (!normalized) continue;
			toolResults.push({
				toolCall: normalized,
				type: "tool",
				timestamp: Date.now(),
			});
		}
		if (toolResults.length > 0) {
			return toolResults;
		}
	}

	// Handle state updates (informational) - return empty array to ignore
	if (chunk.next || chunk.metadata) {
		return [];
	}

	// Unknown chunk type - return empty array
	return [];
}

function parseStreamEventChunk(chunk: any): ParsedChunk | null {
	if (!chunk || typeof chunk !== "object") return null;
	if (typeof chunk.event !== "string") return null;

	if (chunk.event === "on_chat_model_stream") {
		const messageChunk = chunk.data?.chunk ?? chunk.data?.message;
		const text = extractTextContent(messageChunk);
		if (!text) return null;

		return {
			messageId: typeof chunk.run_id === "string" ? chunk.run_id : undefined,
			text,
			isDelta: true,
			type: "text",
			timestamp: Date.now(),
		};
	}

	if (chunk.event === "on_llm_stream") {
		const llmChunk = chunk.data?.chunk;
		let text: string | undefined;
		if (typeof llmChunk === "string") {
			text = llmChunk;
		} else if (typeof llmChunk?.text === "string") {
			text = llmChunk.text;
		}

		if (!text) return null;

		return {
			messageId: typeof chunk.run_id === "string" ? chunk.run_id : undefined,
			text,
			isDelta: true,
			type: "text",
			timestamp: Date.now(),
		};
	}

	if (chunk.event === "on_tool_start") {
		const toolName = typeof chunk.name === "string" ? chunk.name : "tool";
		const toolId = typeof chunk.run_id === "string" ? chunk.run_id : uuidv4();
		const args = normalizeToolArgs(chunk.data?.input);

		return {
			toolCall: {
				id: toolId,
				name: toolName,
				args,
			},
			type: "tool",
			timestamp: Date.now(),
		};
	}

	if (chunk.event === "on_tool_end") {
		const toolId = typeof chunk.run_id === "string" ? chunk.run_id : undefined;
		if (!toolId) return null;

		return {
			toolResult: {
				id: toolId,
				output: chunk.data?.output ?? "",
				error: chunk.data?.error,
			},
			type: "tool-result",
			timestamp: Date.now(),
		};
	}

	return null;
}

function normalizeMessagesFromChunk(chunk: any): MessageEntry[] {
	if (Array.isArray(chunk) && chunk.length >= 3 && chunk[1] === "messages") {
		return normalizeMessagesPayload(chunk[2], String(chunk[0] ?? "messages"));
	}

	const entries: MessageEntry[] = [];

	if (Array.isArray(chunk.messages)) {
		for (const [index, message] of chunk.messages.entries()) {
			entries.push({ message, sourceKey: "messages", index });
		}
	}

	if (typeof chunk === "object") {
		for (const [key, value] of Object.entries(chunk)) {
			const messages = (value as any)?.messages;
			if (Array.isArray(messages)) {
				for (const [index, message] of messages.entries()) {
					entries.push({ message, sourceKey: key, index });
				}
			}
		}
	}

	return entries;
}

function normalizeMessagesPayload(
	payload: any,
	sourceKey?: string,
): MessageEntry[] {
	if (!Array.isArray(payload) || payload.length === 0) {
		return [];
	}

	// Most common shape: [message, metadata]
	if (payload.length === 2 && !Array.isArray(payload[0])) {
		return [{ message: payload[0], meta: payload[1], sourceKey, index: 0 }];
	}

	// Some implementations may emit [[message, metadata], ...]
	if (Array.isArray(payload[0])) {
		return payload
			.map((entry: any, index: number) => {
				if (!Array.isArray(entry)) return undefined;
				return {
					message: entry[0],
					meta: entry[1],
					sourceKey,
					index,
				} as MessageEntry;
			})
			.filter(Boolean) as MessageEntry[];
	}

	return [{ message: payload[0], sourceKey, index: 0 }];
}

function getMessageType(msg: any): string | undefined {
	if (!msg) return undefined;
	if (typeof msg._getType === "function") return msg._getType();
	if (typeof msg.getType === "function") return msg.getType();
	if (typeof msg.type === "string") return msg.type;

	if (Array.isArray(msg.id) && msg.id.length > 0) {
		return String(msg.id[msg.id.length - 1]);
	}
	if (Array.isArray(msg.lc_id) && msg.lc_id.length > 0) {
		return String(msg.lc_id[msg.lc_id.length - 1]);
	}

	const constructorName =
		typeof msg.constructor?.name === "string" ? msg.constructor.name : "";
	if (constructorName && constructorName !== "Object") {
		return constructorName;
	}

	return undefined;
}

function isAIMessageType(normalizedType: string): boolean {
	return (
		normalizedType === "ai" ||
		normalizedType === "assistant" ||
		normalizedType === "aimessage" ||
		normalizedType === "aimessagechunk"
	);
}

function isToolMessageType(normalizedType: string): boolean {
	return (
		normalizedType === "tool" ||
		normalizedType === "toolmessage" ||
		normalizedType === "toolmessagechunk"
	);
}

function isMessageDelta(msg: any, normalizedType: string): boolean {
	if (normalizedType.includes("chunk")) return true;

	const idParts = Array.isArray(msg?.id) ? msg.id : [];
	if (
		idParts.some((part: any) => String(part).toLowerCase().includes("chunk"))
	) {
		return true;
	}

	const lcIdParts = Array.isArray(msg?.lc_id) ? msg.lc_id : [];
	if (
		lcIdParts.some((part: any) => String(part).toLowerCase().includes("chunk"))
	) {
		return true;
	}

	const constructorName =
		typeof msg?.constructor?.name === "string" ? msg.constructor.name : "";
	return constructorName.toLowerCase().includes("chunk");
}

function getMessageId(msg: any, entry: MessageEntry): string | undefined {
	if (typeof msg?.id === "string") return msg.id;
	if (typeof msg?.kwargs?.id === "string") return msg.kwargs.id;
	if (typeof msg?.additional_kwargs?.id === "string")
		return msg.additional_kwargs.id;
	if (typeof msg?.lc_kwargs?.id === "string") return msg.lc_kwargs.id;
	if (typeof entry.meta?.id === "string") return entry.meta.id;

	const fallbackParts: string[] = [];
	if (entry.meta && typeof entry.meta === "object") {
		if (entry.meta.langgraph_node) {
			fallbackParts.push(String(entry.meta.langgraph_node));
		}
		if (entry.meta.langgraph_step !== undefined) {
			fallbackParts.push(String(entry.meta.langgraph_step));
		}
	}

	if (fallbackParts.length === 0 && entry.sourceKey) {
		fallbackParts.push(entry.sourceKey);
	}
	if (entry.index !== undefined) {
		fallbackParts.push(String(entry.index));
	}

	return fallbackParts.length > 0 ? fallbackParts.join(":") : undefined;
}

function extractTextContent(msg: any): string | undefined {
	const content = msg?.content ?? msg?.kwargs?.content ?? msg?.additional_kwargs?.content;

	if (typeof content === "string") {
		return content.length > 0 ? content : undefined;
	}

	if (Array.isArray(content)) {
		const textBlocks = content
			.filter((block: any) => block?.type === "text" && block.text)
			.map((block: any) => block.text);
		if (textBlocks.length > 0) {
			return textBlocks.join("");
		}
	}

	return undefined;
}

function extractToolCalls(
	msg: any,
	messageId?: string,
): NormalizedToolCall[] {
	const calls: any[] = [];

	const toolCalls =
		msg?.tool_calls ?? msg?.kwargs?.tool_calls ?? msg?.additional_kwargs?.tool_calls;
	if (Array.isArray(toolCalls)) {
		calls.push(...toolCalls);
	}

	const toolCallChunks =
		msg?.tool_call_chunks ??
		msg?.kwargs?.tool_call_chunks ??
		msg?.additional_kwargs?.tool_call_chunks;
	if (Array.isArray(toolCallChunks)) {
		calls.push(...toolCallChunks);
	}

	return calls
		.map((call: any) => normalizeToolCall(call, messageId))
		.filter(Boolean) as NormalizedToolCall[];
}

function normalizeToolCall(
	toolCall: any,
	messageId?: string,
): NormalizedToolCall | undefined {
	if (!toolCall) return undefined;

	const name = toolCall.name || toolCall.function?.name;
	if (!name) return undefined;

	const index =
		typeof toolCall.index === "number" ? toolCall.index : undefined;
	const id =
		toolCall.id ||
		(index !== undefined && messageId
			? `${messageId}:${index}`
			: undefined) ||
		(messageId ? `${messageId}:${uuidv4()}` : uuidv4());

	return {
		id,
		name,
		args: normalizeToolArgs(toolCall.args ?? toolCall.function?.arguments),
	};
}

function normalizeToolArgs(args: any): Record<string, any> {
	if (!args) return {};

	if (typeof args === "string") {
		try {
			const parsed = JSON.parse(args);
			if (parsed && typeof parsed === "object") {
				return parsed;
			}
		} catch {
			return { raw: args };
		}
		return { raw: args };
	}

	if (typeof args === "object") {
		return args as Record<string, any>;
	}

	return { value: args };
}

function extractToolResult(msg: any): {
	id: string;
	output: any;
	error?: string;
} | null {
	const toolCallId =
		msg?.tool_call_id ?? msg?.kwargs?.tool_call_id ?? msg?.additional_kwargs?.tool_call_id;
	if (!toolCallId) return null;

	return {
		id: toolCallId,
		output: msg?.content ?? msg?.kwargs?.content ?? "",
		error: msg?.kwargs?.error ?? msg?.additional_kwargs?.error,
	};
}

/**
 * Format parsed chunk for CLI display
 */
export function formatParsedChunk(parsed: ParsedChunk): string | null {
	switch (parsed.type) {
		case "text":
			return parsed.text || null;

		case "tool":
			if (parsed.toolCall) {
				const argsStr = parsed.toolCall.args
					? ` ${JSON.stringify(parsed.toolCall.args)}`
					: "";
				return `\n🔧 Using tool: ${parsed.toolCall.name}${argsStr}\n`;
			}
			return null;

		case "state":
			// Silent state updates
			return null;

		case "unknown":
			// Don't display unknown chunks
			return null;

		default:
			return null;
	}
}

/**
 * Process a stream chunk and return displayable text
 * Returns null if nothing should be displayed
 */
export function processStreamChunk(chunk: any): string | null {
	const parsedArray = parseStreamChunk(chunk);
	if (!parsedArray || parsedArray.length === 0) {
		return null;
	}
	// Format all parsed chunks and join them
	const formatted = parsedArray
		.map((parsed) => formatParsedChunk(parsed))
		.filter((text) => text !== null)
		.join("");
	return formatted.length > 0 ? formatted : null;
}
