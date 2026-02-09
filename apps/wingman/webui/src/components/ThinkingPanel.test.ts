import { describe, expect, it } from "vitest";
import {
	buildThinkingSummary,
	shouldOpenThinkingPanelByDefault,
} from "./ThinkingPanel";

describe("ThinkingPanel", () => {
	it("opens by default while streaming with activity", () => {
		const result = shouldOpenThinkingPanelByDefault({
			isStreaming: true,
			hasThinking: true,
			activeTools: 2,
		});

		expect(result).toBe(true);
	});

	it("stays collapsed by default when idle", () => {
		const result = shouldOpenThinkingPanelByDefault({
			isStreaming: false,
			hasThinking: false,
			activeTools: 0,
		});

		expect(result).toBe(false);
	});

	it("opens by default while streaming when only tools are active", () => {
		const result = shouldOpenThinkingPanelByDefault({
			isStreaming: true,
			hasThinking: false,
			activeTools: 1,
		});

		expect(result).toBe(true);
	});

	it("builds summary without running state text", () => {
		expect(
			buildThinkingSummary({
				thinkingCount: 2,
				toolCount: 3,
			}),
		).toBe("2 subagents • 3 tools");
	});
});
