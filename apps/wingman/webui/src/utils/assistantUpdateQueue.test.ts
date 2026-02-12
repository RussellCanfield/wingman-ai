import { describe, expect, it } from "vitest";
import {
	drainAssistantContentUpdates,
	queueAssistantContentUpdate,
	type QueuedAssistantUpdate,
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
