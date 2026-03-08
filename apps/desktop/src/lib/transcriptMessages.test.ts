import { describe, expect, it } from "vitest";
import { collapseToolOnlyAssistantMessages } from "./transcriptMessages.js";

describe("collapseToolOnlyAssistantMessages", () => {
	it("collapses consecutive assistant tool-only messages into one renderable message", () => {
		const messages = collapseToolOnlyAssistantMessages([
			{
				id: "assistant-text-before",
				role: "assistant",
				content: "Before",
				createdAt: 1,
			},
			{
				id: "assistant-tool-1",
				role: "assistant",
				content: "",
				createdAt: 2,
				toolEvents: [
					{
						id: "tool-1",
						name: "read_file",
						status: "completed",
						timestamp: 2,
					},
				],
			},
			{
				id: "assistant-tool-2",
				role: "assistant",
				content: "",
				createdAt: 3,
				toolEvents: [
					{
						id: "tool-2",
						name: "edit_file",
						status: "completed",
						timestamp: 3,
					},
				],
			},
			{
				id: "assistant-text-after",
				role: "assistant",
				content: "After",
				createdAt: 4,
			},
		]);

		expect(messages).toHaveLength(3);
		expect(messages[1]).toMatchObject({
			id: "assistant-tool-1",
			sourceMessageIds: ["assistant-tool-1", "assistant-tool-2"],
			toolEvents: [
				{ id: "tool-1", name: "read_file" },
				{ id: "tool-2", name: "edit_file" },
			],
		});
	});

	it("preserves assistant messages with visible text as distinct transcript items", () => {
		const messages = collapseToolOnlyAssistantMessages([
			{
				id: "assistant-a",
				role: "assistant",
				content: "Before",
				createdAt: 1,
				toolEvents: [
					{
						id: "tool-a",
						name: "read_file",
						status: "completed",
						timestamp: 1,
					},
				],
			},
			{
				id: "assistant-b",
				role: "assistant",
				content: "",
				createdAt: 2,
				toolEvents: [
					{
						id: "tool-b",
						name: "edit_file",
						status: "completed",
						timestamp: 2,
					},
				],
			},
		]);

		expect(messages).toHaveLength(2);
		expect(messages[0]?.sourceMessageIds).toEqual(["assistant-a"]);
		expect(messages[1]?.sourceMessageIds).toEqual(["assistant-b"]);
	});
});
