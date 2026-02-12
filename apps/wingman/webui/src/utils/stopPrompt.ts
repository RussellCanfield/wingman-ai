import type { GatewayMessage } from "../types";

export const resolveStoppableRequestId = (input: {
	activeRequestId: string | null;
	pendingRequestIds: Set<string>;
}): string | null => {
	if (input.activeRequestId) return input.activeRequestId;
	const fallback = input.pendingRequestIds.values().next().value;
	return typeof fallback === "string" ? fallback : null;
};

export const buildCancelGatewayMessage = (
	requestId: string,
	now: number,
): GatewayMessage => {
	return {
		type: "req:agent:cancel",
		id: `cancel-${requestId}-${now}`,
		payload: { requestId },
		timestamp: now,
	};
};
