type GatewayErrorResolutionInput = {
	messageId?: string;
	payload: unknown;
	pendingRequestIds: Set<string>;
	activeRequestId: string | null;
};

function normalizeNonEmptyString(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
}

function isTrackedRequestId(
	requestId: string,
	pendingRequestIds: Set<string>,
	activeRequestId: string | null,
): boolean {
	return pendingRequestIds.has(requestId) || activeRequestId === requestId;
}

export function extractGatewayErrorMessage(payload: unknown): string | undefined {
	const direct = normalizeNonEmptyString(payload);
	if (direct) return direct;

	const record = asRecord(payload);
	if (!record) return undefined;

	const details = asRecord(record.details);
	const candidates = [
		record.message,
		record.error,
		details?.message,
		details?.error,
	];

	for (const candidate of candidates) {
		const text = normalizeNonEmptyString(candidate);
		if (text) return text;
	}

	return undefined;
}

export function resolveTrackedGatewayErrorRequestId(
	input: GatewayErrorResolutionInput,
): string | undefined {
	const payloadRecord = asRecord(input.payload);
	const details = payloadRecord ? asRecord(payloadRecord.details) : null;
	const candidates = [
		input.messageId,
		normalizeNonEmptyString(payloadRecord?.requestId),
		normalizeNonEmptyString(payloadRecord?.request_id),
		normalizeNonEmptyString(payloadRecord?.id),
		normalizeNonEmptyString(details?.requestId),
		normalizeNonEmptyString(details?.request_id),
		normalizeNonEmptyString(details?.id),
	];

	for (const candidate of candidates) {
		const requestId = normalizeNonEmptyString(candidate);
		if (!requestId) continue;
		if (
			isTrackedRequestId(
				requestId,
				input.pendingRequestIds,
				input.activeRequestId,
			)
		) {
			return requestId;
		}
	}

	if (
		input.activeRequestId &&
		input.pendingRequestIds.has(input.activeRequestId)
	) {
		return input.activeRequestId;
	}

	if (input.pendingRequestIds.size === 1) {
		const onlyPending = input.pendingRequestIds.values().next().value;
		if (typeof onlyPending === "string" && onlyPending.trim().length > 0) {
			return onlyPending;
		}
	}

	return undefined;
}
