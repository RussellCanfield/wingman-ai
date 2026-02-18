import { describe, expect, it } from "vitest";
import {
	isGatewayOriginAllowed,
	isLoopbackHostname,
} from "@/gateway/server.js";

describe("gateway origin policy", () => {
	it("identifies loopback hostnames", () => {
		expect(isLoopbackHostname("127.0.0.1")).toBe(true);
		expect(isLoopbackHostname("localhost")).toBe(true);
		expect(isLoopbackHostname("[::1]")).toBe(true);
		expect(isLoopbackHostname("example.com")).toBe(false);
	});

	it("allows loopback development origins", () => {
		const allowed = isGatewayOriginAllowed({
			origin: "http://localhost:5173",
			requestUrl: "http://127.0.0.1:18789/api/sessions",
			gatewayHost: "127.0.0.1",
			gatewayPort: 18789,
			controlUiEnabled: true,
			controlUiPort: 18790,
		});
		expect(allowed).toBe(true);
	});

	it("allows tauri loopback origins for desktop clients", () => {
		const allowed = isGatewayOriginAllowed({
			origin: "tauri://localhost",
			requestUrl: "http://127.0.0.1:18789/api/sessions",
			gatewayHost: "127.0.0.1",
			gatewayPort: 18789,
			controlUiEnabled: true,
			controlUiPort: 18790,
		});
		expect(allowed).toBe(true);
	});

	it("rejects unrelated internet origins", () => {
		const allowed = isGatewayOriginAllowed({
			origin: "https://evil.example",
			requestUrl: "http://127.0.0.1:18789/api/sessions",
			gatewayHost: "127.0.0.1",
			gatewayPort: 18789,
			controlUiEnabled: true,
			controlUiPort: 18790,
		});
		expect(allowed).toBe(false);
	});

	it("allows same-host control UI origin on configured port", () => {
		const allowed = isGatewayOriginAllowed({
			origin: "http://192.168.1.50:18790",
			requestUrl: "http://192.168.1.50:18789/api/sessions",
			gatewayHost: "0.0.0.0",
			gatewayPort: 18789,
			controlUiEnabled: true,
			controlUiPort: 18790,
		});
		expect(allowed).toBe(true);
	});

	it("rejects same-host origins on unapproved ports", () => {
		const allowed = isGatewayOriginAllowed({
			origin: "http://192.168.1.50:9999",
			requestUrl: "http://192.168.1.50:18789/api/sessions",
			gatewayHost: "0.0.0.0",
			gatewayPort: 18789,
			controlUiEnabled: true,
			controlUiPort: 18790,
		});
		expect(allowed).toBe(false);
	});

	it("rejects tauri origins for non-loopback gateways", () => {
		const allowed = isGatewayOriginAllowed({
			origin: "tauri://localhost",
			requestUrl: "http://192.168.1.50:18789/api/sessions",
			gatewayHost: "0.0.0.0",
			gatewayPort: 18789,
			controlUiEnabled: true,
			controlUiPort: 18790,
		});
		expect(allowed).toBe(false);
	});
});
