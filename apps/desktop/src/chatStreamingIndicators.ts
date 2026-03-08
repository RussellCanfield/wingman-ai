import type { ChatMessage } from "./lib/gatewayModels.js";
import type { RenderableChatMessage } from "./lib/transcriptMessages.js";

export function resolveLastAssistantMessageId(
	messages: ChatMessage[] | undefined,
): string | undefined {
	if (!messages || messages.length === 0) return undefined;
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		if (messages[index]?.role === "assistant") {
			return messages[index]?.id;
		}
	}
	return undefined;
}

export function hasNestedMessageActivity(
	message: ChatMessage | RenderableChatMessage,
): boolean {
	return Boolean(
		(message.toolEvents && message.toolEvents.length > 0) ||
			(message.thinkingEvents && message.thinkingEvents.length > 0),
	);
}

export function hasDisplayableMessageText(
	message: ChatMessage | RenderableChatMessage,
): boolean {
	return Boolean(message.content.trim() || message.uiTextFallback?.trim());
}

export function shouldShowAssistantTypingIndicator(args: {
	message: ChatMessage | RenderableChatMessage;
	isStreaming: boolean;
	activeAssistantMessageId?: string;
}): boolean {
	const { message, isStreaming, activeAssistantMessageId } = args;
	if (message.role !== "assistant" || !isStreaming) return false;
	if (!messageIncludesSourceId(message, activeAssistantMessageId)) return false;
	if (hasNestedMessageActivity(message)) return false;
	if (hasDisplayableMessageText(message)) return false;
	if (message.uiBlocks && message.uiBlocks.length > 0) return false;
	return true;
}

function messageIncludesSourceId(
	message: ChatMessage | RenderableChatMessage,
	messageId: string | undefined,
): boolean {
	if (!messageId) return false;
	if ("sourceMessageIds" in message && Array.isArray(message.sourceMessageIds)) {
		return message.sourceMessageIds.includes(messageId);
	}
	return message.id === messageId;
}
