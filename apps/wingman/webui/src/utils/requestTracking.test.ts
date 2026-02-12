import { describe, expect, it } from "vitest";
import {
	isLocallyTrackedRequest,
	resolveTerminalRequestId,
} from "./requestTracking";

describe("isLocallyTrackedRequest", () => {
	it("returns true when request id is pending", () => {
		const result = isLocallyTrackedRequest({
			requestId: "req-1",
			pendingRequestIds: new Set(["req-1"]),
			activeRequestId: null,
		});

		expect(result).toBe(true);
	});

	it("returns true when request id is active", () => {
		const result = isLocallyTrackedRequest({
			requestId: "req-2",
			pendingRequestIds: new Set(["req-1"]),
			activeRequestId: "req-2",
		});

		expect(result).toBe(true);
	});

	it("returns false for untracked request ids", () => {
		const result = isLocallyTrackedRequest({
			requestId: "req-3",
			pendingRequestIds: new Set(["req-1", "req-2"]),
			activeRequestId: "req-2",
		});

		expect(result).toBe(false);
	});
});

describe("resolveTerminalRequestId", () => {
	it("returns the incoming request id when it is locally tracked", () => {
		const result = resolveTerminalRequestId({
			requestId: "req-1",
			pendingRequestIds: new Set(["req-1"]),
			activeRequestId: "req-1",
		});

		expect(result).toBe("req-1");
	});

	it("falls back to active request id when incoming id is untracked", () => {
		const result = resolveTerminalRequestId({
			requestId: "req-mismatch",
			pendingRequestIds: new Set(["req-active", "req-queued"]),
			activeRequestId: "req-active",
		});

		expect(result).toBe("req-active");
	});

	it("falls back to single pending request when active is missing", () => {
		const result = resolveTerminalRequestId({
			requestId: "req-mismatch",
			pendingRequestIds: new Set(["req-only"]),
			activeRequestId: null,
		});

		expect(result).toBe("req-only");
	});
});
