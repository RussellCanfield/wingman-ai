const ACTIVE_REQUEST_EVENT_TYPES = new Set([
	"agent-start",
	"agent-stream",
	"agent-complete",
	"agent-error",
]);

export function shouldMarkRequestActive(payloadType: unknown): boolean {
	if (typeof payloadType !== "string") return false;
	return ACTIVE_REQUEST_EVENT_TYPES.has(payloadType);
}
