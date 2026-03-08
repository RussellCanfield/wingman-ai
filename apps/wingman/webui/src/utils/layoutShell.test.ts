import { describe, expect, test } from "vitest";
import {
	getWorkspaceContentClass,
	getWorkspaceGridClass,
	getWorkspaceShellClass,
	getWorkspaceViewportClass,
} from "./layoutShell";

describe("workspace layout helpers", () => {
	test("uses a single full-height shell for every route", () => {
		const classes = getWorkspaceShellClass();
		expect(classes).toContain("box-border");
		expect(classes).toContain("h-dvh");
		expect(classes).toContain("overflow-hidden");
		expect(classes).toContain("pb-12");
		expect(classes).toContain("pt-8");
	});

	test("keeps the shared grid and content panels shrink-safe", () => {
		expect(getWorkspaceGridClass()).toContain(
			"lg:grid-cols-[280px_minmax(0,1fr)]",
		);
		expect(getWorkspaceGridClass()).toContain("h-full");
		expect(getWorkspaceGridClass()).toContain("min-h-0");
		expect(getWorkspaceContentClass()).toContain("min-w-0");
		expect(getWorkspaceContentClass()).toContain(
			"flex h-full min-h-0 flex-col overflow-hidden",
		);
	});

	test("keeps route panels scrollable inside the shared shell", () => {
		const classes = getWorkspaceViewportClass();
		expect(classes).toContain("min-h-0");
		expect(classes).toContain("flex-1");
		expect(classes).toContain("overflow-y-auto");
		expect(classes).toContain("overflow-x-hidden");
	});
});
