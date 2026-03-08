import { describe, expect, test } from "vitest";
import {
	buildDesktopChatRoute,
	getDisplayedThreadId,
	getThreadIdFromSearch,
	isDesktopChatPath,
	resolveRouteThreadSelection,
} from "./threadRoute.js";

describe("threadRoute", () => {
	test("treats home and legacy chat paths as chat routes", () => {
		expect(isDesktopChatPath("/")).toBe(true);
		expect(isDesktopChatPath("/chat")).toBe(true);
		expect(isDesktopChatPath("/settings")).toBe(false);
	});

	test("parses and builds thread query state", () => {
		expect(getThreadIdFromSearch("?thread=session-1")).toBe("session-1");
		expect(getThreadIdFromSearch("?thread=")).toBeNull();
		expect(buildDesktopChatRoute("session-1")).toBe("/?thread=session-1");
		expect(buildDesktopChatRoute("")).toBe("/");
	});

	test("only exposes displayed thread selection on chat routes", () => {
		expect(
			getDisplayedThreadId({
				pathname: "/",
				search: "?thread=session-1",
			}),
		).toBe("session-1");
		expect(
			getDisplayedThreadId({
				pathname: "/settings",
				search: "?thread=session-1",
			}),
		).toBeNull();
	});

	test("resolves route-driven thread sync decisions", () => {
		expect(
			resolveRouteThreadSelection({
				pathname: "/",
				search: "?thread=session-2",
				activeThreadId: "session-1",
				threadIds: ["session-1", "session-2"],
				sessionsLoading: false,
			}),
		).toBe("session-2");

		expect(
			resolveRouteThreadSelection({
				pathname: "/",
				search: "",
				activeThreadId: "session-1",
				threadIds: ["session-1"],
				sessionsLoading: false,
			}),
		).toBeUndefined();

		expect(
			resolveRouteThreadSelection({
				pathname: "/",
				search: "?thread=missing",
				activeThreadId: "session-1",
				threadIds: [],
				sessionsLoading: true,
			}),
		).toBeUndefined();

		expect(
			resolveRouteThreadSelection({
				pathname: "/settings",
				search: "?thread=session-1",
				activeThreadId: "session-1",
				threadIds: ["session-1"],
				sessionsLoading: false,
			}),
		).toBeUndefined();
	});
});
