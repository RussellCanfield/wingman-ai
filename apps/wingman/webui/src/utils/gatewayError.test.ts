import { describe, expect, it } from "vitest";
import {
	extractGatewayErrorMessage,
	resolveTrackedGatewayErrorRequestId,
} from "./gatewayError";

describe("extractGatewayErrorMessage", () => {
	it("returns direct string payload errors", () => {
		expect(extractGatewayErrorMessage("Model unsupported")).toBe(
			"Model unsupported",
		);
	});

	it("returns payload.message when provided", () => {
		expect(
			extractGatewayErrorMessage({
				message: "Agent invocation failed",
			}),
		).toBe("Agent invocation failed");
	});

	it("falls back to nested details.message", () => {
		expect(
			extractGatewayErrorMessage({
				details: {
					message: "xAI image endpoint rejected the request",
				},
			}),
		).toBe("xAI image endpoint rejected the request");
	});

	it("returns undefined when no string error is present", () => {
		expect(extractGatewayErrorMessage({ code: "E_INVALID" })).toBeUndefined();
	});
});

describe("resolveTrackedGatewayErrorRequestId", () => {
	it("prefers top-level message id when tracked", () => {
		const requestId = resolveTrackedGatewayErrorRequestId({
			messageId: "req-1",
			payload: {},
			pendingRequestIds: new Set(["req-1"]),
			activeRequestId: null,
		});

		expect(requestId).toBe("req-1");
	});

	it("falls back to payload.requestId when message id is untracked", () => {
		const requestId = resolveTrackedGatewayErrorRequestId({
			messageId: "req-mismatch",
			payload: { requestId: "req-2" },
			pendingRequestIds: new Set(["req-2"]),
			activeRequestId: null,
		});

		expect(requestId).toBe("req-2");
	});

	it("supports nested details.requestId", () => {
		const requestId = resolveTrackedGatewayErrorRequestId({
			payload: { details: { requestId: "req-3" } },
			pendingRequestIds: new Set(["req-1", "req-2"]),
			activeRequestId: "req-3",
		});

		expect(requestId).toBe("req-3");
	});

	it("supports payload.id when requestId is not present", () => {
		const requestId = resolveTrackedGatewayErrorRequestId({
			payload: { id: "req-4" },
			pendingRequestIds: new Set(["req-4"]),
			activeRequestId: null,
		});

		expect(requestId).toBe("req-4");
	});

	it("falls back to active tracked request when payload has no ids", () => {
		const requestId = resolveTrackedGatewayErrorRequestId({
			payload: { code: "AGENT_FAILED" },
			pendingRequestIds: new Set(["req-active", "req-other"]),
			activeRequestId: "req-active",
		});

		expect(requestId).toBe("req-active");
	});

	it("falls back to single pending request when no ids are provided", () => {
		const requestId = resolveTrackedGatewayErrorRequestId({
			payload: { code: "AGENT_FAILED" },
			pendingRequestIds: new Set(["req-only"]),
			activeRequestId: null,
		});

		expect(requestId).toBe("req-only");
	});

	it("returns undefined for untracked request ids", () => {
		const requestId = resolveTrackedGatewayErrorRequestId({
			messageId: "req-other",
			payload: { requestId: "req-mismatch" },
			pendingRequestIds: new Set(["req-1", "req-5"]),
			activeRequestId: "req-2",
		});

		expect(requestId).toBeUndefined();
	});
});
