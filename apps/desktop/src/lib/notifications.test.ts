import { describe, expect, test } from "vitest";
import { buildAgentCompletionNotice } from "./notifications.js";

describe("buildAgentCompletionNotice", () => {
	test("builds completion notification with preview", () => {
		const notice = buildAgentCompletionNotice({
			agentId: "main",
			threadName: "Daily standup",
			preview: "Done. Here is your summary.",
		});
		expect(notice.title).toBe("main finished");
		expect(notice.body).toBe("Daily standup: Done. Here is your summary.");
	});

	test("falls back when preview is empty", () => {
		const notice = buildAgentCompletionNotice({
			agentId: "researcher",
			threadName: "Roadmap",
			preview: "   ",
		});
		expect(notice.title).toBe("researcher finished");
		expect(notice.body).toBe("Roadmap: Response complete.");
	});

	test("truncates long preview", () => {
		const notice = buildAgentCompletionNotice({
			agentId: "main",
			threadName: "General",
			preview:
				"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
		});
		expect(notice.body.endsWith("...")).toBe(true);
		expect(notice.body.length).toBeLessThanOrEqual(110);
	});
});
