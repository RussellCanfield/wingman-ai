import { describe, expect, it } from "vitest";
import { interpretSmsInboundMessage } from "@/gateway/sms/commands.js";

describe("sms commands", () => {
	it("parses reserved commands as control commands", () => {
		expect(interpretSmsInboundMessage("help")).toEqual({
			type: "command",
			command: { name: "help" },
		});
		expect(interpretSmsInboundMessage("STATUS")).toEqual({
			type: "command",
			command: { name: "status" },
		});
		expect(interpretSmsInboundMessage("resume")).toEqual({
			type: "command",
			command: { name: "resume" },
		});
		expect(interpretSmsInboundMessage("STOP")).toEqual({
			type: "command",
			command: { name: "stop" },
		});
	});

	it("parses pause commands with optional durations", () => {
		expect(interpretSmsInboundMessage("pause")).toEqual({
			type: "command",
			command: { name: "pause", durationMs: null },
		});
		expect(interpretSmsInboundMessage("pause 15m")).toEqual({
			type: "command",
			command: { name: "pause", durationMs: 15 * 60_000 },
		});
		expect(interpretSmsInboundMessage("PAUSE 2 H")).toEqual({
			type: "command",
			command: { name: "pause", durationMs: 2 * 60 * 60_000 },
		});
		expect(interpretSmsInboundMessage("pause 1d")).toEqual({
			type: "command",
			command: { name: "pause", durationMs: 24 * 60 * 60_000 },
		});
	});

	it("treats invalid command forms as plain text", () => {
		expect(interpretSmsInboundMessage("pause tomorrow")).toEqual({
			type: "text",
			content: "pause tomorrow",
		});
		expect(interpretSmsInboundMessage("pause 0m")).toEqual({
			type: "text",
			content: "pause 0m",
		});
		expect(interpretSmsInboundMessage("help me with deploy")).toEqual({
			type: "text",
			content: "help me with deploy",
		});
	});

	it("supports escaping reserved command words", () => {
		expect(interpretSmsInboundMessage("\\pause")).toEqual({
			type: "text",
			content: "pause",
		});
		expect(interpretSmsInboundMessage("\\STATUS")).toEqual({
			type: "text",
			content: "STATUS",
		});
	});
});
