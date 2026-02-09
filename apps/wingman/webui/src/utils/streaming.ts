import type { UiRenderSpec } from "../types";

export type ParsedTextEvent = {
	text: string;
	messageId?: string;
	node?: string;
	isDelta?: boolean;
};

export type ParsedStreamEvent = {
	textEvents: ParsedTextEvent[];
	toolEvents: Array<{
		id: string;
		name: string;
		node?: string;
		args?: Record<string, any>;
		status: "running" | "completed" | "error";
		output?: any;
		ui?: UiRenderSpec;
		uiOnly?: boolean;
		textFallback?: string;
		error?: string;
		timestamp: number;
	}>;
};

type MessageEntry = {
	message: any;
	meta?: any;
	sourceKey?: string;
	index?: number;
};

type NormalizedToolCall = {
	id: string;
	name: string;
	args: Record<string, any>;
};

export function parseStreamEvents(chunk: any): ParsedStreamEvent {
	const textEvents: ParsedTextEvent[] = [];
	const toolEvents: ParsedStreamEvent["toolEvents"] = [];
	if (!chunk || typeof chunk !== "object") return { textEvents, toolEvents };

	const eventParsed = parseStreamEventChunk(chunk);
	if (eventParsed) return eventParsed;

	const messageEntries = normalizeMessagesFromChunk(chunk);
	if (messageEntries.length > 0) {
		for (const entry of messageEntries) {
			const msg = entry.message;
			const messageType = getMessageType(msg);
			const normalizedType = messageType ? messageType.toLowerCase() : "";
			const role = getMessageRole(msg);
			const isAIMessage =
				isAIMessageType(normalizedType) || role === "assistant";
			const isToolMessage = isToolMessageType(normalizedType);
			if (role === "user" && !isAIMessage && !isToolMessage) continue;

				if (isAIMessage) {
					const messageId = getMessageId(msg, entry);
					const node = extractNodeLabel(msg, entry.meta);
					const toolCalls = extractToolCalls(msg, messageId);
					for (const toolCall of toolCalls) {
					const { ui, uiOnly, textFallback, data: args } = splitUiPayload(
						toolCall.args,
					);
						toolEvents.push({
							id: toolCall.id,
							name: toolCall.name,
							node,
							args,
							ui,
							uiOnly,
							textFallback,
						status: "running",
						timestamp: Date.now(),
					});
				}

				const text = extractTextContent(msg);
				if (text) {
					textEvents.push({
						text,
						messageId,
						node,
						isDelta: isMessageDelta(msg, normalizedType),
					});
				}
			}

				if (isToolMessage) {
					const toolResult = extractToolResult(msg);
					if (toolResult) {
						const node = extractNodeLabel(msg, entry.meta);
						const { ui, uiOnly, textFallback, data: output } = splitUiPayload(
							toolResult.output,
						);
						toolEvents.push({
							id: toolResult.id,
							name: toolResult.name || "tool",
							node,
							status: toolResult.error ? "error" : "completed",
							output,
							ui,
						uiOnly,
						textFallback,
						error: toolResult.error,
						timestamp: Date.now(),
					});
				}
			}
		}
		if (textEvents.length > 0 || toolEvents.length > 0) {
			return { textEvents, toolEvents };
		}
	}

	if (typeof chunk.content === "string") {
		textEvents.push({ text: chunk.content });
	}

		if (chunk.tool_calls && Array.isArray(chunk.tool_calls)) {
			for (const toolCall of chunk.tool_calls) {
				const normalized = normalizeToolCall(toolCall);
				if (!normalized) continue;
				const { ui, uiOnly, textFallback, data: args } = splitUiPayload(normalized.args);
				toolEvents.push({
					id: normalized.id,
					name: normalized.name,
					node: extractEventNode(chunk),
					args,
					ui,
					uiOnly,
					textFallback,
				status: "running",
				timestamp: Date.now(),
			});
		}
	}

	return { textEvents, toolEvents };
}

