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

export type ParsedAttachmentEvent = {
	kind: "image" | "audio" | "file";
	dataUrl: string;
	textContent?: string;
	name?: string;
	mimeType?: string;
	size?: number;
	messageId?: string;
	node?: string;
	isDelta?: boolean;
};

export type ParsedUsageEvent = {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	estimatedContextTokens?: number;
	thresholdTokens?: number;
	messageId?: string;
	node?: string;
	timestamp: number;
};

export type ParsedStreamEvent = {
	textEvents: ParsedTextEvent[];
	attachmentEvents: ParsedAttachmentEvent[];
	usageEvents: ParsedUsageEvent[];
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
	const attachmentEvents: ParsedAttachmentEvent[] = [];
	const usageEvents: ParsedUsageEvent[] = [];
	const toolEvents: ParsedStreamEvent["toolEvents"] = [];
	const estimatedContextTokens = extractEstimatedContextTokens(chunk);
	const thresholdTokens = extractThresholdTokens(chunk);
	if (!chunk || typeof chunk !== "object") {
		return withUsageMetadata(
			{ textEvents, attachmentEvents, usageEvents, toolEvents },
			estimatedContextTokens,
			thresholdTokens,
		);
	}

	const unwrappedChunk = unwrapAgentStreamChunk(chunk);
	if (unwrappedChunk) {
		const nestedParsed = parseStreamEvents(unwrappedChunk);
		return withUsageMetadata(
			nestedParsed,
			estimatedContextTokens ?? extractEstimatedContextTokens(unwrappedChunk),
			thresholdTokens ?? extractThresholdTokens(unwrappedChunk),
		);
	}

	if (typeof chunk.event === "string") {
		const eventParsed = parseStreamEventChunk(chunk);
		if (eventParsed) {
			return withUsageMetadata(
				eventParsed,
				estimatedContextTokens,
				thresholdTokens,
			);
		}
		// Ignore unsupported LangGraph lifecycle events.
		return withUsageMetadata(
			{ textEvents, attachmentEvents, usageEvents, toolEvents },
			estimatedContextTokens,
			thresholdTokens,
		);
	}

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
				const isDelta = isMessageDelta(msg, normalizedType);
				const usage = extractTokenUsage(msg);
				if (usage) {
					usageEvents.push({
						...usage,
						messageId,
						node,
						timestamp: Date.now(),
					});
				}
				const parsedAttachments = extractAttachmentsFromMessage(msg);
				for (const attachment of parsedAttachments) {
					attachmentEvents.push({
						...attachment,
						messageId,
						node,
						isDelta,
					});
				}
				const toolCalls = extractToolCalls(msg, messageId);
				for (const toolCall of toolCalls) {
					const {
						ui,
						uiOnly,
						textFallback,
						data: args,
					} = splitUiPayload(toolCall.args);
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

				const rawText = extractTextContent(msg);
				const text = isDelta
					? sanitizeDeltaDisplayText(rawText)
					: sanitizeDisplayText(rawText);
				if (text !== undefined) {
					textEvents.push({
						text,
						messageId,
						node,
						isDelta,
					});
				}
			}

			if (isToolMessage) {
				const toolResult = extractToolResult(msg);
				if (toolResult) {
					const node = extractNodeLabel(msg, entry.meta);
					const {
						ui,
						uiOnly,
						textFallback,
						data: output,
					} = splitUiPayload(toolResult.output);
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
		if (
			textEvents.length > 0 ||
			attachmentEvents.length > 0 ||
			usageEvents.length > 0 ||
			toolEvents.length > 0
		) {
			return { textEvents, attachmentEvents, usageEvents, toolEvents };
		}
	}

	if (typeof chunk.content === "string") {
		const text = sanitizeDisplayText(chunk.content);
		if (text) {
			textEvents.push({ text });
		}
	} else {
		const parsedAttachments = extractAttachmentsFromMessage({
			content: chunk.content,
		});
		for (const attachment of parsedAttachments) {
			attachmentEvents.push(attachment);
		}
	}

	if (chunk.tool_calls && Array.isArray(chunk.tool_calls)) {
		for (const toolCall of chunk.tool_calls) {
			const normalized = normalizeToolCall(toolCall);
			if (!normalized) continue;
			const {
				ui,
				uiOnly,
				textFallback,
				data: args,
			} = splitUiPayload(normalized.args);
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

	const directUsage = extractTokenUsage(chunk);
	if (directUsage) {
		usageEvents.push({
			...directUsage,
			messageId:
				normalizeRunIdentifier(chunk?.run_id) ||
				normalizeRunIdentifier(chunk?.id),
			node: extractEventNode(chunk),
			timestamp: Date.now(),
		});
	}

	return withUsageMetadata(
		{ textEvents, attachmentEvents, usageEvents, toolEvents },
		estimatedContextTokens,
		thresholdTokens,
	);
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
	const usageEvents = extractUsageEventsFromEventChunk(chunk);

	if (chunk.event === "on_chat_model_stream") {
		const messageChunk = chunk.data?.chunk ?? chunk.data?.message;
		if (!isAIChatModelChunk(messageChunk)) return null;
		const messageId =
			typeof chunk.run_id === "string" ? chunk.run_id : undefined;
		const node = extractEventNode(chunk);
		const parsedAttachments = extractAttachmentsFromMessage(messageChunk).map(
			(attachment) => ({
				...attachment,
				messageId,
				node,
				isDelta: true,
			}),
		);
		const text = sanitizeDeltaDisplayText(extractTextContent(messageChunk));
		if (
			text === undefined &&
			parsedAttachments.length === 0 &&
			usageEvents.length === 0
		) {
			return null;
		}
		return {
			textEvents:
				text === undefined
					? []
					: [
							{
								text,
								messageId,
								node,
								isDelta: true,
							},
						],
			attachmentEvents: parsedAttachments,
			usageEvents,
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
		text = sanitizeDeltaDisplayText(text);
		if (text === undefined && usageEvents.length === 0) return null;
		return {
			textEvents:
				text === undefined
					? []
					: [
							{
								text,
								messageId:
									typeof chunk.run_id === "string" ? chunk.run_id : undefined,
								node: extractEventNode(chunk),
								isDelta: true,
							},
						],
			attachmentEvents: [],
			usageEvents,
			toolEvents: [],
		};
	}

	if (chunk.event === "on_chat_model_end" || chunk.event === "on_llm_end") {
		if (usageEvents.length === 0) return null;
		return {
			textEvents: [],
			attachmentEvents: [],
			usageEvents,
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
		const {
			ui,
			uiOnly,
			textFallback,
			data: args,
		} = splitUiPayload(normalizeToolArgs(chunk.data?.input));
		return {
			textEvents: [],
			attachmentEvents: [],
			usageEvents,
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
		const {
			ui,
			uiOnly,
			textFallback,
			data: output,
		} = splitUiPayload(chunk.data?.output);
		return {
			textEvents: [],
			attachmentEvents: [],
			usageEvents,
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
		const {
			ui,
			uiOnly,
			textFallback,
			data: output,
		} = splitUiPayload(chunk.data?.output ?? errorPayload);
		return {
			textEvents: [],
			attachmentEvents: [],
			usageEvents,
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

	const chainAttachmentEvent = parseChainAttachmentEvent(chunk);
	const chainFailureEvent = parseChainFailureEvent(chunk);
	const chainUsageEvent = parseChainUsageEvent(chunk);
	if (chainAttachmentEvent || chainFailureEvent || chainUsageEvent) {
		return {
			textEvents: chainFailureEvent?.textEvents || [],
			attachmentEvents: chainAttachmentEvent?.attachmentEvents || [],
			usageEvents: [
				...(chainAttachmentEvent?.usageEvents || []),
				...(chainFailureEvent?.usageEvents || []),
				...(chainUsageEvent?.usageEvents || []),
			],
			toolEvents: [
				...(chainAttachmentEvent?.toolEvents || []),
				...(chainFailureEvent?.toolEvents || []),
				...(chainUsageEvent?.toolEvents || []),
			],
		};
	}

	return null;
}

function extractUsageEventsFromEventChunk(chunk: any): ParsedUsageEvent[] {
	const eventName = typeof chunk?.event === "string" ? chunk.event : "";
	if (
		eventName !== "on_chat_model_stream" &&
		eventName !== "on_chat_model_end" &&
		eventName !== "on_llm_stream" &&
		eventName !== "on_llm_end"
	) {
		return [];
	}
	const usage = extractTokenUsage(chunk);
	if (!usage) return [];
	return [
		{
			...usage,
			messageId:
				normalizeRunIdentifier(chunk?.run_id) ||
				normalizeRunIdentifier(chunk?.id),
			node: extractEventNode(chunk),
			timestamp: Date.now(),
		},
	];
}

function extractTokenUsage(
	payload: unknown,
): { inputTokens: number; outputTokens: number; totalTokens: number } | null {
	const accumulator = {
		inputTokens: 0,
		outputTokens: 0,
		totalTokens: 0,
	};
	const visited = new WeakSet<object>();
	collectTokenUsageFromPayload(accumulator, payload, visited, 0);
	if (accumulator.totalTokens === 0) {
		accumulator.totalTokens =
			accumulator.inputTokens + accumulator.outputTokens;
	}
	if (
		accumulator.inputTokens <= 0 &&
		accumulator.outputTokens <= 0 &&
		accumulator.totalTokens <= 0
	) {
		return null;
	}
	return accumulator;
}

function collectTokenUsageFromPayload(
	target: { inputTokens: number; outputTokens: number; totalTokens: number },
	payload: unknown,
	visited: WeakSet<object>,
	depth: number,
): void {
	if (depth > 8 || !payload || typeof payload !== "object") return;
	if (visited.has(payload as object)) return;
	visited.add(payload as object);

	const record = payload as Record<string, unknown>;
	const directInput =
		getFiniteNumber(record.input_tokens) ||
		getFiniteNumber(record.inputTokens) ||
		getFiniteNumber(record.prompt_tokens) ||
		getFiniteNumber(record.promptTokens);
	const directOutput =
		getFiniteNumber(record.output_tokens) ||
		getFiniteNumber(record.outputTokens) ||
		getFiniteNumber(record.completion_tokens) ||
		getFiniteNumber(record.completionTokens);
	const directTotal =
		getFiniteNumber(record.total_tokens) || getFiniteNumber(record.totalTokens);

	if (directInput > 0) {
		target.inputTokens = Math.max(target.inputTokens, directInput);
	}
	if (directOutput > 0) {
		target.outputTokens = Math.max(target.outputTokens, directOutput);
	}
	if (directTotal > 0) {
		target.totalTokens = Math.max(target.totalTokens, directTotal);
	}

	const nestedCandidates = [
		record.usage,
		record.usage_metadata,
		record.usageMetadata,
		record.tokenUsage,
		record.response_metadata,
		record.responseMetadata,
		record.additional_kwargs,
		record.additionalKwargs,
		record.metadata,
		record.data,
		record.output,
		record.message,
		record.chunk,
	];
	for (const nested of nestedCandidates) {
		collectTokenUsageFromPayload(target, nested, visited, depth + 1);
	}
}

function withUsageMetadata(
	parsed: ParsedStreamEvent,
	estimatedContextTokens: number | undefined,
	thresholdTokens: number | undefined,
): ParsedStreamEvent {
	const hasEstimatedContextTokens =
		typeof estimatedContextTokens === "number" &&
		Number.isFinite(estimatedContextTokens) &&
		estimatedContextTokens > 0;
	const hasThresholdTokens =
		typeof thresholdTokens === "number" &&
		Number.isFinite(thresholdTokens) &&
		thresholdTokens > 0;
	if (!hasEstimatedContextTokens && !hasThresholdTokens) {
		return parsed;
	}

	const normalizedEstimate = hasEstimatedContextTokens
		? Math.round(estimatedContextTokens)
		: undefined;
	const normalizedThreshold = hasThresholdTokens
		? Math.round(thresholdTokens)
		: undefined;
	if (parsed.usageEvents.length === 0) {
		return {
			...parsed,
			usageEvents: [
				{
					inputTokens: 0,
					outputTokens: 0,
					totalTokens: 0,
					...(typeof normalizedEstimate === "number"
						? { estimatedContextTokens: normalizedEstimate }
						: {}),
					...(typeof normalizedThreshold === "number"
						? { thresholdTokens: normalizedThreshold }
						: {}),
					timestamp: Date.now(),
				},
			],
		};
	}

	return {
		...parsed,
		usageEvents: parsed.usageEvents.map((event) => ({
			...event,
			...(typeof normalizedEstimate === "number"
				? {
						estimatedContextTokens:
							typeof event.estimatedContextTokens === "number" &&
							event.estimatedContextTokens > normalizedEstimate
								? event.estimatedContextTokens
								: normalizedEstimate,
					}
				: {}),
			...(typeof normalizedThreshold === "number"
				? {
						thresholdTokens:
							typeof event.thresholdTokens === "number" &&
							event.thresholdTokens > normalizedThreshold
								? event.thresholdTokens
								: normalizedThreshold,
					}
				: {}),
		})),
	};
}

function extractEstimatedContextTokens(payload: unknown): number | undefined {
	const visited = new WeakSet<object>();
	return collectEstimatedContextTokens(payload, visited, 0);
}

function extractThresholdTokens(payload: unknown): number | undefined {
	const visited = new WeakSet<object>();
	return collectThresholdTokens(payload, visited, 0);
}

function collectEstimatedContextTokens(
	payload: unknown,
	visited: WeakSet<object>,
	depth: number,
): number | undefined {
	if (depth > 8 || !payload || typeof payload !== "object") return undefined;
	if (visited.has(payload as object)) return undefined;
	visited.add(payload as object);

	if (Array.isArray(payload)) {
		let best: number | undefined;
		for (const item of payload) {
			const nested = collectEstimatedContextTokens(item, visited, depth + 1);
			if (typeof nested === "number" && (best === undefined || nested > best)) {
				best = nested;
			}
		}
		return best;
	}

	const record = payload as Record<string, unknown>;
	const directCandidates = [
		record.estimatedContextTokens,
		record.estimated_context_tokens,
		record.contextTokensApprox,
		record.context_tokens_approx,
	];
	let bestDirect = 0;
	for (const candidate of directCandidates) {
		const value = getFiniteNumber(candidate);
		if (value > bestDirect) {
			bestDirect = value;
		}
	}

	const nestedCandidates = [
		record.chunk,
		record.data,
		record.output,
		record.message,
		record.metadata,
		record.additional_kwargs,
		record.additionalKwargs,
		record.tokenUsage,
	];
	let bestNested = 0;
	for (const nestedCandidate of nestedCandidates) {
		const nested = collectEstimatedContextTokens(
			nestedCandidate,
			visited,
			depth + 1,
		);
		if (typeof nested === "number" && nested > bestNested) {
			bestNested = nested;
		}
	}

	const best = Math.max(bestDirect, bestNested);
	return best > 0 ? best : undefined;
}

function collectThresholdTokens(
	payload: unknown,
	visited: WeakSet<object>,
	depth: number,
): number | undefined {
	if (depth > 8 || !payload || typeof payload !== "object") return undefined;
	if (visited.has(payload as object)) return undefined;
	visited.add(payload as object);

	if (Array.isArray(payload)) {
		let best: number | undefined;
		for (const item of payload) {
			const nested = collectThresholdTokens(item, visited, depth + 1);
			if (typeof nested === "number" && (best === undefined || nested > best)) {
				best = nested;
			}
		}
		return best;
	}

	const record = payload as Record<string, unknown>;
	const directCandidates = [record.thresholdTokens, record.threshold_tokens];
	let bestDirect = 0;
	for (const candidate of directCandidates) {
		const value = getFiniteNumber(candidate);
		if (value > bestDirect) {
			bestDirect = value;
		}
	}

	const nestedCandidates = [
		record.chunk,
		record.data,
		record.output,
		record.message,
		record.metadata,
		record.additional_kwargs,
		record.additionalKwargs,
		record.tokenUsage,
	];
	let bestNested = 0;
	for (const nestedCandidate of nestedCandidates) {
		const nested = collectThresholdTokens(nestedCandidate, visited, depth + 1);
		if (typeof nested === "number" && nested > bestNested) {
			bestNested = nested;
		}
	}

	const best = Math.max(bestDirect, bestNested);
	return best > 0 ? best : undefined;
}

function getFiniteNumber(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parseChainAttachmentEvent(chunk: any): ParsedStreamEvent | null {
	const eventName =
		typeof chunk?.event === "string" ? chunk.event.toLowerCase() : "";
	if (eventName !== "on_chain_stream" && eventName !== "on_chain_end") {
		return null;
	}
	const inputAttachmentSignatures = collectAiAttachmentSignatures(
		chunk?.data?.input,
		chunk?.data?.inputs,
	);

	// Only inspect emitted chain outputs for attachments. Inputs/states often
	// include historical thread messages and would replay prior images.
	const searchCandidates = [chunk?.data?.chunk, chunk?.data?.output];
	for (const candidate of searchCandidates) {
		const match = findLatestAiMessageWithAttachments(candidate, {
			excludeAttachmentSignatures: inputAttachmentSignatures,
		});
		if (!match) continue;
		const messageId = match.messageId || normalizeRunIdentifier(chunk?.run_id);
		const node = match.node || extractEventNode(chunk);
		return {
			textEvents: [],
			attachmentEvents: match.attachments.map((attachment) => ({
				...attachment,
				messageId,
				node,
				isDelta: eventName === "on_chain_stream",
			})),
			usageEvents: [],
			toolEvents: [],
		};
	}

	return null;
}

function parseChainUsageEvent(chunk: any): ParsedStreamEvent | null {
	const eventName =
		typeof chunk?.event === "string" ? chunk.event.toLowerCase() : "";
	if (eventName !== "on_chain_stream" && eventName !== "on_chain_end") {
		return null;
	}

	const searchCandidates = [chunk?.data?.chunk, chunk?.data?.output];
	for (const candidate of searchCandidates) {
		const match = findLatestAiMessageWithUsage(candidate);
		if (!match) continue;
		return {
			textEvents: [],
			attachmentEvents: [],
			usageEvents: [
				{
					inputTokens: match.inputTokens,
					outputTokens: match.outputTokens,
					totalTokens: match.totalTokens,
					messageId:
						match.messageId ||
						normalizeRunIdentifier(chunk?.run_id) ||
						normalizeRunIdentifier(chunk?.id),
					node: match.node || extractEventNode(chunk),
					timestamp: Date.now(),
				},
			],
			toolEvents: [],
		};
	}

	for (const candidate of searchCandidates) {
		const usage = extractTokenUsage(candidate);
		if (!usage) continue;
		return {
			textEvents: [],
			attachmentEvents: [],
			usageEvents: [
				{
					...usage,
					messageId:
						normalizeRunIdentifier(chunk?.run_id) ||
						normalizeRunIdentifier(chunk?.id),
					node: extractEventNode(chunk),
					timestamp: Date.now(),
				},
			],
			toolEvents: [],
		};
	}

	return null;
}

function findLatestAiMessageWithAttachments(
	value: unknown,
	options?: {
		excludeAttachmentSignatures?: Set<string>;
	},
): {
	attachments: Array<{
		kind: "image" | "audio" | "file";
		dataUrl: string;
		textContent?: string;
		name?: string;
		mimeType?: string;
		size?: number;
	}>;
	messageId?: string;
	node?: string;
} | null {
	const orderedMessages: Array<{
		message: Record<string, unknown>;
		meta?: any;
		isAI: boolean;
		isHuman: boolean;
	}> = [];

	const visit = (candidate: unknown, meta?: any): void => {
		if (!candidate || typeof candidate !== "object") return;
		if (Array.isArray(candidate)) {
			for (const item of candidate) {
				visit(item, meta);
			}
			return;
		}

		const record = candidate as Record<string, unknown>;
		const messageType = getMessageType(record);
		const normalizedType = messageType ? messageType.toLowerCase() : "";
		const role = getMessageRole(record);
		const normalizedRole =
			typeof role === "string" ? role.trim().toLowerCase() : "";
		const isAIMessage =
			isAIMessageType(normalizedType) || normalizedRole === "assistant";
		const isHumanMessage =
			isHumanMessageType(normalizedType) ||
			normalizedRole === "user" ||
			normalizedRole === "human";
		if (isAIMessage || isHumanMessage) {
			orderedMessages.push({
				message: record,
				meta,
				isAI: isAIMessage,
				isHuman: isHumanMessage,
			});
		}

		for (const [key, nested] of Object.entries(record)) {
			if (!nested || typeof nested !== "object") continue;
			const nextMeta = key === "metadata" ? nested : meta;
			visit(nested, nextMeta);
		}
	};

	visit(value);
	if (orderedMessages.length === 0) return null;

	let latestHumanIndex = -1;
	for (const [index, entry] of orderedMessages.entries()) {
		if (entry.isHuman) {
			latestHumanIndex = index;
		}
	}

	if (latestHumanIndex >= 0) {
		for (let index = orderedMessages.length - 1; index >= 0; index -= 1) {
			if (index <= latestHumanIndex) {
				// Only use AI messages that occur after the most recent user/human
				// message in the same snapshot to avoid replaying stale attachments.
				break;
			}
			const entry = orderedMessages[index];
			if (!entry?.isAI) continue;
			const attachments = filterAttachmentSignatures(
				extractAttachmentsFromMessage(entry.message),
				options?.excludeAttachmentSignatures,
			);
			if (attachments.length === 0) continue;
			return {
				attachments,
				messageId: getMessageId(entry.message, {
					message: entry.message,
					meta: entry.meta,
				}),
				node: extractNodeLabel(entry.message, entry.meta),
			};
		}
	}

	// If there is no trailing user/human message in this snapshot, fall back to
	// the latest AI message only. Do not backtrack to older AI snapshots.
	if (latestHumanIndex < 0) {
		let latestAiEntry: {
			message: Record<string, unknown>;
			meta?: any;
			isAI: boolean;
			isHuman: boolean;
		} | null = null;
		for (let index = orderedMessages.length - 1; index >= 0; index -= 1) {
			const entry = orderedMessages[index];
			if (!entry?.isAI) continue;
			latestAiEntry = entry;
			break;
		}
		if (!latestAiEntry) return null;
		const attachments = filterAttachmentSignatures(
			extractAttachmentsFromMessage(latestAiEntry.message),
			options?.excludeAttachmentSignatures,
		);
		if (attachments.length === 0) return null;
		return {
			attachments,
			messageId: getMessageId(latestAiEntry.message, {
				message: latestAiEntry.message,
				meta: latestAiEntry.meta,
			}),
			node: extractNodeLabel(latestAiEntry.message, latestAiEntry.meta),
		};
	}

	return null;
}

function filterAttachmentSignatures(
	attachments: Array<{
		kind: "image" | "audio" | "file";
		dataUrl: string;
		textContent?: string;
		name?: string;
		mimeType?: string;
		size?: number;
	}>,
	excludedSignatures?: Set<string>,
): Array<{
	kind: "image" | "audio" | "file";
	dataUrl: string;
	textContent?: string;
	name?: string;
	mimeType?: string;
	size?: number;
}> {
	if (!excludedSignatures || excludedSignatures.size === 0) {
		return attachments;
	}
	return attachments.filter(
		(attachment) =>
			!excludedSignatures.has(buildAttachmentSignature(attachment)),
	);
}

function collectAiAttachmentSignatures(...values: unknown[]): Set<string> {
	const signatures = new Set<string>();

	const visit = (candidate: unknown): void => {
		if (!candidate || typeof candidate !== "object") return;
		if (Array.isArray(candidate)) {
			for (const item of candidate) {
				visit(item);
			}
			return;
		}

		const record = candidate as Record<string, unknown>;
		const messageType = getMessageType(record);
		const normalizedType = messageType ? messageType.toLowerCase() : "";
		const role = getMessageRole(record);
		const isAIMessage = isAIMessageType(normalizedType) || role === "assistant";
		if (isAIMessage) {
			for (const attachment of extractAttachmentsFromMessage(record)) {
				signatures.add(buildAttachmentSignature(attachment));
			}
		}

		for (const nested of Object.values(record)) {
			if (!nested || typeof nested !== "object") continue;
			visit(nested);
		}
	};

	for (const value of values) {
		visit(value);
	}
	return signatures;
}

function buildAttachmentSignature(attachment: {
	kind: "image" | "audio" | "file";
	dataUrl: string;
	textContent?: string;
	name?: string;
	mimeType?: string;
	size?: number;
}): string {
	return [
		attachment.kind,
		attachment.dataUrl,
		attachment.textContent || "",
		attachment.name || "",
		attachment.mimeType || "",
		typeof attachment.size === "number" ? String(attachment.size) : "",
	].join("|");
}

function parseChainFailureEvent(chunk: any): ParsedStreamEvent | null {
	const eventName =
		typeof chunk?.event === "string" ? chunk.event.toLowerCase() : "";
	if (eventName !== "on_chain_stream" && eventName !== "on_chain_end") {
		return null;
	}

	const searchCandidates = [chunk?.data?.chunk, chunk?.data?.output];
	if (shouldInspectFailureFallbackPayloads(chunk)) {
		searchCandidates.push(
			chunk?.data?.input,
			chunk?.data?.inputs,
			chunk?.data?.state,
			chunk?.data,
		);
	}
	for (const candidate of searchCandidates) {
		const match = findLatestFailureAiMessage(candidate);
		if (!match) continue;
		return {
			textEvents: [
				{
					text: match.text,
					messageId: match.messageId || normalizeRunIdentifier(chunk?.run_id),
					node: match.node || extractEventNode(chunk),
					// Use delta semantics to dedupe repeated chain lifecycle echoes.
					isDelta: true,
				},
			],
			attachmentEvents: [],
			usageEvents: [],
			toolEvents: [],
		};
	}

	return null;
}

function shouldInspectFailureFallbackPayloads(chunk: any): boolean {
	const eventName =
		typeof chunk?.event === "string" ? chunk.event.toLowerCase() : "";
	if (eventName !== "on_chain_end") {
		return false;
	}
	const chainName =
		typeof chunk?.name === "string" ? chunk.name.toLowerCase() : "";
	return chainName.includes("after_model");
}

function findLatestAiMessageWithUsage(value: unknown): {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	messageId?: string;
	node?: string;
} | null {
	type MessageRecord = {
		isAI: boolean;
		isHuman: boolean;
		usage?: {
			inputTokens: number;
			outputTokens: number;
			totalTokens: number;
		};
		messageId?: string;
		node?: string;
	};

	const orderedMessages: MessageRecord[] = [];

	const visit = (candidate: unknown, meta?: any): void => {
		if (!candidate || typeof candidate !== "object") return;
		if (Array.isArray(candidate)) {
			for (const item of candidate) {
				visit(item, meta);
			}
			return;
		}

		const record = candidate as Record<string, unknown>;
		const messageType = getMessageType(record);
		const normalizedType = messageType ? messageType.toLowerCase() : "";
		const role = getMessageRole(record);
		const isAIMessage = isAIMessageType(normalizedType) || role === "assistant";
		const isHumanMessage =
			isHumanMessageType(normalizedType) || role === "user" || role === "human";

		if (isAIMessage) {
			orderedMessages.push({
				isAI: true,
				isHuman: false,
				usage: extractTokenUsage(record) || undefined,
				messageId: getMessageId(record, { message: record, meta }),
				node: extractNodeLabel(record, meta),
			});
		} else if (isHumanMessage) {
			orderedMessages.push({
				isAI: false,
				isHuman: true,
			});
		}

		for (const [key, nested] of Object.entries(record)) {
			if (!nested || typeof nested !== "object") continue;
			const nextMeta = key === "metadata" ? nested : meta;
			visit(nested, nextMeta);
		}
	};

	visit(value);
	if (orderedMessages.length === 0) {
		return null;
	}

	let latestHumanIndex = -1;
	for (const [index, entry] of orderedMessages.entries()) {
		if (entry.isHuman) {
			latestHumanIndex = index;
		}
	}

	let latestUsageEntry: MessageRecord | null = null;
	for (let index = orderedMessages.length - 1; index >= 0; index -= 1) {
		if (latestHumanIndex >= 0 && index <= latestHumanIndex) {
			break;
		}
		const entry = orderedMessages[index];
		if (!entry?.isAI || !entry.usage) continue;
		latestUsageEntry = entry;
		break;
	}
	if (!latestUsageEntry && latestHumanIndex < 0) {
		for (let index = orderedMessages.length - 1; index >= 0; index -= 1) {
			const entry = orderedMessages[index];
			if (!entry?.isAI || !entry.usage) continue;
			latestUsageEntry = entry;
			break;
		}
	}
	if (!latestUsageEntry?.usage) {
		return null;
	}

	return {
		inputTokens: latestUsageEntry.usage.inputTokens,
		outputTokens: latestUsageEntry.usage.outputTokens,
		totalTokens: latestUsageEntry.usage.totalTokens,
		messageId: latestUsageEntry.messageId,
		node: latestUsageEntry.node,
	};
}

function findLatestFailureAiMessage(
	value: unknown,
): { text: string; messageId?: string; node?: string } | null {
	type MessageRecord = {
		isAI: boolean;
		isHuman: boolean;
		text?: string;
		messageId?: string;
		node?: string;
	};
	const orderedMessages: MessageRecord[] = [];

	const visit = (candidate: unknown, meta?: any): void => {
		if (!candidate || typeof candidate !== "object") return;
		if (Array.isArray(candidate)) {
			for (const item of candidate) {
				visit(item, meta);
			}
			return;
		}

		const record = candidate as Record<string, unknown>;
		const messageType = getMessageType(record);
		const normalizedType = messageType ? messageType.toLowerCase() : "";
		const role = getMessageRole(record);
		const isAIMessage = isAIMessageType(normalizedType) || role === "assistant";
		const isHumanMessage =
			isHumanMessageType(normalizedType) || role === "user" || role === "human";
		if (isAIMessage) {
			orderedMessages.push({
				isAI: true,
				isHuman: false,
				text: sanitizeDisplayText(extractTextContent(record)),
				messageId: getMessageId(record, { message: record, meta }),
				node: extractNodeLabel(record, meta),
			});
		} else if (isHumanMessage) {
			orderedMessages.push({
				isAI: false,
				isHuman: true,
			});
		}

		for (const [key, nested] of Object.entries(record)) {
			if (!nested || typeof nested !== "object") continue;
			const nextMeta = key === "metadata" ? nested : meta;
			visit(nested, nextMeta);
		}
	};

	visit(value);
	if (orderedMessages.length === 0) {
		return null;
	}

	let latestHumanIndex = -1;
	for (const [index, entry] of orderedMessages.entries()) {
		if (entry.isHuman) {
			latestHumanIndex = index;
		}
	}

	let latestAssistantTextEntry: MessageRecord | null = null;
	for (let index = orderedMessages.length - 1; index >= 0; index -= 1) {
		if (latestHumanIndex >= 0 && index <= latestHumanIndex) {
			break;
		}
		const entry = orderedMessages[index];
		if (!entry?.isAI) continue;
		latestAssistantTextEntry = entry;
		break;
	}
	if (!latestAssistantTextEntry && latestHumanIndex < 0) {
		for (let index = orderedMessages.length - 1; index >= 0; index -= 1) {
			const entry = orderedMessages[index];
			if (!entry?.isAI) continue;
			latestAssistantTextEntry = entry;
			break;
		}
	}
	if (!latestAssistantTextEntry?.text) {
		return null;
	}
	if (!looksLikeModelFailureText(latestAssistantTextEntry.text)) {
		return null;
	}
	return {
		text: latestAssistantTextEntry.text,
		messageId: latestAssistantTextEntry.messageId,
		node: latestAssistantTextEntry.node,
	};
}

function isAIChatModelChunk(message: any): boolean {
	if (!message || typeof message !== "object") return false;

	const role = getMessageRole(message);
	if (typeof role === "string") {
		const normalizedRole = role.toLowerCase();
		return normalizedRole === "assistant" || normalizedRole === "ai";
	}

	const directType = getMessageType(message);
	if (typeof directType === "string") {
		const normalizedType = directType.toLowerCase();
		if (isAIMessageType(normalizedType)) return true;
		if (
			normalizedType.includes("human") ||
			normalizedType.includes("user") ||
			isToolMessageType(normalizedType)
		) {
			return false;
		}
	}

	const constructorType =
		typeof message.type === "string" ? message.type.toLowerCase() : "";
	if (constructorType === "constructor") {
		const idParts = Array.isArray(message.id)
			? message.id
			: Array.isArray(message.lc_id)
				? message.lc_id
				: [];
		if (
			idParts.some((part: any) =>
				String(part).toLowerCase().includes("aimessage"),
			)
		) {
			return true;
		}
		if (
			idParts.some((part: any) => {
				const value = String(part).toLowerCase();
				return value.includes("humanmessage") || value.includes("usermessage");
			})
		) {
			return false;
		}
	}

	// Most on_chat_model_stream payloads are assistant chunks; if they are
	// untyped, allow them unless we explicitly detect a non-AI role/type.
	return true;
}

function normalizeMessagesFromChunk(chunk: any): MessageEntry[] {
	if (!chunk || typeof chunk !== "object") {
		return [];
	}

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
	if (
		typeof msg.type === "string" &&
		msg.type.toLowerCase() !== "constructor"
	) {
		return msg.type;
	}

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

function looksLikeModelFailureText(text: string): boolean {
	const normalized = text.toLowerCase();
	return (
		normalized.includes("model call failed") ||
		(normalized.includes("failed after") && normalized.includes("error:"))
	);
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

function isHumanMessageType(normalizedType: string): boolean {
	return (
		normalizedType === "human" ||
		normalizedType === "user" ||
		normalizedType === "humanmessage" ||
		normalizedType === "usermessage" ||
		normalizedType === "humanmessagechunk" ||
		normalizedType === "usermessagechunk"
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

	const tagNode =
		extractNodeFromTagList(meta.tags) || extractNodeFromTagList(meta.ls_tags);
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
	if (typeof content === "string")
		return content.length > 0 ? content : undefined;
	if (Array.isArray(content)) {
		const blocks = content
			.filter((block: any) => block && block.type === "text" && block.text)
			.map((block: any) => block.text);
		return blocks.length > 0 ? blocks.join("") : undefined;
	}
	return undefined;
}

function extractAttachmentsFromMessage(message: any): Array<{
	kind: "image" | "audio" | "file";
	dataUrl: string;
	textContent?: string;
	name?: string;
	mimeType?: string;
	size?: number;
}> {
	if (!message || typeof message !== "object") return [];
	const content =
		message.content ??
		message?.kwargs?.content ??
		message?.additional_kwargs?.content;
	const blocks = extractAttachmentBlocks(content);
	if (blocks.length === 0) return [];

	const attachments: Array<{
		kind: "image" | "audio" | "file";
		dataUrl: string;
		textContent?: string;
		name?: string;
		mimeType?: string;
		size?: number;
	}> = [];
	for (const block of blocks) {
		const parsed = extractAttachmentFromBlock(block);
		if (parsed) {
			attachments.push(parsed);
		}
	}
	return attachments;
}

function extractAttachmentBlocks(
	value: unknown,
): Array<Record<string, unknown>> {
	if (Array.isArray(value)) {
		return value
			.filter(
				(entry): entry is Record<string, unknown> =>
					Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
			)
			.map((entry) => entry as Record<string, unknown>);
	}
	if (typeof value === "string") {
		const parsed = tryParseJson(value);
		return parsed !== null ? extractAttachmentBlocks(parsed) : [];
	}
	if (!value || typeof value !== "object") {
		return [];
	}
	const record = value as Record<string, unknown>;
	if (Array.isArray(record.content)) {
		return extractAttachmentBlocks(record.content);
	}
	if (typeof record.content === "string") {
		return extractAttachmentBlocks(record.content);
	}
	return [];
}

function extractAttachmentFromBlock(block: Record<string, unknown>): {
	kind: "image" | "audio" | "file";
	dataUrl: string;
	textContent?: string;
	name?: string;
	mimeType?: string;
	size?: number;
} | null {
	const imageUrl = extractImageUrl(block);
	if (imageUrl) {
		return {
			kind: "image",
			dataUrl: imageUrl,
			name: extractString(block.name),
			mimeType: extractString(block.mimeType, block.mime_type),
			size: extractNumber(block.size),
		};
	}

	const audioUrl = extractAudioUrl(block);
	if (audioUrl) {
		return {
			kind: "audio",
			dataUrl: audioUrl,
			name: extractString(block.name),
			mimeType: extractString(block.mimeType, block.mime_type),
			size: extractNumber(block.size),
		};
	}

	const file = extractFileAttachment(block);
	if (file) {
		return file;
	}

	return null;
}

function extractImageUrl(block: Record<string, unknown>): string | null {
	if (block.type === "image_url") {
		const imageUrl = block.image_url;
		if (typeof imageUrl === "string") return imageUrl;
		if (
			imageUrl &&
			typeof imageUrl === "object" &&
			typeof (imageUrl as Record<string, unknown>).url === "string"
		) {
			return (imageUrl as Record<string, unknown>).url as string;
		}
	}
	if (block.type === "input_image" || block.type === "output_image") {
		const imageUrl = block.image_url;
		if (typeof imageUrl === "string") return imageUrl;
		if (
			imageUrl &&
			typeof imageUrl === "object" &&
			typeof (imageUrl as Record<string, unknown>).url === "string"
		) {
			return (imageUrl as Record<string, unknown>).url as string;
		}
		if (typeof block.url === "string") return block.url;
	}
	if (block.type === "image") {
		const source =
			block.source && typeof block.source === "object"
				? (block.source as Record<string, unknown>)
				: undefined;
		const sourceMediaType = extractString(
			source?.media_type,
			source?.mediaType,
		);
		const sourceData = extractString(source?.data);
		if (sourceMediaType && sourceData) {
			return `data:${sourceMediaType};base64,${sourceData}`;
		}

		const sourceType = extractString(block.source_type, block.sourceType);
		const mimeType =
			extractString(
				block.mime_type,
				block.mimeType,
				block.media_type,
				block.mediaType,
			) || "image/png";
		if (sourceType === "base64" && typeof block.data === "string") {
			return `data:${mimeType};base64,${block.data}`;
		}
		if (sourceType === "url" && typeof block.url === "string") {
			return block.url;
		}
		if (typeof block.data === "string") {
			return `data:${mimeType};base64,${block.data}`;
		}
	}
	if (block.type === "resource_link") {
		const mimeType = extractString(block.mimeType)?.toLowerCase() || "";
		const uri = extractString(block.uri);
		if (uri && (!mimeType || mimeType.startsWith("image/"))) {
			return uri;
		}
	}
	if (block.type === "resource" && block.resource) {
		const resource =
			typeof block.resource === "object"
				? (block.resource as Record<string, unknown>)
				: undefined;
		if (!resource) return null;
		const mimeType = extractString(resource.mimeType)?.toLowerCase() || "";
		if (!mimeType || !mimeType.startsWith("image/")) return null;
		const blob = extractString(resource.blob);
		if (blob) {
			return `data:${mimeType};base64,${blob}`;
		}
		const uri = extractString(resource.uri);
		if (uri) return uri;
	}
	return null;
}

function extractAudioUrl(block: Record<string, unknown>): string | null {
	if (block.type === "audio_url") {
		const audioUrl = block.audio_url;
		if (typeof audioUrl === "string") return audioUrl;
		if (
			audioUrl &&
			typeof audioUrl === "object" &&
			typeof (audioUrl as Record<string, unknown>).url === "string"
		) {
			return (audioUrl as Record<string, unknown>).url as string;
		}
	}
	if (block.type === "input_audio") {
		const input =
			block.input_audio && typeof block.input_audio === "object"
				? (block.input_audio as Record<string, unknown>)
				: block.audio && typeof block.audio === "object"
					? (block.audio as Record<string, unknown>)
					: undefined;
		const data = extractString(input?.data);
		const format = extractString(input?.format);
		if (data) {
			const mimeType = format ? resolveAudioMimeType(format) : "audio/wav";
			return `data:${mimeType};base64,${data}`;
		}
	}
	if (block.type === "audio") {
		const source =
			block.source && typeof block.source === "object"
				? (block.source as Record<string, unknown>)
				: undefined;
		const sourceMediaType = extractString(
			source?.media_type,
			source?.mediaType,
		);
		const sourceData = extractString(source?.data);
		if (sourceMediaType && sourceData) {
			return `data:${sourceMediaType};base64,${sourceData}`;
		}

		const sourceType = extractString(block.source_type, block.sourceType);
		if (sourceType === "base64" && typeof block.data === "string") {
			const rawFormat = extractString(
				block.mime_type,
				block.media_type,
				block.mediaType,
				block.format,
			);
			const mimeType =
				rawFormat && rawFormat.includes("/")
					? rawFormat
					: rawFormat
						? resolveAudioMimeType(rawFormat)
						: "audio/wav";
			return `data:${mimeType};base64,${block.data}`;
		}
		if (sourceType === "url" && typeof block.url === "string") {
			return block.url;
		}
	}
	return null;
}

function extractFileAttachment(block: Record<string, unknown>): {
	kind: "file";
	dataUrl: string;
	textContent?: string;
	name?: string;
	mimeType?: string;
	size?: number;
} | null {
	if (block.type === "file") {
		const sourceType = extractString(block.source_type, block.sourceType);
		const metadata =
			block.metadata && typeof block.metadata === "object"
				? (block.metadata as Record<string, unknown>)
				: {};
		const name = extractString(
			block.name,
			block.filename,
			metadata.filename,
			metadata.name,
			metadata.title,
		);
		const declaredMime = extractString(
			block.mime_type,
			block.mimeType,
			block.media_type,
			block.mediaType,
		);
		if (sourceType === "base64" && typeof block.data === "string") {
			const mimeType = declaredMime || "application/octet-stream";
			return {
				kind: "file",
				dataUrl: `data:${mimeType};base64,${block.data}`,
				name,
				mimeType,
				size: extractNumber(block.size),
				textContent: extractString(block.text, block.textContent),
			};
		}
		if (sourceType === "url" && typeof block.url === "string") {
			const mimeType = declaredMime || parseDataUrlMime(block.url);
			return {
				kind: "file",
				dataUrl: block.url,
				name,
				mimeType,
				size: extractNumber(block.size),
				textContent: extractString(block.text, block.textContent),
			};
		}
	}

	if (block.type === "input_file") {
		const dataUrl = extractString(block.file_data, block.file_url);
		if (!dataUrl) return null;
		return {
			kind: "file",
			dataUrl,
			name: extractString(block.filename),
			mimeType: parseDataUrlMime(dataUrl),
			size: extractNumber(block.size),
			textContent: extractString(block.text, block.textContent),
		};
	}

	if (
		block.type === "document" &&
		block.source &&
		typeof block.source === "object"
	) {
		const source = block.source as Record<string, unknown>;
		const sourceType = extractString(source.type);
		const name = extractString(block.title);
		if (sourceType === "base64" && typeof source.data === "string") {
			const mimeType = extractString(source.media_type) || "application/pdf";
			return {
				kind: "file",
				dataUrl: `data:${mimeType};base64,${source.data}`,
				name,
				mimeType,
				size: extractNumber(block.size),
				textContent: extractString(block.text, block.textContent),
			};
		}
		if (sourceType === "url" && typeof source.url === "string") {
			return {
				kind: "file",
				dataUrl: source.url,
				name,
				mimeType: parseDataUrlMime(source.url),
				size: extractNumber(block.size),
				textContent: extractString(block.text, block.textContent),
			};
		}
	}

	return null;
}

function resolveAudioMimeType(format: string): string {
	const normalized = format.toLowerCase();
	switch (normalized) {
		case "mp3":
		case "mpeg":
			return "audio/mpeg";
		case "wav":
			return "audio/wav";
		case "m4a":
		case "mp4":
			return "audio/mp4";
		case "ogg":
			return "audio/ogg";
		case "webm":
			return "audio/webm";
		default:
			return `audio/${normalized}`;
	}
}

function parseDataUrlMime(dataUrl?: string): string | undefined {
	if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
		return undefined;
	}
	const match = dataUrl.match(/^data:([^;,]+)[;,]/i);
	return match?.[1];
}

function extractString(...values: unknown[]): string | undefined {
	for (const value of values) {
		if (typeof value === "string" && value.trim().length > 0) {
			return value.trim();
		}
	}
	return undefined;
}

function extractNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value)
		? value
		: undefined;
}

function tryParseJson(value: string): unknown | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
		return null;
	}
	try {
		return JSON.parse(trimmed);
	} catch {
		return null;
	}
}

const INTERNAL_TOOL_ENVELOPE_MARKERS: RegExp[] = [
	/\bassistant\s+to=[a-z0-9_.:-]+\b/i,
	/\bto=multi_tool_use(?:\.[a-z_]+)?\b/i,
	/"tool_uses"\s*:\s*\[/i,
	/"recipient_name"\s*:\s*"functions\.[^"]+"/i,
	/"parameters"\s*:\s*\{/i,
	/\bcommentary\s+json\b/i,
];

function sanitizeDisplayText(text: string | undefined): string | undefined {
	if (typeof text !== "string") return undefined;
	const cleanedText = stripDisplayNoise(text);
	if (cleanedText.trim().length === 0) return undefined;

	let envelopeStart = -1;
	for (const marker of INTERNAL_TOOL_ENVELOPE_MARKERS) {
		const index = cleanedText.search(marker);
		if (index < 0) continue;
		envelopeStart = envelopeStart < 0 ? index : Math.min(envelopeStart, index);
	}

	if (envelopeStart === 0 && isLikelyInternalToolEnvelope(cleanedText)) {
		return undefined;
	}

	if (
		envelopeStart > 0 &&
		isLikelyInternalToolEnvelope(cleanedText.slice(envelopeStart))
	) {
		const prefix = stripDisplayNoise(cleanedText.slice(0, envelopeStart));
		return prefix.length > 0 ? prefix : undefined;
	}

	return cleanedText;
}

function sanitizeDeltaDisplayText(
	text: string | undefined,
): string | undefined {
	if (typeof text !== "string") return undefined;
	const normalized = normalizeDeltaWhitespace(text);
	if (normalized.length === 0) return undefined;
	if (normalized.trim().length === 0) {
		// Preserve pure whitespace deltas so streamed paragraph/list breaks survive.
		return normalized;
	}

	const trailingMatch = normalized.match(/\s+$/);
	const trailingWhitespace = trailingMatch ? trailingMatch[0] : "";
	const content =
		trailingWhitespace.length > 0
			? normalized.slice(0, -trailingWhitespace.length)
			: normalized;
	const cleanedContent = sanitizeDisplayText(content);
	if (!cleanedContent) return undefined;
	return trailingWhitespace
		? `${cleanedContent}${trailingWhitespace}`
		: cleanedContent;
}

function normalizeDeltaWhitespace(value: string): string {
	let output = normalizeLineBreakChars(value);
	output = stripAsciiControlChars(output);
	output = output.replace(/\uFFFD/g, "");
	return output;
}

function isLikelyInternalToolEnvelope(value: string): boolean {
	if (value.trim().length === 0) return false;
	if (/^\s*assistant\s+to=[a-z0-9_.:-]+\b/i.test(value)) return true;
	if (
		/^\s*\{[\s\S]*"tool_uses"\s*:\s*\[[\s\S]*"recipient_name"\s*:\s*"functions\.[^"]+"/i.test(
			value,
		)
	) {
		return true;
	}

	let markerCount = 0;
	for (const marker of INTERNAL_TOOL_ENVELOPE_MARKERS) {
		if (marker.test(value)) markerCount += 1;
	}
	return markerCount >= 2;
}

function stripDisplayNoise(value: string): string {
	let output = normalizeLineBreakChars(value);
	output = stripAsciiControlChars(output);
	output = output.replace(/\uFFFD/g, "");
	output = stripTrailingSymbolNoise(output);
	return output.replace(/\s+$/, "");
}

function stripTrailingSymbolNoise(value: string): string {
	const lines = value.split("\n");
	while (lines.length > 0) {
		const tail = lines[lines.length - 1]?.trim() || "";
		if (!tail) {
			lines.pop();
			continue;
		}
		if (isSymbolNoiseToken(tail)) {
			lines.pop();
			continue;
		}
		break;
	}

	let output = lines.join("\n");
	output = output.replace(/(^|[\s.,;:!?()[\]{}'"-])[#+]{6,}\s*$/g, "$1");
	return output.replace(/\s+$/, "");
}

function isSymbolNoiseToken(value: string): boolean {
	return value.length >= 6 && /^[#+]+$/.test(value);
}

function normalizeLineBreakChars(value: string): string {
	return value
		.replace(/\r\n?/g, "\n")
		.replace(/[\u0085\u2028\u2029\u21B5\u23CE\u240A\u2424]/g, "\n");
}

function stripAsciiControlChars(value: string): string {
	let output = "";
	for (const char of value) {
		const code = char.charCodeAt(0);
		const isControl = (code >= 0x00 && code <= 0x1f) || code === 0x7f;
		const isAllowedWhitespace = code === 0x09 || code === 0x0a || code === 0x0d;
		if (isControl && !isAllowedWhitespace) continue;
		output += char;
	}
	return output;
}

function extractToolCalls(msg: any, messageId?: string): NormalizedToolCall[] {
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

function splitUiPayload(payload: any): {
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
		msg?.tool_call_id ??
		msg?.kwargs?.tool_call_id ??
		msg?.additional_kwargs?.tool_call_id;
	if (!toolCallId) return null;

	return {
		id: toolCallId,
		name: msg?.name ?? msg?.kwargs?.name ?? msg?.additional_kwargs?.name,
		output: msg?.content ?? msg?.kwargs?.content ?? "",
		error: msg?.kwargs?.error ?? msg?.additional_kwargs?.error,
	};
}
