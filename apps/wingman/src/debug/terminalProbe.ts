export type TerminalProbeEventType =
	| "agent-start"
	| "request-queued"
	| "agent-complete"
	| "agent-error";

export type TerminalProbeEvent = {
	type: TerminalProbeEventType;
	requestId: string;
	sessionId?: string;
	error?: string;
	timestampIso: string;
};

const DEFAULT_EVENT_TYPES = new Set<TerminalProbeEventType>([
	"agent-complete",
	"agent-error",
]);

const VERBOSE_EVENT_TYPES = new Set<TerminalProbeEventType>([
	"agent-start",
	"request-queued",
]);

export function shouldReportTerminalProbeEvent(
	payloadType: unknown,
	verbose = false,
): payloadType is TerminalProbeEventType {
	if (typeof payloadType !== "string") return false;
	if (DEFAULT_EVENT_TYPES.has(payloadType as TerminalProbeEventType)) {
		return true;
	}
	if (!verbose) return false;
	return VERBOSE_EVENT_TYPES.has(payloadType as TerminalProbeEventType);
}

export function formatTerminalProbeEvent(event: TerminalProbeEvent): string {
	const scope = event.sessionId ? `session=${event.sessionId}` : "session=-";
	const errorSuffix =
		event.type === "agent-error" && event.error
			? ` error=${JSON.stringify(event.error)}`
			: "";
	return `[terminal-probe] ${event.timestampIso} type=${event.type} req=${event.requestId} ${scope}${errorSuffix}`;
}
