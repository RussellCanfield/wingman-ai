import { describe, expect, it } from "vitest";
import {
	DEFAULT_STREAM_RECOVERY_HARD_TIMEOUT_MS,
	DEFAULT_STREAM_RECOVERY_IDLE_TIMEOUT_MS,
	shouldRecoverStream,
} from "./streamRecovery";

describe("shouldRecoverStream", () => {
	it("returns false when there is no active request", () => {
		expect(
			shouldRecoverStream({
				activeRequestId: null,
				lastActivityAt: 1_000,
				startedAt: 1_000,
				hasRunningTools: false,
				now: 10_000,
			}),
		).toBe(false);
	});

	it("returns false when idle timeout has not elapsed", () => {
		expect(
			shouldRecoverStream({
				activeRequestId: "req-1",
				lastActivityAt: 10_000,
				startedAt: 10_000,
				hasRunningTools: false,
				now: 12_000,
			}),
		).toBe(false);
	});

	it("returns true when idle timeout has elapsed and no tools are running", () => {
		expect(
			shouldRecoverStream({
				activeRequestId: "req-1",
				lastActivityAt: 10_000,
				startedAt: 10_000,
				hasRunningTools: false,
				now: 10_000 + DEFAULT_STREAM_RECOVERY_IDLE_TIMEOUT_MS,
			}),
		).toBe(true);
	});

	it("does not recover on idle timeout while tools are still running", () => {
		expect(
			shouldRecoverStream({
				activeRequestId: "req-1",
				lastActivityAt: 10_000,
				startedAt: 10_000,
				hasRunningTools: true,
				now: 10_000 + DEFAULT_STREAM_RECOVERY_IDLE_TIMEOUT_MS + 5_000,
			}),
		).toBe(false);
	});

	it("recovers on hard timeout even when tools are running", () => {
		expect(
			shouldRecoverStream({
				activeRequestId: "req-1",
				lastActivityAt: 10_000,
				startedAt: 10_000,
				hasRunningTools: true,
				now: 10_000 + DEFAULT_STREAM_RECOVERY_HARD_TIMEOUT_MS,
			}),
		).toBe(true);
	});

	it("recovers on hard timeout even before first activity is observed", () => {
		expect(
			shouldRecoverStream({
				activeRequestId: "req-1",
				lastActivityAt: 0,
				startedAt: 10_000,
				hasRunningTools: false,
				now: 10_000 + DEFAULT_STREAM_RECOVERY_HARD_TIMEOUT_MS,
			}),
		).toBe(true);
	});

	it("returns false when timestamps are invalid", () => {
		expect(
			shouldRecoverStream({
				activeRequestId: "req-1",
				lastActivityAt: Number.NaN,
				startedAt: 10_000,
				hasRunningTools: false,
				now: 10_000,
			}),
		).toBe(false);
		expect(
			shouldRecoverStream({
				activeRequestId: "req-1",
				lastActivityAt: 10_000,
				startedAt: Number.NaN,
				hasRunningTools: false,
				now: 10_000,
			}),
		).toBe(false);
	});
});
