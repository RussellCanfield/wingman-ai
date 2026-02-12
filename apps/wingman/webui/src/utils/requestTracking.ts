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
