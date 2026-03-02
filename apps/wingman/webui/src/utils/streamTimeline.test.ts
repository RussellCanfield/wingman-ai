import { describe, expect, it } from "vitest";
import type { AssistantTimelineBlock } from "../types";
import {
	upsertTimelineTextBlock,
	upsertTimelineToolBlock,
} from "./streamTimeline";

describe("streamTimeline", () => {
	it("appends text deltas into an existing text block", () => {
		const first = upsertTimelineTextBlock(undefined, {
			blockId: "text-1",
			order: 1,
			textDelta: "Hello",
		});
		const second = upsertTimelineTextBlock(first, {
			blockId: "text-1",
			order: 1,
			textDelta: " world",
		});

		expect(second).toHaveLength(1);
		expect(second[0]).toMatchObject({
			id: "text-1",
			kind: "text",
			text: "Hello world",
		});
	});

	it("inserts tool blocks in chronological order", () => {
		let timeline: AssistantTimelineBlock[] = [];
		timeline = upsertTimelineTextBlock(timeline, {
			blockId: "text-1",
			order: 2,
			textDelta: "after",
		});
		timeline = upsertTimelineToolBlock(timeline, {
			blockId: "tool-1",
			order: 1,
			toolEventId: "tool-event-1",
		});

		expect(timeline.map((block) => block.id)).toEqual(["tool-1", "text-1"]);
	});

	it("does not duplicate tool blocks when status updates arrive", () => {
		let timeline = upsertTimelineToolBlock(undefined, {
			blockId: "tool-1",
			order: 3,
			toolEventId: "tool-event-1",
		});
		timeline = upsertTimelineToolBlock(timeline, {
			blockId: "tool-1-update",
			order: 3,
			toolEventId: "tool-event-1",
		});

		expect(timeline).toHaveLength(1);
		expect(timeline[0]).toMatchObject({
			kind: "tool",
			toolEventId: "tool-event-1",
		});
	});

	it("supports text-tool-text interleaving", () => {
		let timeline: AssistantTimelineBlock[] = [];
		timeline = upsertTimelineTextBlock(timeline, {
			blockId: "text-1",
			order: 1,
			textDelta: "Before tool",
		});
		timeline = upsertTimelineToolBlock(timeline, {
			blockId: "tool-1",
			order: 2,
			toolEventId: "tool-event-1",
		});
		timeline = upsertTimelineTextBlock(timeline, {
			blockId: "text-2",
			order: 3,
			textDelta: "After tool",
		});

		expect(timeline.map((block) => block.kind)).toEqual([
			"text",
			"tool",
			"text",
		]);
	});
});
