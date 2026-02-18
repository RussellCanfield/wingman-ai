import { describe, expect, test } from "vitest";
import { normalizeGatewaySettings } from "./gatewayConfig.js";
import { mergeGatewaySettingsFromNative } from "./runtimeSettings.js";

describe("mergeGatewaySettingsFromNative", () => {
	test("preserves token and password when native payload is blank", () => {
		const existing = normalizeGatewaySettings({
			url: "ws://127.0.0.1:18789/ws",
			token: "secret-token",
			password: "secret-password",
		});

		const merged = mergeGatewaySettingsFromNative(existing, {
			url: "ws://127.0.0.1:18789/ws",
			token: "",
			password: "   ",
		});

		expect(merged.token).toBe("secret-token");
		expect(merged.password).toBe("secret-password");
	});

	test("accepts non-empty native token/password updates", () => {
		const existing = normalizeGatewaySettings({
			token: "old-token",
			password: "old-password",
		});

		const merged = mergeGatewaySettingsFromNative(existing, {
			token: "new-token",
			password: "new-password",
		});

		expect(merged.token).toBe("new-token");
		expect(merged.password).toBe("new-password");
	});

	test("keeps existing URL when native URL is blank", () => {
		const existing = normalizeGatewaySettings({
			url: "ws://gateway.example/ws",
		});
		const merged = mergeGatewaySettingsFromNative(existing, {
			url: " ",
		});
		expect(merged.url).toBe("ws://gateway.example/ws");
	});
});
