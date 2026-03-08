import { describe, expect, it } from "vitest";
import {
	upsertTimelineTextBlock,
	upsertTimelineToolBlock,
} from "./streamTimeline.js";

describe("streamTimeline", () => {
	it("appends text deltas into the same text block", () => {
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

		expect(second).toEqual([
			{
				id: "text-1",
				kind: "text",
				order: 1,
				text: "Hello\n world",
			},
		]);
	});

	it("keeps tool blocks ordered with text blocks", () => {
		let timeline = upsertTimelineTextBlock(undefined, {
			blockId: "text-1",
			order: 1,
			textDelta: "Before",
		});
		timeline = upsertTimelineToolBlock(timeline, {
			blockId: "tool-1",
			order: 2,
			toolEventId: "event-1",
		});
		timeline = upsertTimelineTextBlock(timeline, {
			blockId: "text-2",
			order: 3,
			textDelta: "After",
		});

		expect(timeline).toEqual([
			{
				id: "text-1",
				kind: "text",
				order: 1,
				text: "Before",
			},
			{
				id: "tool-1",
				kind: "tool",
				order: 2,
				toolEventId: "event-1",
			},
			{
				id: "text-2",
				kind: "text",
				order: 3,
				text: "After",
			},
		]);
	});
});
