import { buildAttachmentPreviewText, createAttachmentId } from "./chatAttachments.js";
import type { ChatAttachment, ChatMessage, SessionThread } from "./gatewayModels.js";

export type SessionMirrorEventPayload = {
	type?: string;
	role?: string;
	sessionId?: string;
	agentId?: string;
	content?: string;
	attachments?: unknown;
};

type UpsertSessionUserMessageOptions = {
	now?: number;
	fallbackAgentId?: string;
	createId?: () => string;
};

type EnsureAssistantMessageOptions = {
	now?: number;
	fallbackAgentId?: string;
	defaultThreadName?: string;
	messageId?: string;
};

export function getSessionIdFromEventPayload(
	payload: SessionMirrorEventPayload | undefined,
): string | undefined {
	if (!payload || typeof payload.sessionId !== "string") return undefined;
	const normalized = payload.sessionId.trim();
	return normalized || undefined;
}

export function isSessionUserMessagePayload(
	payload: SessionMirrorEventPayload | undefined,
): boolean {
	if (!payload) return false;
	return payload.type === "session-message" && payload.role === "user";
}

export function normalizeIncomingGatewayAttachments(
	rawAttachments: unknown,
	createId: () => string = createAttachmentId,
): ChatAttachment[] {
	if (!Array.isArray(rawAttachments)) return [];

	return rawAttachments
		.map((attachment) => {
			if (!attachment || typeof attachment !== "object") return null;
			const record = attachment as Record<string, unknown>;
			const dataUrl = typeof record.dataUrl === "string" ? record.dataUrl : "";
			const textContent =
				typeof record.textContent === "string" ? record.textContent : undefined;
			const mimeType = typeof record.mimeType === "string" ? record.mimeType : undefined;
			const name = typeof record.name === "string" ? record.name : undefined;
			const size = typeof record.size === "number" ? record.size : undefined;
			const isAudio =
				record.kind === "audio" ||
				mimeType?.startsWith("audio/") ||
				dataUrl.startsWith("data:audio/");
			const isFile =
				record.kind === "file" ||
				(typeof textContent === "string" && !isAudio && !dataUrl.startsWith("data:image/"));
			if (isFile) {
				return {
					id: createId(),
					kind: "file" as const,
					dataUrl,
					textContent: textContent || "",
					mimeType,
					name,
					size,
				};
			}
			if (!dataUrl) return null;
			return {
				id: createId(),
				kind: isAudio ? ("audio" as const) : ("image" as const),
				dataUrl,
				mimeType,
				name,
				size,
			};
		})
		.filter(Boolean) as ChatAttachment[];
}

export function upsertSessionUserMessage(
	threads: SessionThread[],
	requestId: string,
	payload: SessionMirrorEventPayload,
	options: UpsertSessionUserMessageOptions = {},
): SessionThread[] {
	if (!isSessionUserMessagePayload(payload)) return threads;
	const sessionId = getSessionIdFromEventPayload(payload);
	if (!sessionId) return threads;

	const now = options.now ?? Date.now();
	const attachments = normalizeIncomingGatewayAttachments(
		payload.attachments,
		options.createId,
	);
	const content = typeof payload.content === "string" ? payload.content : "";
	const userMessage: ChatMessage = {
		id: `user-${requestId || now}`,
		role: "user",
		content,
		attachments: attachments.length > 0 ? attachments : undefined,
		createdAt: now,
	};
	const attachmentPreview =
		attachments.length > 0 ? buildAttachmentPreviewText(attachments) : "";
	const preview = (content || attachmentPreview).slice(0, 200);
	const agentId =
		typeof payload.agentId === "string" && payload.agentId.trim()
			? payload.agentId
			: options.fallbackAgentId || "main";

	const existing = threads.find((thread) => thread.id === sessionId);
	if (!existing) {
		const newThread: SessionThread = {
			id: sessionId,
			name: sessionId,
			agentId,
			messages: [userMessage],
			createdAt: now,
			updatedAt: now,
			messageCount: 1,
			lastMessagePreview: preview,
			messagesLoaded: true,
		};
		return [newThread, ...threads];
	}

	const hasMessage = existing.messages.some((message) => message.id === userMessage.id);
	if (hasMessage) return threads;

	return threads.map((thread) => {
		if (thread.id !== sessionId) return thread;
		return {
			...thread,
			messages: [...thread.messages, userMessage],
			messageCount: (thread.messageCount ?? thread.messages.length) + 1,
			lastMessagePreview: preview,
			updatedAt: now,
			messagesLoaded: true,
		};
	});
}

export function ensureSessionAssistantMessage(
	threads: SessionThread[],
	requestId: string,
	payload: SessionMirrorEventPayload,
	options: EnsureAssistantMessageOptions = {},
): { threads: SessionThread[]; threadId?: string; messageId: string } {
	const sessionId = getSessionIdFromEventPayload(payload);
	const messageId = options.messageId || requestId;
	if (!sessionId) {
		return { threads, messageId };
	}

	const now = options.now ?? Date.now();
	const agentId =
		typeof payload.agentId === "string" && payload.agentId.trim()
			? payload.agentId
			: options.fallbackAgentId || "main";
	const assistantMessage: ChatMessage = {
		id: messageId,
		role: "assistant",
		content: "",
		createdAt: now,
	};
	const defaultThreadName = options.defaultThreadName || "New Session";

	const existing = threads.find((thread) => thread.id === sessionId);
	if (!existing) {
		const newThread: SessionThread = {
			id: sessionId,
			name: defaultThreadName,
			agentId,
			messages: [assistantMessage],
			createdAt: now,
			updatedAt: now,
			messageCount: 1,
			lastMessagePreview: "",
			messagesLoaded: true,
		};
		return { threads: [newThread, ...threads], threadId: sessionId, messageId };
	}

	const hasMessage = existing.messages.some((message) => message.id === messageId);
	if (hasMessage) {
		return { threads, threadId: sessionId, messageId };
	}

	return {
		threads: threads.map((thread) => {
			if (thread.id !== sessionId) return thread;
			return {
				...thread,
				messages: [...thread.messages, assistantMessage],
				messageCount: (thread.messageCount ?? thread.messages.length) + 1,
				updatedAt: now,
				messagesLoaded: true,
			};
		}),
		threadId: sessionId,
		messageId,
	};
}
