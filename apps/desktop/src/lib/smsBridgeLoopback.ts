export type SmsBridgeLoopbackRecord = {
	handle: string;
	text: string;
	sentAt: number;
};

type LoopbackOptions = {
	now?: number;
	ttlMs?: number;
	maxRecords?: number;
};

const DEFAULT_TTL_MS = 2 * 60 * 1000;
const DEFAULT_MAX_RECORDS = 300;

function normalizeHandle(value: string): string {
	return value.trim().toLowerCase();
}

export function normalizeSmsBridgeComparableText(value: string): string {
	return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function isSmsBridgeSelfEcho(params: {
	inboundText: string;
	outboundText: string;
}): boolean {
	const inbound = normalizeSmsBridgeComparableText(params.inboundText);
	const outbound = normalizeSmsBridgeComparableText(params.outboundText);
	if (!inbound || !outbound) return false;
	return inbound === outbound;
}

function normalizeEntry(input: {
	handle: string;
	text: string;
}): SmsBridgeLoopbackRecord | null {
	const handle = normalizeHandle(input.handle);
	const text = normalizeSmsBridgeComparableText(input.text);
	if (!handle || !text) return null;
	return {
		handle,
		text,
		sentAt: 0,
	};
}

function resolveOptions(options: LoopbackOptions): Required<LoopbackOptions> {
	const now = typeof options.now === "number" ? options.now : Date.now();
	const ttlMs =
		typeof options.ttlMs === "number" && Number.isFinite(options.ttlMs)
			? Math.max(1, Math.trunc(options.ttlMs))
			: DEFAULT_TTL_MS;
	const maxRecords =
		typeof options.maxRecords === "number" &&
		Number.isFinite(options.maxRecords)
			? Math.max(1, Math.trunc(options.maxRecords))
			: DEFAULT_MAX_RECORDS;
	return { now, ttlMs, maxRecords };
}

function pruneRecords(
	records: SmsBridgeLoopbackRecord[],
	now: number,
	ttlMs: number,
): SmsBridgeLoopbackRecord[] {
	return records.filter((record) => now - record.sentAt <= ttlMs);
}

export function rememberSmsBridgeOutbound(
	records: SmsBridgeLoopbackRecord[],
	input: { handle: string; text: string },
	options: LoopbackOptions = {},
): SmsBridgeLoopbackRecord[] {
	const { now, ttlMs, maxRecords } = resolveOptions(options);
	const next = pruneRecords(records, now, ttlMs);
	const normalized = normalizeEntry(input);
	if (!normalized) return next;
	next.push({
		...normalized,
		sentAt: now,
	});
	if (next.length <= maxRecords) return next;
	return next.slice(next.length - maxRecords);
}

export function consumeSmsBridgeLoopback(
	records: SmsBridgeLoopbackRecord[],
	input: { handle: string; text: string },
	options: LoopbackOptions = {},
): { matched: boolean; records: SmsBridgeLoopbackRecord[] } {
	const { now, ttlMs } = resolveOptions(options);
	const next = pruneRecords(records, now, ttlMs);
	const normalized = normalizeEntry(input);
	if (!normalized) {
		return { matched: false, records: next };
	}
	const index = next.findIndex(
		(record) =>
			record.handle === normalized.handle && record.text === normalized.text,
	);
	if (index < 0) {
		return { matched: false, records: next };
	}
	next.splice(index, 1);
	return { matched: true, records: next };
}
