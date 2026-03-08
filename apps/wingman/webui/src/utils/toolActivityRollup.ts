import type { AssistantTimelineBlock, ToolEvent } from "../types";

export type TimelineDisplayItem =
	| {
			id: string;
			kind: "text";
			text: string;
	  }
	| {
			id: string;
			kind: "tool-rollup";
			toolEvents: ToolEvent[];
	  };

export function groupToolEventsForDisplay({
	toolEvents,
	preserveOrder = false,
}: {
	toolEvents: ToolEvent[];
	preserveOrder?: boolean;
}): TimelineDisplayItem[] {
	if (toolEvents.length === 0) {
		return [];
	}

	const orderedToolEvents = preserveOrder
		? [...toolEvents]
		: [...toolEvents].sort(compareToolEventTime);
	return [
		{
			id: `tool-rollup-${orderedToolEvents.map((event) => event.id).join("-")}`,
			kind: "tool-rollup",
			toolEvents: orderedToolEvents,
		},
	];
}

export function groupTimelineBlocksForDisplay({
	blocks,
	toolEventsById,
}: {
	blocks: AssistantTimelineBlock[];
	toolEventsById?: Map<string, ToolEvent> | null;
}): TimelineDisplayItem[] {
	const sortedBlocks = [...blocks].sort((a, b) => a.order - b.order);
	const displayItems: TimelineDisplayItem[] = [];
	let pendingToolEvents: ToolEvent[] = [];

	const flushPendingToolEvents = () => {
		if (pendingToolEvents.length === 0) {
			return;
		}
		displayItems.push(
			...groupToolEventsForDisplay({
				toolEvents: pendingToolEvents,
				preserveOrder: true,
			}),
		);
		pendingToolEvents = [];
	};

	for (const block of sortedBlocks) {
		if (block.kind === "tool") {
			const toolEvent = toolEventsById?.get(block.toolEventId);
			if (!toolEvent) {
				continue;
			}
			pendingToolEvents.push(toolEvent);
			continue;
		}

		flushPendingToolEvents();
		displayItems.push({
			id: block.id,
			kind: "text",
			text: block.text,
		});
	}

	flushPendingToolEvents();
	return displayItems;
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
