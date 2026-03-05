import { describe, expect, it } from "vitest";
import { extractLatestTodoSnapshotFromMessages } from "../../../../../shared/chat/todos";

describe("extractLatestTodoSnapshotFromMessages", () => {
	it("uses the newest write_todos args payload across messages", () => {
		const snapshot = extractLatestTodoSnapshotFromMessages([
			{
				toolEvents: [
					{
						id: "todo-1",
						name: "write_todos",
						args: {
							todos: [
								{ content: "Inspect the composer", status: "completed" },
								{ content: "Render the todo strip", status: "in_progress" },
							],
						},
						timestamp: 10,
					},
				],
			},
			{
				toolEvents: [
					{
						id: "todo-2",
						name: "write_todos",
						args: {
							todos: [
								{ content: "Inspect the composer", status: "completed" },
								{ content: "Render the todo strip", status: "completed" },
								{ content: "Add focused tests", status: "in_progress" },
							],
						},
						timestamp: 20,
					},
				],
			},
		]);

		expect(snapshot).toMatchObject({
			sourceEventId: "todo-2",
			totalCount: 3,
			completedCount: 2,
			inProgressCount: 1,
			pendingCount: 0,
			hasActiveTodos: true,
		});
		expect(snapshot?.todos.map((todo) => todo.content)).toEqual([
			"Inspect the composer",
			"Render the todo strip",
			"Add focused tests",
		]);
	});

	it("parses serialized todo tool output when args are unavailable", () => {
		const snapshot = extractLatestTodoSnapshotFromMessages([
			{
				toolEvents: [
					{
						id: "todo-3",
						name: "write_todos",
						output:
							'Updated todo list to [{"content":"Review event payloads","status":"completed"},{"content":"Show task progress","status":"pending"}]',
						timestamp: 30,
					},
				],
			},
		]);

		expect(snapshot).toMatchObject({
			sourceEventId: "todo-3",
			totalCount: 2,
			completedCount: 1,
			pendingCount: 1,
			inProgressCount: 0,
			hasActiveTodos: false,
		});
		expect(snapshot?.todos[1]).toEqual({
			content: "Show task progress",
			status: "pending",
		});
	});

	it("reads todo lists from command-style tool outputs", () => {
		const snapshot = extractLatestTodoSnapshotFromMessages([
			{
				toolEvents: [
					{
						id: "todo-4",
						name: "write_todos",
						output: {
							update: {
								todos: [
									{ content: "Collect the latest todo list", status: "completed" },
									{ content: "Display it in the composer", status: "pending" },
								],
							},
						},
						timestamp: 40,
					},
				],
			},
		]);

		expect(snapshot).toMatchObject({
			sourceEventId: "todo-4",
			totalCount: 2,
			completedCount: 1,
			pendingCount: 1,
		});
	});

	it("treats an empty todo replacement as a cleared list", () => {
		const snapshot = extractLatestTodoSnapshotFromMessages([
			{
				toolEvents: [
					{
						id: "todo-old",
						name: "write_todos",
						args: {
							todos: [{ content: "Previous todo", status: "completed" }],
						},
						timestamp: 10,
					},
				],
			},
			{
				toolEvents: [
					{
						id: "todo-clear",
						name: "write_todos",
						args: { todos: [] },
						timestamp: 20,
					},
				],
			},
		]);

		expect(snapshot).toBeNull();
	});
});
