import { describe, expect, test } from "vitest";
import {
	formatSmsAllowlist,
	normalizeSmsAllowlist,
	normalizeSmsAllowlistEntry,
	parseSmsAllowlistInput,
	resolveSmsBridgeTestHandle,
} from "./smsBridgePreferences.js";

describe("smsBridgePreferences", () => {
	test("normalizes individual allowlist entries", () => {
		expect(normalizeSmsAllowlistEntry("  +15555550000 ")).toBe("+15555550000");
		expect(normalizeSmsAllowlistEntry("  JOHN@EXAMPLE.COM ")).toBe("john@example.com");
		expect(normalizeSmsAllowlistEntry("   ")).toBe("");
	});

	test("normalizes and deduplicates allowlist arrays", () => {
		expect(
			normalizeSmsAllowlist([
				" +15555550000",
				"+15555550000 ",
				"JOHN@EXAMPLE.COM",
				"john@example.com",
				42,
			]),
		).toEqual(["+15555550000", "john@example.com"]);
	});

	test("parses allowlist input from textarea style text", () => {
		const parsed = parseSmsAllowlistInput(
			"+15555550000, +16666660000\njohn@example.com\n\n +15555550000 ",
		);
		expect(parsed).toEqual(["+15555550000", "+16666660000", "john@example.com"]);
	});

	test("formats allowlist for textarea display", () => {
		expect(
			formatSmsAllowlist([" +15555550000", "JOHN@EXAMPLE.COM", "john@example.com"]),
		).toBe("+15555550000\njohn@example.com");
	});

	test("resolves first normalized handle for bridge test", () => {
		expect(resolveSmsBridgeTestHandle([" +15555550000 ", "john@example.com"])).toBe(
			"+15555550000",
		);
		expect(resolveSmsBridgeTestHandle(["   ", ""])).toBeNull();
	});
});
