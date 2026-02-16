import { describe, expect, it } from "vitest";
import { resolveSandboxName } from "./sandbox-name";

describe("resolveSandboxName", () => {
	it("uses x-wingman-sandbox header when provided", () => {
		const request = new Request("https://wingman.example.com", {
			headers: {
				"x-wingman-sandbox": "project-alpha",
			},
		});

		expect(resolveSandboxName(request)).toBe("project-alpha");
	});

	it("falls back to hostname when x-wingman-sandbox header is blank", () => {
		const request = new Request("https://wingman.example.com", {
			headers: {
				"x-wingman-sandbox": "   ",
			},
		});

		expect(resolveSandboxName(request)).toBe("wingman-wingman-example-com");
	});

	it("falls back to a sanitized hostname", () => {
		const request = new Request("https://wingman.ai:18789/path");
		expect(resolveSandboxName(request)).toBe("wingman-wingman-ai");
	});
});
