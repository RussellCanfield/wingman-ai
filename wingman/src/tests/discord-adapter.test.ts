import { describe, expect, it } from "vitest";
import {
	extractSessionOverride,
	parseAgentIdFromSessionKey,
	resolveDiscordChannelSessionKey,
	splitDiscordMessage,
	stripDiscordBotMention,
} from "../gateway/adapters/discord.js";

describe("discord adapter helpers", () => {
	it("extracts session override when command matches", () => {
		const result = extractSessionOverride("!session agent:main:cli hello", "!session");
		expect(result.matched).toBe(true);
		expect(result.sessionKey).toBe("agent:main:cli");
		expect(result.content).toBe("hello");
	});

	it("returns no match when command does not match", () => {
		const result = extractSessionOverride("hello there", "!session");
		expect(result.matched).toBe(false);
		expect(result.sessionKey).toBeUndefined();
		expect(result.content).toBe("hello there");
	});

	it("handles session command without key", () => {
		const result = extractSessionOverride("!session", "!session");
		expect(result.matched).toBe(true);
		expect(result.sessionKey).toBeUndefined();
		expect(result.content).toBe("");
	});

	it("resolves channel session mapping with thread fallback", () => {
		const map = {
			"123": "session-a",
			"parent-1": "session-parent",
		};
		expect(resolveDiscordChannelSessionKey("123", map)).toBe("session-a");
		expect(resolveDiscordChannelSessionKey("missing", map, "parent-1")).toBe(
			"session-parent",
		);
		expect(resolveDiscordChannelSessionKey("missing", map)).toBeUndefined();
	});

	it("parses agent id from session key", () => {
		expect(parseAgentIdFromSessionKey("agent:main:webui:thread:abc")).toBe(
			"main",
		);
		expect(parseAgentIdFromSessionKey("agent:stock-trader:discord:channel:1")).toBe(
			"stock-trader",
		);
		expect(parseAgentIdFromSessionKey("session-plain")).toBeUndefined();
		expect(parseAgentIdFromSessionKey(undefined)).toBeUndefined();
	});

	it("strips bot mention variants", () => {
		const content = "<@123> hello <@!123>";
		expect(stripDiscordBotMention(content, "123")).toBe("hello");
	});

	it("splits long responses into chunks", () => {
		const input = "a".repeat(4500);
		const chunks = splitDiscordMessage(input, 1900);
		expect(chunks.length).toBeGreaterThan(1);
		for (const chunk of chunks) {
			expect(chunk.length).toBeLessThanOrEqual(1900);
		}
		const rebuilt = chunks.join("");
		expect(rebuilt).toBe(input);
	});
});
