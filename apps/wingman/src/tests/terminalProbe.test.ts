import { describe, expect, it } from "vitest";
import {
	formatTerminalProbeEvent,
	shouldReportTerminalProbeEvent,
} from "../debug/terminalProbe.js";

describe("shouldReportTerminalProbeEvent", () => {
	it("reports terminal events by default", () => {
		expect(shouldReportTerminalProbeEvent("agent-complete")).toBe(true);
		expect(shouldReportTerminalProbeEvent("agent-error")).toBe(true);
	});

	it("hides non-terminal events by default", () => {
		expect(shouldReportTerminalProbeEvent("agent-start")).toBe(false);
		expect(shouldReportTerminalProbeEvent("request-queued")).toBe(false);
	});

	it("includes lifecycle events in verbose mode", () => {
		expect(shouldReportTerminalProbeEvent("agent-start", true)).toBe(true);
		expect(shouldReportTerminalProbeEvent("request-queued", true)).toBe(true);
	});
});

describe("formatTerminalProbeEvent", () => {
	it("formats terminal events in a compact single line", () => {
		const line = formatTerminalProbeEvent({
			type: "agent-complete",
			requestId: "req-1",
			sessionId: "session-1",
			timestampIso: "2026-02-12T18:12:00.000Z",
		});

		expect(line).toContain("type=agent-complete");
		expect(line).toContain("req=req-1");
		expect(line).toContain("session=session-1");
	});

	it("includes error text for error events", () => {
		const line = formatTerminalProbeEvent({
			type: "agent-error",
			requestId: "req-2",
			error: "Provider timeout",
			timestampIso: "2026-02-12T18:12:01.000Z",
		});

		expect(line).toContain("type=agent-error");
		expect(line).toContain('error="Provider timeout"');
	});
});
