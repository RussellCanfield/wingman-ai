import { describe, expect, it } from "vitest";
import {
	drainAssistantContentUpdates,
	type QueuedAssistantUpdate,
	queueAssistantContentUpdate,
} from "./assistantUpdateQueue";

const update = (
	input: Partial<QueuedAssistantUpdate> = {},
): QueuedAssistantUpdate => ({
	threadId: "thread-1",
	requestId: "req-1",
	messageId: "msg-1",
	content: "hello",
	...input,
});

describe("queueAssistantContentUpdate", () => {
	it("stores updates by unique thread/request/message key", () => {
		const queue = new Map<string, QueuedAssistantUpdate>();
		queueAssistantContentUpdate(queue, update());
		queueAssistantContentUpdate(
			queue,
			update({
				messageId: "msg-2",
				content: "world",
			}),
		);

		expect(queue.size).toBe(2);
	});

	it("replaces pending update content for the same key", () => {
		const queue = new Map<string, QueuedAssistantUpdate>();
		queueAssistantContentUpdate(queue, update({ content: "first" }));
		queueAssistantContentUpdate(queue, update({ content: "second" }));

		const drained = drainAssistantContentUpdates(queue);
		expect(drained).toHaveLength(1);
		expect(drained[0]?.content).toBe("second");
	});

	it("coalesces timeline deltas when multiple chunks target the same text block", () => {
		const queue = new Map<string, QueuedAssistantUpdate>();
		queueAssistantContentUpdate(
			queue,
			update({
				content: "Hi",
				timelineTextBlockId: "text-a",
				timelineTextOrder: 1,
				timelineTextDelta: "Hi -- ",
			}),
		);
		queueAssistantContentUpdate(
			queue,
			update({
				content: "Hi -- what would you like to do next?",
				timelineTextBlockId: "text-a",
				timelineTextOrder: 1,
				timelineTextDelta: "what would you like to do next?",
			}),
		);

		const drained = drainAssistantContentUpdates(queue);
		expect(drained).toHaveLength(1);
		expect(drained[0]?.content).toBe("Hi -- what would you like to do next?");
		expect(drained[0]?.timelineTextDelta).toBe(
			"Hi -- what would you like to do next?",
		);
	});

	it("keeps separate timeline text block updates distinct", () => {
		const queue = new Map<string, QueuedAssistantUpdate>();
		queueAssistantContentUpdate(
			queue,
			update({
				timelineTextBlockId: "text-a",
				timelineTextOrder: 1,
				timelineTextDelta: "Before",
			}),
		);
		queueAssistantContentUpdate(
			queue,
			update({
				timelineTextBlockId: "text-b",
				timelineTextOrder: 3,
				timelineTextDelta: "After",
			}),
		);

		const drained = drainAssistantContentUpdates(queue);
		expect(drained).toHaveLength(2);
		expect(drained.map((item) => item.timelineTextBlockId)).toEqual([
			"text-a",
			"text-b",
		]);
	});
});

describe("drainAssistantContentUpdates", () => {
	it("returns queued updates and clears the queue", () => {
		const queue = new Map<string, QueuedAssistantUpdate>();
		queueAssistantContentUpdate(queue, update());

		const drained = drainAssistantContentUpdates(queue);

		expect(drained).toHaveLength(1);
		expect(queue.size).toBe(0);
	});
});
