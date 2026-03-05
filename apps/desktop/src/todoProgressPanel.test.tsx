import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TodoProgressPanel } from "./components/TodoProgressPanel.js";

describe("TodoProgressPanel", () => {
	it("renders a compact collapsed drawer by default", () => {
		const html = renderToStaticMarkup(
			React.createElement(TodoProgressPanel, {
				attached: true,
				snapshot: {
					todos: [
						{ content: "Inspect tool events", status: "completed" },
						{ content: "Render progress panel", status: "in_progress" },
						{ content: "Run verification", status: "pending" },
					],
					totalCount: 3,
					completedCount: 1,
					pendingCount: 1,
					inProgressCount: 1,
					hasActiveTodos: true,
					allCompleted: false,
					sourceEventId: "todo-1",
					updatedAt: 10,
				},
			}),
		);

		expect(html).toContain('data-testid="todo-progress-panel"');
		expect(html).toContain("Task progress");
		expect(html).toContain(">1/3<");
		expect(html).toContain('aria-expanded="false"');
		expect(html).toContain(">Show<");
		expect(html).toContain("mx-3 rounded-t-2xl rounded-b-none border-b-0 sm:mx-4");
		expect(html).toContain("truncate text-sm");
		expect(html).toContain("Inspect tool events");
		expect(html).toContain("Render progress panel");
		expect(html).toContain("Run verification");
		expect(html).toContain(">Done<");
		expect(html).toContain(">Active<");
		expect(html).toContain(">Pending<");
	});
});
