import { describe, expect, test } from "vitest";
import { shouldRouteToGatewayOnFailure } from "./connectionRouting.js";

describe("shouldRouteToGatewayOnFailure", () => {
	test("does not route when still connected/connecting", () => {
		expect(shouldRouteToGatewayOnFailure("connected", "Connected")).toBe(false);
		expect(shouldRouteToGatewayOnFailure("connecting", "Testing gateway...")).toBe(false);
	});

	test("does not route for baseline disconnected messaging", () => {
		expect(shouldRouteToGatewayOnFailure("disconnected", "Disconnected")).toBe(false);
		expect(shouldRouteToGatewayOnFailure("disconnected", "Not connected to gateway")).toBe(false);
	});

	test("routes for disconnected error states", () => {
		expect(
			shouldRouteToGatewayOnFailure(
				"disconnected",
				"Gateway unreachable. Verify URL and that gateway is running.",
			),
		).toBe(true);
		expect(shouldRouteToGatewayOnFailure("disconnected", "Gateway requires token/password")).toBe(
			true,
		);
		expect(shouldRouteToGatewayOnFailure("disconnected", "Invalid gateway URL")).toBe(true);
	});
});
