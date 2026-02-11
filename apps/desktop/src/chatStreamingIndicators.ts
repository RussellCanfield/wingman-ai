import type { ChatMessage } from "./lib/gatewayModels.js";

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

export function hasNestedMessageActivity(message: ChatMessage): boolean {
	return Boolean(
		(message.toolEvents && message.toolEvents.length > 0) ||
			(message.thinkingEvents && message.thinkingEvents.length > 0),
	);
}

export function hasDisplayableMessageText(message: ChatMessage): boolean {
	return Boolean(message.content.trim() || message.uiTextFallback?.trim());
}

export function shouldShowAssistantTypingIndicator(args: {
	message: ChatMessage;
	isStreaming: boolean;
	activeAssistantMessageId?: string;
}): boolean {
	const { message, isStreaming, activeAssistantMessageId } = args;
	if (message.role !== "assistant" || !isStreaming) return false;
	if (message.id !== activeAssistantMessageId) return false;
	if (hasNestedMessageActivity(message)) return false;
	if (hasDisplayableMessageText(message)) return false;
	if (message.uiBlocks && message.uiBlocks.length > 0) return false;
	return true;
}
