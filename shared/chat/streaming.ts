export type UiLayoutSpec = {
	type: "stack" | "row" | "grid";
	gap?: number;
	columns?: number;
	align?: "start" | "center" | "end" | "stretch";
};

export type UiComponentSpec = {
	component: string;
	props: Record<string, unknown>;
};

export type UiRenderSpec = {
	registry?: string;
	layout?: UiLayoutSpec;
	components: UiComponentSpec[];
};

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
		runId?: string;
		parentRunIds?: string[];
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

	const unwrappedChunk = unwrapAgentStreamChunk(chunk);
	if (unwrappedChunk) {
		return parseStreamEvents(unwrappedChunk);
	}

	const eventParsed = parseStreamEventChunk(chunk);
	if (eventParsed) return eventParsed;

	const messageEntries = normalizeMessagesFromChunk(chunk);
	if (messageEntries.length > 0) {
		for (const entry of messageEntries) {
			const msg = entry.message;
			const messageType = getMessageType(msg);
			const normalizedType = messageType ? messageType.toLowerCase() : "";
			const role = getMessageRole(msg);
			const isAIMessage = isAIMessageType(normalizedType) || role === "assistant";
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
						runId: toolCall.id,
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
						runId: toolResult.id,
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
			const { ui, uiOnly, textFallback, data: args } = splitUiPayload(
				normalized.args,
			);
			toolEvents.push({
				id: normalized.id,
				name: normalized.name,
				node: extractEventNode(chunk),
				runId: normalized.id,
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

function unwrapAgentStreamChunk(chunk: any): any | undefined {
	if (!chunk || typeof chunk !== "object") return undefined;

	if (chunk.type === "agent-stream") {
		return chunk.chunk;
	}

	if (chunk.type === "agent-event" && chunk.data?.type === "agent-stream") {
		return chunk.data.chunk;
	}

	return undefined;
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
		const node = extractEventNode(chunk);
		const parentRunIds = extractParentRunIds(chunk);
		const toolId =
			resolveToolEventRunId(chunk, toolName, node, parentRunIds) ||
			createEventId();
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
					runId: toolId,
					parentRunIds,
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
		const node = extractEventNode(chunk);
		const parentRunIds = extractParentRunIds(chunk);
		const toolId =
			resolveToolEventRunId(
				chunk,
				typeof chunk.name === "string" ? chunk.name : "tool",
				node,
				parentRunIds,
			) || createEventId();
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
					runId: toolId,
					parentRunIds,
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

	if (chunk.event === "on_tool_error") {
		const node = extractEventNode(chunk);
		const parentRunIds = extractParentRunIds(chunk);
		const toolId =
			resolveToolEventRunId(
				chunk,
				typeof chunk.name === "string" ? chunk.name : "tool",
				node,
				parentRunIds,
			) || createEventId();
		const errorPayload = chunk.data?.error ?? chunk.error;
		const { ui, uiOnly, textFallback, data: output } = splitUiPayload(
			chunk.data?.output ?? errorPayload,
		);
		return {
			textEvents: [],
			toolEvents: [
				{
					id: toolId,
					name: typeof chunk.name === "string" ? chunk.name : "tool",
					node,
					runId: toolId,
					parentRunIds,
					status: "error",
					output,
					ui,
					uiOnly,
					textFallback,
					error: normalizeErrorMessage(errorPayload),
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
		chunk?.data?.chunk?.response_metadata,
		chunk?.data?.message?.response_metadata,
		chunk,
		chunk?.data,
		chunk?.data?.chunk,
		chunk?.data?.message,
	];
	for (const candidate of candidates) {
		const node = extractLanggraphNode(candidate);
		if (node) return node;
	}
	return undefined;
}

function normalizeParentRunIds(value: unknown): string[] | undefined {
	if (Array.isArray(value)) {
		const ids = value
			.filter((item): item is string => typeof item === "string")
			.map((item) => item.trim())
			.filter(Boolean);
		return ids.length > 0 ? ids : undefined;
	}
	if (typeof value === "string" && value.trim()) {
		return [value.trim()];
	}
	return undefined;
}

function normalizeRunIdentifier(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : undefined;
}

function buildToolEventFallbackRunId(params: {
	toolName: string;
	node?: string;
	parentRunIds?: string[];
	step?: string;
}): string | undefined {
	const parts = [
		params.toolName.trim().toLowerCase(),
		params.node?.trim().toLowerCase() || "",
		params.parentRunIds?.join(">") || "",
		params.step?.trim() || "",
	].filter(Boolean);
	if (parts.length === 0) return undefined;
	return `derived:${parts.join("|")}`;
}

function resolveToolEventRunId(
	chunk: any,
	toolName: string,
	node?: string,
	parentRunIds?: string[],
): string | undefined {
	const directCandidates = [
		chunk?.run_id,
		chunk?.runId,
		chunk?.data?.run_id,
		chunk?.data?.runId,
		chunk?.metadata?.run_id,
		chunk?.metadata?.runId,
		chunk?.data?.metadata?.run_id,
		chunk?.data?.metadata?.runId,
	];
	for (const candidate of directCandidates) {
		const normalized = normalizeRunIdentifier(candidate);
		if (normalized) {
			return normalized;
		}
	}

	const stepCandidates = [
		chunk?.metadata?.langgraph_step,
		chunk?.metadata?.langgraphStep,
		chunk?.data?.metadata?.langgraph_step,
		chunk?.data?.metadata?.langgraphStep,
	];
	const step = stepCandidates
		.map((candidate) =>
			typeof candidate === "number"
				? String(candidate)
				: normalizeRunIdentifier(candidate),
		)
		.find(Boolean);

	return buildToolEventFallbackRunId({
		toolName,
		node,
		parentRunIds,
		step,
	});
}

function extractParentRunIds(chunk: any): string[] | undefined {
	const candidates = [
		chunk?.parent_ids,
		chunk?.parentIds,
		chunk?.metadata?.parent_ids,
		chunk?.metadata?.parentIds,
		chunk?.data?.parent_ids,
		chunk?.data?.parentIds,
		chunk?.data?.metadata?.parent_ids,
		chunk?.data?.metadata?.parentIds,
	];
	for (const candidate of candidates) {
		const parsed = normalizeParentRunIds(candidate);
		if (parsed && parsed.length > 0) {
			return parsed;
		}
	}
	return undefined;
}

function extractLanggraphNode(meta: any): string | undefined {
	if (!meta || typeof meta !== "object") return undefined;
	const directNode =
		meta.langgraph_node ??
		meta.langgraphNode ??
		meta.node ??
		meta.node_id ??
		meta.nodeId;
	if (typeof directNode === "string" && directNode.trim().length > 0) {
		return directNode.trim();
	}

	const tagNode = extractNodeFromTagList(meta.tags) || extractNodeFromTagList(meta.ls_tags);
	if (tagNode) return tagNode;

	const checkpointNode =
		extractNodeFromNamespace(meta.langgraph_checkpoint_ns) ||
		extractNodeFromNamespace(meta.langgraphCheckpointNs) ||
		extractNodeFromNamespace(meta.checkpoint_ns) ||
		extractNodeFromNamespace(meta.checkpointNs);
	if (checkpointNode) return checkpointNode;

	const pathNode =
		extractNodeFromPath(meta.langgraph_path) ||
		extractNodeFromPath(meta.langgraphPath) ||
		extractNodeFromPath(meta.path);
	if (pathNode) return pathNode;

	return undefined;
}

function extractNodeLabel(message: any, meta?: any): string | undefined {
	const candidates = [
		meta,
		message?.metadata,
		message?.response_metadata,
		message?.kwargs?.metadata,
		message?.additional_kwargs?.metadata,
		message?.additional_kwargs?.response_metadata,
		message?.additional_kwargs,
		message?.kwargs,
	];
	for (const candidate of candidates) {
		const node = extractLanggraphNode(candidate);
		if (node) return node;
	}
	return undefined;
}

function extractNodeFromTagList(tags: unknown): string | undefined {
	if (!Array.isArray(tags)) return undefined;
	for (const tag of tags) {
		if (typeof tag !== "string") continue;
		const normalized = tag.trim();
		if (!normalized) continue;
		if (normalized.startsWith("langgraph_node:")) {
			const value = normalized.slice("langgraph_node:".length).trim();
			if (value) return value;
		}
		if (normalized.startsWith("langgraph_node=")) {
			const value = normalized.slice("langgraph_node=".length).trim();
			if (value) return value;
		}
	}
	return undefined;
}

function extractNodeFromNamespace(namespace: unknown): string | undefined {
	if (typeof namespace !== "string") return undefined;
	const trimmed = namespace.trim();
	if (!trimmed) return undefined;

	const segments = trimmed.split(/[/:|]/g).map((segment) => segment.trim());
	for (const segment of segments) {
		if (!segment || segment.startsWith("__")) continue;
		if (segment.toLowerCase() === "langgraph") continue;
		return segment;
	}
	return undefined;
}

function extractNodeFromPath(path: unknown): string | undefined {
	if (typeof path === "string") {
		return extractNodeFromNamespace(path);
	}
	if (!Array.isArray(path)) return undefined;
	for (let index = path.length - 1; index >= 0; index -= 1) {
		const part = path[index];
		if (typeof part !== "string") continue;
		const extracted = extractNodeFromNamespace(part);
		if (extracted) return extracted;
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

function normalizeErrorMessage(error: unknown): string | undefined {
	if (!error) return undefined;
	if (typeof error === "string") {
		return error;
	}
	if (typeof error === "object") {
		const message =
			(error as { message?: unknown }).message ??
			(error as { kwargs?: { message?: unknown } }).kwargs?.message;
		if (typeof message === "string") {
			return message;
		}
		try {
			return JSON.stringify(error);
		} catch {
			return String(error);
		}
	}
	return String(error);
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
