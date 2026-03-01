import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GatewaySocketClient } from "./gatewaySocket.js";
import { normalizeGatewaySettings } from "./gatewayConfig.js";

class FakeWebSocket {
	static instances: FakeWebSocket[] = [];
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSING = 2;
	static CLOSED = 3;

	url: string;
	readyState = FakeWebSocket.CONNECTING;
	sent: string[] = [];
	onopen: ((event: Event) => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;
	onclose: ((event: CloseEvent) => void) | null = null;

	constructor(url: string) {
		this.url = url;
		FakeWebSocket.instances.push(this);
	}

	send(data: string): void {
		this.sent.push(data);
	}

	close(): void {
		this.readyState = FakeWebSocket.CLOSED;
		this.onclose?.({ code: 1000, reason: "" } as CloseEvent);
	}

	open(): void {
		this.readyState = FakeWebSocket.OPEN;
		this.onopen?.({} as Event);
	}
}

describe("GatewaySocketClient", () => {
	const originalWebSocket = globalThis.WebSocket;

	beforeEach(() => {
		FakeWebSocket.instances = [];
		globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
	});

	afterEach(() => {
		globalThis.WebSocket = originalWebSocket;
	});

	test("maps request id returned by sendAgentRequest to outbound payload id", () => {
		const client = new GatewaySocketClient();
		const settings = normalizeGatewaySettings({
			url: "ws://127.0.0.1:18789/ws",
		});

		client.connect(settings, "device-1");
		const socket = FakeWebSocket.instances[0];
		expect(socket).toBeDefined();
		socket.open();

		const requestId = client.sendAgentRequest({
			agentId: "main",
			content: "hello",
		});

		const outbound = JSON.parse(socket.sent[socket.sent.length - 1]) as {
			type: string;
			id: string;
		};
		expect(outbound.type).toBe("req:agent");
		expect(outbound.id).toBe(requestId);
	});

	test("surfaces parsed gateway errors with request context", () => {
		const onError = vi.fn();
		const client = new GatewaySocketClient({ onError });
		const settings = normalizeGatewaySettings({
			url: "ws://127.0.0.1:18789/ws",
		});

		client.connect(settings, "device-1");
		const socket = FakeWebSocket.instances[0];
		expect(socket).toBeDefined();
		socket.open();

		socket.onmessage?.({
			data: JSON.stringify({
				type: "error",
				payload: {
					message: "Agent invocation failed",
					requestId: "req-123",
				},
			}),
		} as MessageEvent);

		expect(onError).toHaveBeenCalledWith(
			"Agent invocation failed",
			expect.objectContaining({ requestId: "req-123" }),
		);
	});
});
