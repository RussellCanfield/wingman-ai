export function isLocallyTrackedRequest(input: {
	requestId: string;
	pendingRequestIds: Set<string>;
	activeRequestId: string | null;
}): boolean {
	return (
		input.pendingRequestIds.has(input.requestId) ||
		input.activeRequestId === input.requestId
	);
}

export function resolveTerminalRequestId(input: {
	requestId: string;
	pendingRequestIds: Set<string>;
	activeRequestId: string | null;
}): string {
	if (isLocallyTrackedRequest(input)) {
		return input.requestId;
	}

	const { activeRequestId, pendingRequestIds } = input;
	if (activeRequestId && pendingRequestIds.has(activeRequestId)) {
		return activeRequestId;
	}

	if (pendingRequestIds.size === 1) {
		const onlyPending = pendingRequestIds.values().next().value;
		if (typeof onlyPending === "string" && onlyPending.length > 0) {
			return onlyPending;
		}
	}

	return input.requestId;
}
