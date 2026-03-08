import type {
	AssistantTimelineBlock,
	ChatAttachment,
	ChatMessage,
	ToolEvent,
} from "../types";
import { mergeUniqueAttachments } from "./attachmentDedupe";

export type RenderableChatMessage = ChatMessage & {
	sourceMessageIds: string[];
};

export function collapseToolOnlyAssistantMessages(
	messages: ChatMessage[] | undefined,
): RenderableChatMessage[] {
	if (!Array.isArray(messages) || messages.length === 0) {
		return [];
	}

	const collapsed: RenderableChatMessage[] = [];
	let pending: RenderableChatMessage | null = null;

	const flushPending = () => {
		if (!pending) return;
		collapsed.push(pending);
		pending = null;
	};

	for (const message of messages) {
		const renderable = toRenderableMessage(message);
		if (!isToolOnlyAssistantMessage(renderable)) {
			flushPending();
			collapsed.push(renderable);
			continue;
		}

		if (!pending) {
			pending = renderable;
			continue;
		}

		pending = mergeToolOnlyAssistantMessages(pending, renderable);
	}

	flushPending();
	return collapsed;
}

export function messageIncludesSourceId(
	message: RenderableChatMessage | ChatMessage,
	messageId: string | undefined,
): boolean {
	if (!messageId) return false;
	if (
		"sourceMessageIds" in message &&
		Array.isArray(message.sourceMessageIds)
	) {
		return message.sourceMessageIds.includes(messageId);
	}
	return message.id === messageId;
}

function toRenderableMessage(message: ChatMessage): RenderableChatMessage {
	return {
		...message,
		sourceMessageIds: [message.id],
	};
}

function isToolOnlyAssistantMessage(message: RenderableChatMessage): boolean {
	return (
		message.role === "assistant" &&
		(message.toolEvents?.length ?? 0) > 0 &&
		!(message.content || "").trim() &&
		!(message.uiTextFallback || "").trim() &&
		(message.uiBlocks?.length ?? 0) === 0 &&
		(message.thinkingEvents?.length ?? 0) === 0 &&
		(message.inlineThinkBlocks?.length ?? 0) === 0
	);
}

function mergeToolOnlyAssistantMessages(
	left: RenderableChatMessage,
	right: RenderableChatMessage,
): RenderableChatMessage {
	return {
		...left,
		sourceMessageIds: [...left.sourceMessageIds, ...right.sourceMessageIds],
		attachments: mergeAttachments(left.attachments, right.attachments),
		toolEvents: mergeToolEvents(left.toolEvents, right.toolEvents),
		activityTimeline: mergeActivityTimeline(
			left.activityTimeline,
			right.activityTimeline,
		),
		createdAt: Math.min(left.createdAt, right.createdAt),
	};
}

function mergeAttachments(
	left: ChatAttachment[] | undefined,
	right: ChatAttachment[] | undefined,
): ChatAttachment[] | undefined {
	const merged = mergeUniqueAttachments(left || [], right || []);
	return merged.length > 0 ? merged : undefined;
}

function mergeToolEvents(
	left: ToolEvent[] | undefined,
	right: ToolEvent[] | undefined,
): ToolEvent[] | undefined {
	if ((!left || left.length === 0) && (!right || right.length === 0)) {
		return undefined;
	}

	const merged = [...(left || [])];
	for (const event of right || []) {
		const existingIndex = merged.findIndex(
			(candidate) => candidate.id === event.id,
		);
		if (existingIndex < 0) {
			merged.push(event);
			continue;
		}

		const existing = merged[existingIndex];
		merged[existingIndex] = {
			...existing,
			...event,
			name:
				event.name && event.name !== "tool"
					? event.name
					: existing.name || event.name,
			node: event.node || existing.node,
			actor: event.actor || existing.actor,
			runId: event.runId || existing.runId,
			parentRunIds: event.parentRunIds || existing.parentRunIds,
			delegatedByTaskId: event.delegatedByTaskId || existing.delegatedByTaskId,
			delegatedSubagentType:
				event.delegatedSubagentType || existing.delegatedSubagentType,
			args: event.args ?? existing.args,
			output: event.output ?? existing.output,
			ui: event.ui ?? existing.ui,
			uiOnly: event.uiOnly ?? existing.uiOnly,
			textFallback: event.textFallback ?? existing.textFallback,
			error: event.error ?? existing.error,
			timestamp: event.timestamp ?? existing.timestamp,
			startedAt:
				existing.startedAt ??
				event.startedAt ??
				event.timestamp ??
				existing.timestamp,
			completedAt:
				event.completedAt ??
				(event.status === "completed" || event.status === "error"
					? (event.timestamp ?? existing.completedAt)
					: existing.completedAt),
			streamOrder: event.streamOrder ?? existing.streamOrder,
		};
	}

	return merged.sort(compareToolEventTime);
}

function mergeActivityTimeline(
	left: AssistantTimelineBlock[] | undefined,
	right: AssistantTimelineBlock[] | undefined,
): AssistantTimelineBlock[] | undefined {
	if ((!left || left.length === 0) && (!right || right.length === 0)) {
		return undefined;
	}

	const merged = [...(left || [])];
	for (const block of right || []) {
		const existingIndex = merged.findIndex((candidate) => {
			if (candidate.kind !== block.kind) return false;
			if (candidate.kind === "tool" && block.kind === "tool") {
				return candidate.toolEventId === block.toolEventId;
			}
			return candidate.id === block.id;
		});
		if (existingIndex < 0) {
			merged.push(block);
			continue;
		}

		const existing = merged[existingIndex];
		if (existing.kind === "tool" && block.kind === "tool") {
			merged[existingIndex] = {
				...existing,
				...block,
				order: block.order ?? existing.order,
			};
			continue;
		}

		if (existing.kind === "text" && block.kind === "text") {
			merged[existingIndex] = {
				...existing,
				...block,
				order: block.order ?? existing.order,
				text: `${existing.text}${block.text}`,
			};
		}
	}

	return merged.sort((a, b) => a.order - b.order);
}

function compareToolEventTime(left: ToolEvent, right: ToolEvent): number {
	const leftTime =
		left.streamOrder ??
		left.startedAt ??
		left.timestamp ??
		left.completedAt ??
		Number.MAX_SAFE_INTEGER;
	const rightTime =
		right.streamOrder ??
		right.startedAt ??
		right.timestamp ??
		right.completedAt ??
		Number.MAX_SAFE_INTEGER;
	return leftTime - rightTime;
}
