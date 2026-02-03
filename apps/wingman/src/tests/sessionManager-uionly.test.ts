import { describe, expect, it } from "vitest";
import { extractMessagesFromState } from "../cli/core/sessionManager.js";

const buildState = (messages: any[]) => ({
	values: {
		messages,
		createdAt: Date.now(),
	},
});

describe("extractMessagesFromState", () => {
	it("filters assistant messages that duplicate uiOnly textFallback", () => {
		const state = buildState([
			{ role: "user", content: "Weather please" },
			{
				role: "tool",
				content: JSON.stringify({
					uiOnly: true,
					textFallback: "Seattle: 58°F, Cloudy",
					ui: { registry: "webui", components: [{ component: "StatGrid", props: {} }] },
				}),
			},
			{ role: "assistant", content: "Seattle: 58°F, Cloudy" },
		]);

		const messages = extractMessagesFromState(state) ?? [];

		expect(messages.map((msg) => msg.role)).toEqual(["user", "assistant"]);
		expect(messages[1].uiBlocks?.length).toBe(1);
	});
});
