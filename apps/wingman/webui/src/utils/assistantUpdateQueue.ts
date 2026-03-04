import { mergeAssistantStreamText } from "./assistantStream";

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
	const existing = queue.get(key);
	if (!existing) {
		queue.set(key, update);
		return;
	}

	const shouldMergeTimelineDelta =
		Boolean(existing.timelineTextBlockId) &&
		existing.timelineTextBlockId === update.timelineTextBlockId;
	const timelineTextDelta = shouldMergeTimelineDelta
		? mergeAssistantStreamText(
				existing.timelineTextDelta ?? "",
				update.timelineTextDelta ?? "",
			)
		: update.timelineTextDelta;

	queue.set(key, {
		...existing,
		...update,
		timelineTextDelta,
	});
}

export function drainAssistantContentUpdates(
	queue: Map<string, QueuedAssistantUpdate>,
): QueuedAssistantUpdate[] {
	const updates = Array.from(queue.values());
	queue.clear();
	return updates;
}
