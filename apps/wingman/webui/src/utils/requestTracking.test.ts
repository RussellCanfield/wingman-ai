import { describe, expect, it } from "vitest";
import { isLocallyTrackedRequest } from "./requestTracking";

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
