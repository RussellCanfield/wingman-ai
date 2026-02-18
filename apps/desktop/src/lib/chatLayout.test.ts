import { describe, expect, test } from "vitest";
import { shouldShowThreadRail } from "./chatLayout.js";

describe("shouldShowThreadRail", () => {
	test("enables thread rail on chat route", () => {
		expect(shouldShowThreadRail("/chat")).toBe(true);
	});

	test("enables thread rail on nested chat route", () => {
		expect(shouldShowThreadRail("/chat/session-1")).toBe(true);
	});

	test("disables thread rail on non-chat routes", () => {
		expect(shouldShowThreadRail("/gateway")).toBe(false);
		expect(shouldShowThreadRail("/agents")).toBe(false);
	});
});

