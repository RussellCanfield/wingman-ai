import { parseStreamEvents } from "../../../../shared/chat/streaming";
import { invokeTauri } from "./tauriBridge.js";

const SMS_TARGET_PREFIX = "sms-macos:";
const DEFAULT_REPLY_SEGMENT_LENGTH = 700;

export type MacosInboundMessage = {
	rowId: number;
	handle: string;
	text: string;
};

export function buildSmsTargetForHandle(handle: string): string | null {
	const trimmed = handle.trim();
	if (!trimmed) return null;
	return `${SMS_TARGET_PREFIX}${trimmed}`;
}

export function parseHandleFromSmsTarget(target: string): string | null {
	const trimmed = target.trim();
	if (!trimmed.startsWith(SMS_TARGET_PREFIX)) return null;
	const handle = trimmed.slice(SMS_TARGET_PREFIX.length).trim();
	return handle || null;
}

export function mergeSmsBridgeStreamText(
	existing: string,
	incoming: string,
	isDelta?: boolean,
): string {
	if (!incoming) return existing;
	if (isDelta) {
		if (incoming.startsWith(existing)) return incoming;
		return existing + incoming;
	}
	if (!existing.trim()) return incoming;
	return `${existing}\n${incoming}`;
}

export function appendAgentEventText(existing: string, payload: unknown): string {
	const parsed = parseStreamEvents(payload);
	let next = existing;
	for (const textEvent of parsed.textEvents) {
		next = mergeSmsBridgeStreamText(next, textEvent.text, textEvent.isDelta);
	}
	return next;
}

export function extractAgentTerminalText(payload: unknown): string {
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		return "";
	}
	const content =
		typeof (payload as { content?: unknown }).content === "string"
			? (payload as { content: string }).content.trim()
			: "";
	return content;
}

export function splitSmsBridgeReply(
	text: string,
	maxChars = DEFAULT_REPLY_SEGMENT_LENGTH,
): string[] {
	const trimmed = text.trim();
	if (!trimmed) return [];
	const limit = Number.isFinite(maxChars)
		? Math.max(80, Math.trunc(maxChars))
		: DEFAULT_REPLY_SEGMENT_LENGTH;
	if (trimmed.length <= limit) return [trimmed];

	const parts: string[] = [];
	let cursor = trimmed;
	while (cursor.length > limit) {
		const window = cursor.slice(0, limit);
		const breakIndex = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(" "));
		const splitAt = breakIndex >= Math.floor(limit * 0.5) ? breakIndex : limit;
		parts.push(cursor.slice(0, splitAt).trim());
		cursor = cursor.slice(splitAt).trimStart();
	}
	if (cursor) {
		parts.push(cursor);
	}
	return parts.filter((part) => part.length > 0);
}

export async function getMacosMessagesLatestRowId(): Promise<number | null> {
	const value = await invokeTauri<number>("get_macos_messages_latest_row_id");
	if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
		return null;
	}
	return Math.trunc(value);
}

export async function pollMacosMessages(params: {
	afterRowId: number;
	limit?: number;
}): Promise<MacosInboundMessage[]> {
	const afterRowId = Math.max(0, Math.trunc(params.afterRowId || 0));
	const limit = Math.min(200, Math.max(1, Math.trunc(params.limit ?? 20)));
	const raw = await invokeTauri<unknown[]>("poll_macos_messages", {
		afterRowId,
		limit,
	});
	if (!Array.isArray(raw)) return [];

	const messages: MacosInboundMessage[] = [];
	for (const entry of raw) {
		if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
		const rowId =
			typeof (entry as { rowId?: unknown }).rowId === "number"
				? Math.trunc((entry as { rowId: number }).rowId)
				: NaN;
		const handle =
			typeof (entry as { handle?: unknown }).handle === "string"
				? (entry as { handle: string }).handle.trim()
				: "";
		const text =
			typeof (entry as { text?: unknown }).text === "string"
				? (entry as { text: string }).text.trim()
				: "";
		if (!Number.isFinite(rowId) || rowId <= 0 || !handle || !text) continue;
		messages.push({ rowId, handle, text });
	}
	return messages;
}

export async function sendMacosMessage(args: {
	handle: string;
	text: string;
}): Promise<void> {
	const handle = args.handle.trim();
	const text = args.text.trim();
	if (!handle || !text) return;
	await invokeTauri<void>("send_macos_message", {
		handle,
		text,
	});
}
