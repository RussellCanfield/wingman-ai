type RequestStreamMessageMap = Map<string, Map<string, string>>;

export type ResolveTextMessageTargetParams = {
	state: RequestStreamMessageMap;
	requestId: string;
	fallbackMessageId: string;
	streamMessageId?: string;
	isDelta?: boolean;
	eventKey?: string;
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

const hashKey = (value: string): string => {
	let hash = 5381;
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash * 33) ^ value.charCodeAt(index);
	}
	return (hash >>> 0).toString(36);
};

const buildDerivedMessageId = (requestId: string, runKey: string): string =>
	`${requestId}:run-${hashKey(runKey)}`;

const getRequestMap = (
	state: RequestStreamMessageMap,
	requestId: string,
): Map<string, string> => {
	const existing = state.get(requestId);
	if (existing) return existing;
	const next = new Map<string, string>();
	state.set(requestId, next);
	return next;
};

const resolveOrCreateTarget = (
	state: RequestStreamMessageMap,
	requestId: string,
	fallbackMessageId: string,
	runKey?: string,
): string => {
	if (!runKey) return fallbackMessageId;
	const requestMap = getRequestMap(state, requestId);
	const existing = requestMap.get(runKey);
	if (existing) return existing;
	if (requestMap.size === 0) {
		requestMap.set(runKey, fallbackMessageId);
		return fallbackMessageId;
	}
	const derivedId =
		runKey === fallbackMessageId
			? fallbackMessageId
			: buildDerivedMessageId(requestId, runKey);
	requestMap.set(runKey, derivedId);
	return derivedId;
};

export const resolveTextMessageTargetId = (
	params: ResolveTextMessageTargetParams,
): string => {
	const normalizedEventKey = normalizeRunKey(params.eventKey);
	if (!params.isDelta && normalizedEventKey) {
		return resolveOrCreateTarget(
			params.state,
			params.requestId,
			params.fallbackMessageId,
			`event:${normalizedEventKey}`,
		);
	}

	const explicitRunKey = normalizeRunKey(params.streamMessageId);
	if (explicitRunKey) {
		return resolveOrCreateTarget(
			params.state,
			params.requestId,
			params.fallbackMessageId,
			explicitRunKey,
		);
	}

	// Token deltas without stable IDs should continue the active message.
	if (params.isDelta) {
		return params.fallbackMessageId;
	}

	if (!normalizedEventKey) {
		return params.fallbackMessageId;
	}
	return resolveOrCreateTarget(
		params.state,
		params.requestId,
		params.fallbackMessageId,
		`event:${normalizedEventKey}`,
	);
};

export const resolveToolMessageTargetId = (
	params: ResolveToolMessageTargetParams,
): string => {
	const runKey = normalizeRunKey(params.runId);
	const requestMap = params.state.get(params.requestId);
	if (requestMap && runKey) {
		const existing = requestMap.get(runKey);
		if (existing) return existing;
	}
	if (requestMap && Array.isArray(params.parentRunIds)) {
		for (const parentId of params.parentRunIds) {
			const normalizedParent = normalizeRunKey(parentId);
			if (!normalizedParent) continue;
			const existing = requestMap.get(normalizedParent);
			if (existing) {
				if (runKey) {
					requestMap.set(runKey, existing);
				}
				return existing;
			}
		}
	}

	return resolveOrCreateTarget(
		params.state,
		params.requestId,
		params.fallbackMessageId,
		runKey,
	);
};

export const clearStreamMessageTargets = (
	state: RequestStreamMessageMap,
	requestId: string,
): void => {
	state.delete(requestId);
};
