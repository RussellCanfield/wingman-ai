import { describe, expect, it } from "vitest";
import { describeWebSocketError } from "@/gateway/transport/websocket.js";

describe("describeWebSocketError", () => {
	const url = "ws://localhost:18789/ws";

	it("formats native Error instances", () => {
		const message = describeWebSocketError(new Error("ECONNREFUSED"), url);
		expect(message).toContain("WebSocket connection failed");
		expect(message).toContain("ECONNREFUSED");
		expect(message).toContain(url);
	});

	it("formats event-like objects with type/message", () => {
		const message = describeWebSocketError(
			{ type: "error", message: "socket hung up" },
			url,
		);
		expect(message).toContain("WebSocket error while connecting");
		expect(message).toContain("socket hung up");
	});

	it("falls back gracefully for unknown objects", () => {
		const message = describeWebSocketError({ type: "error" }, url);
		expect(message).toBe(`WebSocket error while connecting to ${url}.`);
	});
});
