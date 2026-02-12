import { describe, expect, it } from "vitest";
import {
	buildCancelGatewayMessage,
	resolveStoppableRequestId,
} from "./stopPrompt";

describe("resolveStoppableRequestId", () => {
	it("prefers active request id", () => {
		expect(
			resolveStoppableRequestId({
				activeRequestId: "req-active",
				pendingRequestIds: new Set(["req-queued"]),
			}),
		).toBe("req-active");
	});

	it("falls back to first pending request when active is missing", () => {
		expect(
			resolveStoppableRequestId({
				activeRequestId: null,
				pendingRequestIds: new Set(["req-queued", "req-next"]),
			}),
		).toBe("req-queued");
	});

	it("returns null when there is no stoppable request", () => {
		expect(
			resolveStoppableRequestId({
				activeRequestId: null,
				pendingRequestIds: new Set(),
			}),
		).toBeNull();
	});
});

describe("buildCancelGatewayMessage", () => {
	it("builds a req:agent:cancel payload", () => {
		expect(buildCancelGatewayMessage("req-123", 456)).toEqual({
			type: "req:agent:cancel",
			id: "cancel-req-123-456",
			payload: { requestId: "req-123" },
			timestamp: 456,
		});
	});
});
