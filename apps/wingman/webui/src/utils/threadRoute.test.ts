import { describe, expect, test } from "vitest";
import {
	buildHomeChatLocation,
	getSelectedThreadIdFromLocation,
	isHomeChatRoute,
} from "./threadRoute";

describe("threadRoute", () => {
	test("recognizes the home chat route", () => {
		expect(isHomeChatRoute("/")).toBe(true);
		expect(isHomeChatRoute("/settings")).toBe(false);
	});

	test("reads the selected thread only from the home chat URL", () => {
		expect(getSelectedThreadIdFromLocation("/", "?thread=session-1")).toBe(
			"session-1",
		);
		expect(
			getSelectedThreadIdFromLocation("/settings", "?thread=session-1"),
		).toBe("");
	});

	test("builds a stable home chat URL for a selected thread", () => {
		expect(buildHomeChatLocation()).toBe("/");
		expect(buildHomeChatLocation("session-1")).toBe("/?thread=session-1");
	});
});
