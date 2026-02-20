import { describe, expect, it } from "vitest";
import {
	DEFAULT_TEAMS_ENDPOINT_PATH,
	extractTeamsMentionTexts,
	isTeamsBotMentioned,
	normalizeTeamsEndpointPath,
	resolveTeamsChannelSessionKey,
	splitTeamsMessage,
	stripTeamsBotMention,
} from "../gateway/adapters/teams.js";

describe("teams adapter helpers", () => {
	it("normalizes endpoint path and falls back to default", () => {
		expect(normalizeTeamsEndpointPath(undefined)).toBe(
			DEFAULT_TEAMS_ENDPOINT_PATH,
		);
		expect(normalizeTeamsEndpointPath("")).toBe(DEFAULT_TEAMS_ENDPOINT_PATH);
		expect(normalizeTeamsEndpointPath("api/teams")).toBe("/api/teams");
		expect(normalizeTeamsEndpointPath("/api/teams")).toBe("/api/teams");
	});

	it("extracts mention entities for the bot", () => {
		const activity: any = {
			recipient: { name: "Wingman", id: "bot-1" },
			entities: [
				{
					type: "mention",
					text: "<at>Wingman</at>",
					mentioned: { id: "bot-1", name: "Wingman" },
				},
			],
		};
		expect(extractTeamsMentionTexts(activity, "bot-1")).toEqual([
			"<at>Wingman</at>",
		]);
		expect(isTeamsBotMentioned(activity, "bot-1")).toBe(true);
	});

	it("strips mention tags and mention text from messages", () => {
		const text = "<at>Wingman</at> hello there";
		expect(stripTeamsBotMention(text, ["<at>Wingman</at>"])).toBe("hello there");
	});

	it("splits long responses into chunks", () => {
		const input = "a".repeat(9500);
		const chunks = splitTeamsMessage(input, 3500);
		expect(chunks.length).toBeGreaterThan(2);
		for (const chunk of chunks) {
			expect(chunk.length).toBeLessThanOrEqual(3500);
		}
		expect(chunks.join("")).toBe(input);
	});

	it("resolves channel session mapping", () => {
		const map = {
			"19:channel:id": "agent:wingman:teams:channel",
		};
		expect(resolveTeamsChannelSessionKey("19:channel:id", map)).toBe(
			"agent:wingman:teams:channel",
		);
		expect(resolveTeamsChannelSessionKey("missing", map)).toBeUndefined();
	});
});
