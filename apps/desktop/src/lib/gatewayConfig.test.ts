import { describe, expect, test } from "vitest";
import {
	isGatewayConfigValid,
	normalizeGatewaySettings,
	resolveGatewayUiUrl,
} from "./gatewayConfig.js";

describe("gateway settings", () => {
	test("normalizes whitespace and applies the default URL", () => {
		const settings = normalizeGatewaySettings({
			url: "   ",
			token: "  abc  ",
			sessionKey: " thread-1 ",
		});

		expect(settings.url).toBe("ws://127.0.0.1:18789/ws");
		expect(settings.token).toBe("abc");
		expect(settings.sessionKey).toBe("thread-1");
	});

	test("derives control UI URL from websocket URL when no override exists", () => {
		const settings = normalizeGatewaySettings({
			url: "wss://example.com/ws",
		});

		expect(resolveGatewayUiUrl(settings)).toBe("https://example.com");
	});

	test("normalizes wildcard localhost host for client requests", () => {
		const settings = normalizeGatewaySettings({
			url: "ws://0.0.0.0:18789/ws",
		});

		expect(resolveGatewayUiUrl(settings)).toBe("http://127.0.0.1:18789");
	});

	test("flags invalid gateway URL values", () => {
		const settings = normalizeGatewaySettings({
			url: "not a url",
		});

		expect(isGatewayConfigValid(settings)).toBe(false);
	});
});
