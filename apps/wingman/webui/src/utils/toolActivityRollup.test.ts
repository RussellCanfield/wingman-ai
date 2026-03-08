import { describe, expect, it } from "vitest";
import {
	groupTimelineBlocksForDisplay,
	groupToolEventsForDisplay,
} from "./toolActivityRollup";

describe("groupTimelineBlocksForDisplay", () => {
	it("groups consecutive tool blocks into one rollup item", () => {
		const items = groupTimelineBlocksForDisplay({
			blocks: [
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
					id: "tool-2",
					kind: "tool",
					order: 3,
					toolEventId: "event-2",
				},
				{
					id: "text-2",
					kind: "text",
					order: 4,
					text: "After",
				},
			],
			toolEventsById: new Map([
				[
					"event-1",
					{
						id: "event-1",
						name: "read_file",
						status: "completed",
						timestamp: 1,
					},
				],
				[
					"event-2",
					{
						id: "event-2",
						name: "edit_file",
						status: "running",
						timestamp: 2,
					},
				],
			]),
		});

		expect(items.map((item) => item.kind)).toEqual([
			"text",
			"tool-rollup",
			"text",
		]);
		expect(items[1]).toMatchObject({
			kind: "tool-rollup",
			toolEvents: [
				{ id: "event-1", name: "read_file" },
				{ id: "event-2", name: "edit_file" },
			],
		});
	});

	it("sorts unsorted blocks and skips missing tool events", () => {
		const items = groupTimelineBlocksForDisplay({
			blocks: [
				{
					id: "tool-2",
					kind: "tool",
					order: 3,
					toolEventId: "missing",
				},
				{
					id: "text-2",
					kind: "text",
					order: 4,
					text: "After",
				},
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
			],
			toolEventsById: new Map([
				[
					"event-1",
					{
						id: "event-1",
						name: "read_file",
						status: "completed",
						timestamp: 1,
					},
				],
			]),
		});

		expect(items).toEqual([
			{
				id: "text-1",
				kind: "text",
				text: "Before",
			},
			{
				id: "tool-rollup-event-1",
				kind: "tool-rollup",
				toolEvents: [
					{
						id: "event-1",
						name: "read_file",
						status: "completed",
						timestamp: 1,
					},
				],
			},
			{
				id: "text-2",
				kind: "text",
				text: "After",
			},
		]);
	});

	it("keeps media-bearing tool events inside the same rollup", () => {
		const items = groupToolEventsForDisplay({
			toolEvents: [
				{
					id: "event-1",
					name: "read_file",
					status: "completed",
					timestamp: 1,
				},
				{
					id: "event-2",
					name: "browser_session_action",
					status: "completed",
					timestamp: 2,
					output: {
						media: [
							{
								kind: "image",
								mimeType: "image/png",
								url: "/api/fs/file?path=%2Ftmp%2Fscreenshot.png",
							},
						],
					},
				},
				{
					id: "event-3",
					name: "edit_file",
					status: "completed",
					timestamp: 3,
				},
			],
		});

		expect(items).toEqual([
			{
				id: "tool-rollup-event-1-event-2-event-3",
				kind: "tool-rollup",
				toolEvents: [
					{
						id: "event-1",
						name: "read_file",
						status: "completed",
						timestamp: 1,
					},
					{
						id: "event-2",
						name: "browser_session_action",
						status: "completed",
						timestamp: 2,
						output: {
							media: [
								{
									kind: "image",
									mimeType: "image/png",
									url: "/api/fs/file?path=%2Ftmp%2Fscreenshot.png",
								},
							],
						},
					},
					{
						id: "event-3",
						name: "edit_file",
						status: "completed",
						timestamp: 3,
					},
				],
			},
		]);
	});
});
