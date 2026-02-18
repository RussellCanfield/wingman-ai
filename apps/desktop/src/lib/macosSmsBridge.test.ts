import { describe, expect, test } from "vitest";
import {
	appendAgentEventText,
	buildSmsTargetForHandle,
	extractAgentTerminalText,
	mergeSmsBridgeStreamText,
	parseHandleFromSmsTarget,
	splitSmsBridgeReply,
} from "./macosSmsBridge.js";

describe("macosSmsBridge helpers", () => {
	test("builds and parses SMS targets", () => {
		expect(buildSmsTargetForHandle("+15555550000")).toBe("sms-macos:+15555550000");
		expect(buildSmsTargetForHandle("   ")).toBeNull();
		expect(parseHandleFromSmsTarget("sms-macos:+15555550000")).toBe("+15555550000");
		expect(parseHandleFromSmsTarget("sms:+15555550000")).toBeNull();
	});

	test("merges streaming text with delta semantics", () => {
		expect(mergeSmsBridgeStreamText("", "Hello", false)).toBe("Hello");
		expect(mergeSmsBridgeStreamText("Hello", " world", true)).toBe("Hello world");
		expect(mergeSmsBridgeStreamText("Hello", "Hello world", true)).toBe("Hello world");
		expect(mergeSmsBridgeStreamText("One", "Two", false)).toBe("One\nTwo");
	});

	test("appends text from stream payload events", () => {
		const first = appendAgentEventText("", {
			type: "agent-stream",
			chunk: { content: "Start" },
		});
		expect(first).toBe("Start");

		const next = appendAgentEventText(first, {
			event: "on_llm_stream",
			data: { chunk: { text: " + delta" } },
		});
		expect(next).toContain("Start");
		expect(next).toContain("+ delta");
	});

	test("splits long responses into bounded chunks", () => {
		const text = "alpha ".repeat(80).trim();
		const chunks = splitSmsBridgeReply(text, 120);
		expect(chunks.length).toBeGreaterThan(1);
		expect(chunks.every((chunk) => chunk.length <= 120)).toBe(true);
		expect(chunks.join(" ")).toContain("alpha alpha");
	});

	test("extracts terminal text from completion payloads", () => {
		expect(extractAgentTerminalText({ content: " final answer " })).toBe(
			"final answer",
		);
		expect(extractAgentTerminalText({ nope: true })).toBe("");
	});
});
