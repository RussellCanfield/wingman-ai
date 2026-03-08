import type { ChatAttachment, ChatMessage, Thread } from "../types";
import { sanitizeAssistantDisplayText } from "./internalToolEnvelope";
import { randomUuid } from "./randomUuid";

type SessionSummary = {
	id: string;
	name: string;
	agentId: string;
	createdAt: number;
	updatedAt?: number;
	messageCount?: number;
	lastMessagePreview?: string;
	workdir?: string | null;
};

type UnknownAttachmentMessage = ChatMessage & {
	attachments?: unknown;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
	if (!value || typeof value !== "object") return null;
	return value as Record<string, unknown>;
};

const isAssistantPlaceholder = (message: ChatMessage): boolean => {
	return (
		message.role === "assistant" &&
		!message.content.trim() &&
		!message.uiTextFallback &&
		(!message.attachments || message.attachments.length === 0) &&
		(!message.toolEvents || message.toolEvents.length === 0) &&
		(!message.thinkingEvents || message.thinkingEvents.length === 0) &&
		(!message.activityTimeline || message.activityTimeline.length === 0) &&
		(!message.uiBlocks || message.uiBlocks.length === 0)
	);
};

const createAttachmentId = (): string => randomUuid();

export function normalizeName(value: string): string {
	return value.trim().toLowerCase();
}

export function extractTaskSubagentType(value: unknown): string | undefined {
	const record = asRecord(value);
	if (!record) return undefined;
	const direct =
		record.subagent_type ??
		record.subagentType ??
		record.subagent ??
		record.subAgent;
	if (typeof direct === "string" && direct.trim()) {
		return direct.trim();
	}
	return undefined;
}

export function upsertAssistantMessage(
	thread: Thread,
	messageId: string,
	update: (message: ChatMessage) => ChatMessage,
	placeholderId?: string,
): Thread {
	let found = false;
	const nextMessages = thread.messages.map((message) => {
		if (message.id !== messageId) return message;
		found = true;
		return update(message);
	});

	if (!found) {
		const seeded = update({
			id: messageId,
			role: "assistant",
			content: "",
			createdAt: Date.now(),
		});

		if (placeholderId && placeholderId !== messageId) {
			const placeholderIndex = nextMessages.findIndex(
				(message) =>
					message.id === placeholderId && isAssistantPlaceholder(message),
			);
			if (placeholderIndex >= 0) {
				nextMessages[placeholderIndex] = seeded;
			} else {
				nextMessages.push(seeded);
			}
		} else {
			nextMessages.push(seeded);
		}
	}

	return {
		...thread,
		messages: nextMessages,
		messageCount: Math.max(thread.messageCount ?? 0, nextMessages.length),
		updatedAt: Date.now(),
		messagesLoaded: true,
	};
}

export function mergeStreamText(existing: string, next: string): string {
	if (!next) return existing;
	if (next.startsWith(existing)) return next;
	return existing + next;
}

export function mapSessionToThread(
	session: SessionSummary,
	defaultThreadName = "New Thread",
): Thread {
	return {
		id: session.id,
		name: session.name || defaultThreadName,
		agentId: session.agentId,
		messages: [],
		toolEvents: [],
		thinkingEvents: [],
		createdAt: session.createdAt || Date.now(),
		updatedAt: session.updatedAt,
		messageCount: session.messageCount ?? 0,
		lastMessagePreview: session.lastMessagePreview,
		messagesLoaded: false,
		workdir: session.workdir ?? null,
	};
}

export function normalizeIncomingAttachment(
	raw: unknown,
): ChatAttachment | null {
	const record = asRecord(raw);
	if (!record) return null;

	const dataUrl = typeof record.dataUrl === "string" ? record.dataUrl : "";
	const textContent =
		typeof record.textContent === "string" ? record.textContent : undefined;
	const mimeType =
		typeof record.mimeType === "string" ? record.mimeType : undefined;
	const name = typeof record.name === "string" ? record.name : undefined;
	const size = typeof record.size === "number" ? record.size : undefined;
	const kind = typeof record.kind === "string" ? record.kind : undefined;

	const isAudio =
		kind === "audio" ||
		mimeType?.startsWith("audio/") ||
		dataUrl.startsWith("data:audio/");
	const isFile =
		kind === "file" ||
		(typeof textContent === "string" &&
			!isAudio &&
			!dataUrl.startsWith("data:image/"));

	if (isFile) {
		return {
			id:
				typeof record.id === "string" && record.id.trim().length > 0
					? record.id
					: createAttachmentId(),
			kind: "file",
			dataUrl,
			textContent: textContent || "",
			mimeType,
			name,
			size,
		};
	}

	if (!dataUrl) return null;

	return {
		id:
			typeof record.id === "string" && record.id.trim().length > 0
				? record.id
				: createAttachmentId(),
		kind: isAudio ? "audio" : "image",
		dataUrl,
		mimeType,
		name,
		size,
	};
}

export function normalizeSessionMessage(message: ChatMessage): ChatMessage {
	const rawAttachments = Array.isArray(
		(message as UnknownAttachmentMessage).attachments,
	)
		? ((message as UnknownAttachmentMessage).attachments as unknown[])
		: [];
	const attachments = rawAttachments
		.map((attachment) => normalizeIncomingAttachment(attachment))
		.filter(Boolean) as ChatAttachment[];

	if (message.role !== "assistant") {
		return {
			...message,
			attachments: attachments.length > 0 ? attachments : undefined,
		};
	}

	return {
		...message,
		content: sanitizeAssistantDisplayText(message.content) ?? "",
		attachments: attachments.length > 0 ? attachments : undefined,
	};
}

