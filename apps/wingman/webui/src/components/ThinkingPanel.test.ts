import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
	ThinkingPanel,
	buildThinkingSummary,
	shouldOpenThinkingPanelByDefault,
} from "./ThinkingPanel";

describe("ThinkingPanel", () => {
	it("stays collapsed by default while streaming with activity", () => {
		const result = shouldOpenThinkingPanelByDefault({
			isStreaming: true,
			hasThinking: true,
			activeTools: 2,
		});

		expect(result).toBe(false);
	});

	it("stays collapsed by default when idle", () => {
		const result = shouldOpenThinkingPanelByDefault({
			isStreaming: false,
			hasThinking: false,
			activeTools: 0,
		});

		expect(result).toBe(false);
	});

	it("stays collapsed by default while streaming when only tools are active", () => {
		const result = shouldOpenThinkingPanelByDefault({
			isStreaming: true,
			hasThinking: false,
			activeTools: 1,
		});

		expect(result).toBe(false);
	});

	it("builds summary without running state text", () => {
		expect(
			buildThinkingSummary({
				thinkingCount: 2,
				toolCount: 3,
			}),
		).toBe("2 subagents • 3 tools");
	});

	it("renders tool rows without execution trace wrapper", () => {
		const html = renderToStaticMarkup(
			React.createElement(ThinkingPanel, {
				isStreaming: true,
				thinkingEvents: [],
				toolEvents: [
					{
						id: "tool-1",
						name: "edit_file",
						status: "running",
					},
				],
			}),
		);

		expect(html).toContain("edit_file");
		expect(html).not.toContain("Execution Trace");
	});
});
