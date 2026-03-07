import { describe, expect, test } from "vitest";
import {
	getWorkspaceContentClass,
	getWorkspaceGridClass,
	getWorkspaceShellClass,
} from "./layoutShell";

describe("getWorkspaceShellClass", () => {
	test("uses full-height chat shell without lg py override", () => {
		const classes = getWorkspaceShellClass(true);
		expect(classes).toContain("box-border");
		expect(classes).toContain("pb-12");
		expect(classes).toContain("pt-8");
		expect(classes).toContain("h-dvh");
		expect(classes).toContain("overflow-hidden");
		expect(classes).not.toContain("lg:py-6");
	});

	test("uses standard shell spacing outside chat route", () => {
		const classes = getWorkspaceShellClass(false);
		expect(classes).toContain("pb-16");
		expect(classes).toContain("pt-8");
		expect(classes).toContain("box-border");
		expect(classes).not.toContain("h-dvh");
		expect(classes).not.toContain("overflow-hidden");
	});
});

describe("workspace layout helpers", () => {
	test("keeps the desktop grid shrink-safe on chat routes", () => {
		const classes = getWorkspaceGridClass(true);
		expect(classes).toContain("lg:grid-cols-[280px_minmax(0,1fr)]");
		expect(classes).toContain("h-full");
		expect(classes).toContain("min-h-0");
	});

	test("keeps content width-safe for chat and non-chat routes", () => {
		expect(getWorkspaceContentClass(true)).toContain("min-w-0");
		expect(getWorkspaceContentClass(true)).toContain(
			"flex h-full min-h-0 flex-col overflow-hidden",
		);
		expect(getWorkspaceContentClass(false)).toContain("min-w-0");
		expect(getWorkspaceContentClass(false)).toContain("space-y-6");
	});
});