export function buildAgentFallback(
	result: unknown,
	requestId: string,
	uiOnlyRequests: Set<string>,
): string | undefined {
	if (!result) return undefined;
	if (uiOnlyRequests.has(requestId)) return undefined;
	if (typeof result === "object" && result !== null) {
		const record = result as Record<string, unknown>;
		if (
			typeof record.fallbackText === "string" &&
			record.fallbackText.trim().length > 0
		) {
			return sanitizeAssistantDisplayText(record.fallbackText);
		}
		const keys = Object.keys(result as Record<string, unknown>);
		if (keys.length === 1 && keys[0] === "streaming") {
			return undefined;
		}
	}
	try {
		return sanitizeAssistantDisplayText(JSON.stringify(result, null, 2));
	} catch {
		return sanitizeAssistantDisplayText(String(result));
	}
}

export function readFileAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result || ""));
		reader.onerror = () =>
			reject(reader.error || new Error("Failed to read file"));
		reader.readAsDataURL(file);
	});
}

function isAudioAttachment(attachment: ChatAttachment): boolean {
	if (attachment.kind === "audio") return true;
	if (attachment.mimeType?.startsWith("audio/")) return true;
	if (attachment.dataUrl?.startsWith("data:audio/")) return true;
	return false;
}

function isVideoAttachment(attachment: ChatAttachment): boolean {
	if (attachment.mimeType?.startsWith("video/")) return true;
	if (attachment.dataUrl?.startsWith("data:video/")) return true;
	return false;
}

function isFileAttachment(attachment: ChatAttachment): boolean {
	if (attachment.kind === "file") return true;
	return typeof attachment.textContent === "string";
}

export function buildAttachmentPreviewText(
	attachments: ChatAttachment[],
): string {
	if (!attachments || attachments.length === 0) return "";
	let hasFile = false;
	let hasAudio = false;
	let hasImage = false;
	let hasVideo = false;
	for (const attachment of attachments) {
		if (isVideoAttachment(attachment)) {
			hasVideo = true;
			continue;
		}
		if (isFileAttachment(attachment)) {
			hasFile = true;
			continue;
		}
		if (isAudioAttachment(attachment)) {
			hasAudio = true;
		} else {
			hasImage = true;
		}
	}
	const count = attachments.length;
	if (hasFile && (hasAudio || hasImage || hasVideo)) {
		return count > 1
			? "File and media attachments"
			: "File and media attachment";
	}
	if (hasFile) {
		return count > 1 ? "File attachments" : "File attachment";
	}
	if ((hasAudio || hasVideo) && hasImage) {
		return count > 1 ? "Media attachments" : "Media attachment";
	}
	if (hasAudio && hasVideo) {
		return count > 1 ? "Media attachments" : "Media attachment";
	}
	if (hasAudio) {
		return count > 1 ? "Audio attachments" : "Audio attachment";
	}
	if (hasVideo) {
		return count > 1 ? "Video attachments" : "Video attachment";
	}
	return count > 1 ? "Image attachments" : "Image attachment";
}

export function normalizeStreamAttachment(raw: {
	kind?: unknown;
	dataUrl?: unknown;
	textContent?: unknown;
	name?: unknown;
	mimeType?: unknown;
	size?: unknown;
}): ChatAttachment | null {
	const kind =
		typeof raw.kind === "string" &&
		(raw.kind === "image" || raw.kind === "audio" || raw.kind === "file")
			? raw.kind
			: null;
	const dataUrl = typeof raw.dataUrl === "string" ? raw.dataUrl.trim() : "";
	if (!kind || !dataUrl) return null;

	const textContent =
		kind === "file" && typeof raw.textContent === "string"
			? raw.textContent
			: undefined;
	const name = typeof raw.name === "string" ? raw.name : undefined;
	const mimeType = typeof raw.mimeType === "string" ? raw.mimeType : undefined;
	const size =
		typeof raw.size === "number" && Number.isFinite(raw.size)
			? raw.size
			: undefined;

	return {
		id: createAttachmentId(),
		kind,
		dataUrl,
		textContent,
		name,
		mimeType,
		size,
	};
}

function attachmentSignature(attachment: ChatAttachment): string {
	return [
		attachment.kind,
		attachment.dataUrl,
		attachment.textContent || "",
		attachment.name || "",
		attachment.mimeType || "",
		typeof attachment.size === "number" ? String(attachment.size) : "",
	].join("|");
}

export function mergeStreamAttachments(
	existing: ChatAttachment[] | undefined,
	incoming: ChatAttachment[],
): ChatAttachment[] | undefined {
	if (incoming.length === 0) return existing;
	const merged = [...(existing || [])];
	const seen = new Set(
		merged.map((attachment) => attachmentSignature(attachment)),
	);
	for (const attachment of incoming) {
		const signature = attachmentSignature(attachment);
		if (seen.has(signature)) continue;
		seen.add(signature);
		merged.push(attachment);
	}
	return merged.length > 0 ? merged : undefined;
}
