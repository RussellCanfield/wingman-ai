import { describe, expect, test } from "vitest";
import { summarizeGatewayConnectionFailure } from "./connectionStatus.js";

describe("summarizeGatewayConnectionFailure", () => {
	test("maps transport/load failures to friendly message", () => {
		const summary = summarizeGatewayConnectionFailure(
			"config failed: TypeError: Load failed | health failed: TypeError: Load failed",
		);
		expect(summary).toBe("Gateway unreachable. Verify URL and that gateway is running.");
	});

	test("maps auth failures to friendly message", () => {
		const summary = summarizeGatewayConnectionFailure("auth failed: 401");
		expect(summary).toBe("Gateway authentication failed. Check token/password.");
	});

	test("maps invalid url failures", () => {
		const summary = summarizeGatewayConnectionFailure("Invalid gateway URL");
		expect(summary).toBe("Invalid gateway URL.");
	});

	test("falls back to generic failure message", () => {
		const summary = summarizeGatewayConnectionFailure("unexpected gateway issue");
		expect(summary).toBe("Gateway request failed.");
	});
});

