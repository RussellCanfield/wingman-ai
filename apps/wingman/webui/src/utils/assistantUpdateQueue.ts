export type QueuedAssistantUpdate = {
	threadId: string;
	requestId: string;
	messageId: string;
	content: string;
	inlineThinkBlocks?: string[];
	timelineTextBlockId?: string;
	timelineTextOrder?: number;
	timelineTextDelta?: string;
};

function buildAssistantUpdateKey(update: QueuedAssistantUpdate): string {
	const timelineKey = update.timelineTextBlockId || "content";
	return `${update.threadId}::${update.requestId}::${update.messageId}::${timelineKey}`;
}

export function queueAssistantContentUpdate(
	queue: Map<string, QueuedAssistantUpdate>,
	update: QueuedAssistantUpdate,
): void {
	const key = buildAssistantUpdateKey(update);
	queue.set(key, update);
}

export function drainAssistantContentUpdates(
	queue: Map<string, QueuedAssistantUpdate>,
): QueuedAssistantUpdate[] {
	const updates = Array.from(queue.values());
	queue.clear();
	return updates;
}
