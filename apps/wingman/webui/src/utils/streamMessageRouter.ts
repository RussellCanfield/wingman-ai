export type RequestStreamState = {
	activeMessageId: string;
	activeKind?: "text" | "tool";
	messageIds: string[];
	nextSegmentIndex: number;
	runMessageIds: Map<string, string>;
};

export type RequestStreamMessageMap = Map<string, RequestStreamState>;

export type ResolveTextMessageTargetParams = {
	state: RequestStreamMessageMap;
	requestId: string;
	fallbackMessageId: string;
};

export type ResolveToolMessageTargetParams = {
	state: RequestStreamMessageMap;
	requestId: string;
	fallbackMessageId: string;
	runId?: string;
	parentRunIds?: string[];
};

const normalizeRunKey = (value?: string): string | undefined => {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : undefined;
};

const buildSegmentMessageId = (requestId: string, segmentIndex: number): string =>
	`${requestId}:segment-${segmentIndex}`;

const ensureRequestState = (
	state: RequestStreamMessageMap,
	requestId: string,
	fallbackMessageId: string,
): RequestStreamState => {
	const existing = state.get(requestId);
	if (existing) {
		if (!existing.messageIds.includes(fallbackMessageId)) {
			existing.messageIds.unshift(fallbackMessageId);
		}
		return existing;
	}

	const next: RequestStreamState = {
		activeMessageId: fallbackMessageId,
		messageIds: [fallbackMessageId],
		nextSegmentIndex: 0,
		runMessageIds: new Map(),
	};
	state.set(requestId, next);
	return next;
};

const startNextSegment = (
	requestState: RequestStreamState,
	requestId: string,
): string => {
	requestState.nextSegmentIndex += 1;
	const messageId = buildSegmentMessageId(
		requestId,
		requestState.nextSegmentIndex,
	);
	requestState.activeMessageId = messageId;
	requestState.messageIds.push(messageId);
	return messageId;
};

const resolveExistingToolMessageId = (
	requestState: RequestStreamState,
	runId?: string,
	parentRunIds?: string[],
): string | undefined => {
	const normalizedRunId = normalizeRunKey(runId);
	if (normalizedRunId) {
		const existing = requestState.runMessageIds.get(normalizedRunId);
		if (existing) {
			return existing;
		}
	}

	if (!Array.isArray(parentRunIds)) {
		return undefined;
	}

	for (const parentRunId of parentRunIds) {
		const normalizedParentRunId = normalizeRunKey(parentRunId);
		if (!normalizedParentRunId) continue;
		const existing = requestState.runMessageIds.get(normalizedParentRunId);
		if (!existing) continue;
		if (normalizedRunId) {
			requestState.runMessageIds.set(normalizedRunId, existing);
		}
		return existing;
	}

	return undefined;
};

export const getRequestMessageTargetIds = (
	state: RequestStreamMessageMap,
	requestId: string,
	fallbackMessageId: string,
): string[] => {
	const requestState = state.get(requestId);
	if (!requestState) {
		return [fallbackMessageId];
	}
	if (!requestState.messageIds.includes(fallbackMessageId)) {
		return [fallbackMessageId, ...requestState.messageIds];
	}
	return [...requestState.messageIds];
};

export const resolveTextMessageTargetId = (
	params: ResolveTextMessageTargetParams,
): string => {
	const requestState = ensureRequestState(
		params.state,
		params.requestId,
		params.fallbackMessageId,
	);
	requestState.activeKind = "text";
	return requestState.activeMessageId;
};

export const resolveToolMessageTargetId = (
	params: ResolveToolMessageTargetParams,
): string => {
	const requestState = ensureRequestState(
		params.state,
		params.requestId,
		params.fallbackMessageId,
	);
	const existingMessageId = resolveExistingToolMessageId(
		requestState,
		params.runId,
		params.parentRunIds,
	);
	if (existingMessageId) {
		return existingMessageId;
	}

	if (requestState.activeKind === "text") {
		startNextSegment(requestState, params.requestId);
	}

	requestState.activeKind = "tool";
	const normalizedRunId = normalizeRunKey(params.runId);
	if (normalizedRunId) {
		requestState.runMessageIds.set(normalizedRunId, requestState.activeMessageId);
	}
	return requestState.activeMessageId;
};

export const clearStreamMessageTargets = (
	state: RequestStreamMessageMap,
	requestId: string,
): void => {
	state.delete(requestId);
};