function parseStreamEventChunk(chunk: any): ParsedStreamEvent | null {
	if (!chunk || typeof chunk !== "object") return null;
	if (typeof chunk.event !== "string") return null;

	if (chunk.event === "on_chat_model_stream") {
		const messageChunk = chunk.data?.chunk ?? chunk.data?.message;
		const text = extractTextContent(messageChunk);
		if (!text) return null;
		return {
			textEvents: [
				{
					text,
					messageId: typeof chunk.run_id === "string" ? chunk.run_id : undefined,
					node: extractEventNode(chunk),
					isDelta: true,
				},
			],
			toolEvents: [],
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
			textEvents: [
				{
					text,
					messageId: typeof chunk.run_id === "string" ? chunk.run_id : undefined,
					node: extractEventNode(chunk),
					isDelta: true,
				},
			],
			toolEvents: [],
		};
	}

	if (chunk.event === "on_tool_start") {
		const toolName = typeof chunk.name === "string" ? chunk.name : "tool";
		const toolId =
			typeof chunk.run_id === "string" ? chunk.run_id : createEventId();
		const node = extractEventNode(chunk);
		const { ui, uiOnly, textFallback, data: args } = splitUiPayload(
			normalizeToolArgs(chunk.data?.input),
		);
		return {
			textEvents: [],
			toolEvents: [
				{
					id: toolId,
					name: toolName,
					node,
					args,
					ui,
					uiOnly,
					textFallback,
					status: "running",
					timestamp: Date.now(),
				},
			],
		};
	}

	if (chunk.event === "on_tool_end") {
		const toolId =
			typeof chunk.run_id === "string" ? chunk.run_id : createEventId();
		const node = extractEventNode(chunk);
		const { ui, uiOnly, textFallback, data: output } = splitUiPayload(
			chunk.data?.output,
		);
		return {
			textEvents: [],
			toolEvents: [
				{
					id: toolId,
					name: typeof chunk.name === "string" ? chunk.name : "tool",
					node,
					status: chunk.data?.error ? "error" : "completed",
					output,
					ui,
					uiOnly,
					textFallback,
					error: chunk.data?.error,
					timestamp: Date.now(),
				},
			],
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

function normalizeMessagesPayload(payload: any, sourceKey?: string): MessageEntry[] {
	if (!Array.isArray(payload) || payload.length === 0) return [];

	if (payload.length === 2 && !Array.isArray(payload[0])) {
		return [{ message: payload[0], meta: payload[1], sourceKey, index: 0 }];
	}

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

function getMessageRole(msg: any): string | undefined {
	if (!msg) return undefined;
	return (
		msg.role ||
		msg?.kwargs?.role ||
		msg?.additional_kwargs?.role ||
		msg?.metadata?.role
	);
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

function extractEventNode(chunk: any): string | undefined {
	const candidates = [
		chunk?.metadata,
		chunk?.data?.metadata,
		chunk?.data?.chunk?.metadata,
		chunk?.data?.message?.metadata,
		chunk?.data?.chunk?.additional_kwargs?.metadata,
		chunk?.data?.message?.additional_kwargs?.metadata,
	];
	for (const candidate of candidates) {
		const node = extractLanggraphNode(candidate);
		if (node) return node;
	}
	return undefined;
}

function extractLanggraphNode(meta: any): string | undefined {
	if (!meta || typeof meta !== "object") return undefined;
	const node =
		meta.langgraph_node ??
		meta.langgraphNode ??
		meta.node ??
		meta.node_id ??
		meta.nodeId;
	if (typeof node === "string" && node.trim().length > 0) {
		return node;
	}
	return undefined;
}

function extractNodeLabel(message: any, meta?: any): string | undefined {
	const candidates = [
		meta,
		message?.metadata,
		message?.kwargs?.metadata,
		message?.additional_kwargs?.metadata,
		message?.additional_kwargs,
		message?.kwargs,
	];
	for (const candidate of candidates) {
		const node = extractLanggraphNode(candidate);
		if (node) return node;
	}
	return undefined;
}

function extractTextContent(message: any): string | undefined {
	if (!message) return undefined;
	const content =
		message.content ??
		message?.kwargs?.content ??
		message?.additional_kwargs?.content;
	if (typeof content === "string") return content.length > 0 ? content : undefined;
	if (Array.isArray(content)) {
		const blocks = content
			.filter((block: any) => block && block.type === "text" && block.text)
			.map((block: any) => block.text);
		return blocks.length > 0 ? blocks.join("") : undefined;
	}
	return undefined;
}

function extractToolCalls(
	msg: any,
	messageId?: string,
): NormalizedToolCall[] {
	const calls: any[] = [];

	const toolCalls =
		msg?.tool_calls ??
		msg?.kwargs?.tool_calls ??
		msg?.additional_kwargs?.tool_calls;
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

function createEventId(): string {
	if (typeof globalThis.crypto?.randomUUID === "function") {
		return globalThis.crypto.randomUUID();
	}
	return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function splitUiPayload(
	payload: any,
): {
	ui?: UiRenderSpec;
	uiOnly?: boolean;
	textFallback?: string;
	data: Record<string, any> | any;
} {
	if (typeof payload === "string") {
		try {
		const parsed = JSON.parse(payload);
		if (parsed && typeof parsed === "object") {
			return splitUiPayload(parsed);
		}
		} catch {
			return { data: payload };
		}
	}
	if (!payload || typeof payload !== "object") {
		return { data: payload };
	}
	if (!("ui" in payload)) {
		const content =
			typeof (payload as any).content === "string"
				? (payload as any).content
				: typeof (payload as any)?.kwargs?.content === "string"
					? (payload as any).kwargs.content
					: null;
		if (content) {
			return splitUiPayload(content);
		}
		return { data: payload };
	}
	const { ui, uiOnly, textFallback, ...rest } = payload as {
		ui?: UiRenderSpec;
		uiOnly?: boolean;
		textFallback?: string;
	} & Record<string, any>;
	if (!ui || typeof ui !== "object") {
		return {
			data: payload,
			uiOnly: typeof uiOnly === "boolean" ? uiOnly : undefined,
			textFallback: typeof textFallback === "string" ? textFallback : undefined,
		};
	}
	if (!Array.isArray((ui as UiRenderSpec).components)) {
		return {
			data: payload,
			uiOnly: typeof uiOnly === "boolean" ? uiOnly : undefined,
			textFallback: typeof textFallback === "string" ? textFallback : undefined,
		};
	}
	return {
		ui,
		data: rest,
		uiOnly: typeof uiOnly === "boolean" ? uiOnly : undefined,
		textFallback: typeof textFallback === "string" ? textFallback : undefined,
	};
}

function normalizeToolCall(
	toolCall: any,
	messageId?: string,
): NormalizedToolCall | null {
	if (!toolCall || typeof toolCall !== "object") return null;
	const name = toolCall.name || toolCall.function?.name;
	if (!name) return null;
	const index = typeof toolCall.index === "number" ? toolCall.index : undefined;
	const id =
		toolCall.id ||
		(index !== undefined && messageId ? `${messageId}:${index}` : undefined) ||
		(messageId ? `${messageId}:${createEventId()}` : createEventId());
	const args = normalizeToolArgs(toolCall.args ?? toolCall.function?.arguments);
	return { id, name, args };
}

function extractToolResult(msg: any): {
	id: string;
	name?: string;
	output: any;
	error?: string;
} | null {
	const toolCallId =
		msg?.tool_call_id ?? msg?.kwargs?.tool_call_id ?? msg?.additional_kwargs?.tool_call_id;
	if (!toolCallId) return null;

	return {
		id: toolCallId,
		name: msg?.name ?? msg?.kwargs?.name ?? msg?.additional_kwargs?.name,
		output: msg?.content ?? msg?.kwargs?.content ?? "",
		error: msg?.kwargs?.error ?? msg?.additional_kwargs?.error,
	};
}
