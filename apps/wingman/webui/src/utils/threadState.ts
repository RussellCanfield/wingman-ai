import type { ChatMessage, Thread } from "../types";

type AppendLocalPromptMessagesInput = {
	thread: Thread;
	targetThreadId: string;
	userMessage: ChatMessage;
	assistantMessage: ChatMessage;
	attachmentPreview: string;
	now: number;
	defaultThreadName: string;
};

export function appendLocalPromptMessagesToThread(
	input: AppendLocalPromptMessagesInput,
): Thread {
	const {
		thread,
		targetThreadId,
		userMessage,
		assistantMessage,
		attachmentPreview,
		now,
		defaultThreadName,
	} = input;
	if (thread.id !== targetThreadId) return thread;

	return {
		...thread,
		name:
			thread.name === defaultThreadName
				? (userMessage.content || attachmentPreview).slice(0, 32)
				: thread.name,
		messages: [...thread.messages, userMessage, assistantMessage],
		messageCount: (thread.messageCount ?? thread.messages.length) + 1,
		lastMessagePreview: (userMessage.content || attachmentPreview).slice(
			0,
			200,
		),
		updatedAt: now,
		thinkingEvents: [],
		// Prevent load-on-focus from replacing optimistic messages while the request is in flight.
		messagesLoaded: true,
	};
}
