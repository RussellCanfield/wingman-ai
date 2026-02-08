import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	ToolEventPanel,
	formatToolEventDuration,
	summarizeToolEventValue,
	stringifyToolEventValue,
} from "./ToolEventPanel";

describe("ToolEventPanel helpers", () => {
	it("stringifies objects", () => {
		const result = stringifyToolEventValue({ q: "wingman", limit: 3 });

		expect(result).toContain('"q": "wingman"');
		expect(result).toContain('"limit": 3');
	});

	it("truncates long payload strings", () => {
		const result = stringifyToolEventValue("x".repeat(20), 10);

		expect(result).toBe("xxxxxxxxxx...");
	});

	it("summarizes payload text into one compact line", () => {
		const result = summarizeToolEventValue({
			query: "search docs",
			filters: ["latest", "api"],
		});

		expect(result).toBeTruthy();
		expect(result).not.toContain("\n");
		expect(result).toContain("search docs");
	});

	it("formats sub-second durations in milliseconds", () => {
		const result = formatToolEventDuration({
			id: "tool-1",
			name: "internet_search",
			status: "completed",
			startedAt: 1000,
			completedAt: 1550,
		});

		expect(result).toBe("550ms");
	});

	it("formats running durations against provided current time", () => {
		const result = formatToolEventDuration(
			{
				id: "tool-2",
				name: "web_crawler",
				status: "running",
				startedAt: 5_000,
			},
			8_250,
		);

		expect(result).toBe("3.3s");
	});

	it("returns null duration when no valid start time exists", () => {
		const result = formatToolEventDuration({
			id: "tool-3",
			name: "think",
			status: "completed",
		});

		expect(result).toBeNull();
	});

	it("renders payload blocks with wrapped constrained output", () => {
		const html = renderToStaticMarkup(
			React.createElement(ToolEventPanel, {
				variant: "inline",
				toolEvents: [
					{
						id: "tool-4",
						name: "internet_search",
						status: "completed",
						args: { query: "wingman" },
						output: `https://example.com/${"x".repeat(500)}`,
					},
				],
			}),
		);

		expect(html).toContain("group w-full min-w-0");
		expect(html).toContain("whitespace-pre-wrap");
		expect(html).toContain("overflow-x-hidden");
		expect(html).toContain("[overflow-wrap:anywhere]");
	});
});
