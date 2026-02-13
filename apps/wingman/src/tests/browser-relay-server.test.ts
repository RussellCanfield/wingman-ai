import { describe, expect, it } from "vitest";
import { isLoopbackHost } from "@/gateway/browserRelayServer.js";

describe("browser relay server", () => {
	it("accepts loopback hosts", () => {
		expect(isLoopbackHost("127.0.0.1")).toBe(true);
		expect(isLoopbackHost("localhost")).toBe(true);
		expect(isLoopbackHost("::1")).toBe(true);
	});

	it("rejects non-loopback hosts", () => {
		expect(isLoopbackHost("0.0.0.0")).toBe(false);
		expect(isLoopbackHost("192.168.1.4")).toBe(false);
		expect(isLoopbackHost("example.com")).toBe(false);
	});
});

