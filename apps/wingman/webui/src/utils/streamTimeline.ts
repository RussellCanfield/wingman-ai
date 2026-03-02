import type {
	AssistantTimelineBlock,
	AssistantTimelineTextBlock,
	AssistantTimelineToolBlock,
} from "../types";
import { mergeAssistantStreamText } from "./assistantStream";

type TimelineTextUpsertInput = {
	blockId: string;
	order: number;
	textDelta: string;
};

type TimelineToolUpsertInput = {
	blockId: string;
	order: number;
	toolEventId: string;
};

const sortTimelineBlocks = (
	blocks: AssistantTimelineBlock[],
): AssistantTimelineBlock[] => {
	return [...blocks].sort((a, b) => a.order - b.order);
};

export function upsertTimelineTextBlock(
	timeline: AssistantTimelineBlock[] | undefined,
	input: TimelineTextUpsertInput,
): AssistantTimelineBlock[] {
	const { blockId, order, textDelta } = input;
	if (!textDelta) {
		return sortTimelineBlocks(timeline ? [...timeline] : []);
	}

	const next = timeline ? [...timeline] : [];
	const existingIndex = next.findIndex(
		(block): block is AssistantTimelineTextBlock =>
			block.id === blockId && block.kind === "text",
	);
	if (existingIndex >= 0) {
		const existing = next[existingIndex] as AssistantTimelineTextBlock;
		next[existingIndex] = {
			...existing,
			order,
			text: mergeAssistantStreamText(existing.text, textDelta),
		};
		return sortTimelineBlocks(next);
	}

	next.push({
		id: blockId,
		kind: "text",
		order,
		text: textDelta,
	});
	return sortTimelineBlocks(next);
}

export function upsertTimelineToolBlock(
	timeline: AssistantTimelineBlock[] | undefined,
	input: TimelineToolUpsertInput,
): AssistantTimelineBlock[] {
	const { blockId, order, toolEventId } = input;
	const next = timeline ? [...timeline] : [];
	const existingIndex = next.findIndex(
		(block): block is AssistantTimelineToolBlock =>
			block.kind === "tool" && block.toolEventId === toolEventId,
	);
	if (existingIndex >= 0) {
		const existing = next[existingIndex] as AssistantTimelineToolBlock;
		next[existingIndex] = {
			...existing,
			order,
		};
		return sortTimelineBlocks(next);
	}

	next.push({
		id: blockId,
		kind: "tool",
		order,
		toolEventId,
	});
	return sortTimelineBlocks(next);
}
