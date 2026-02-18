import { describe, expect, test } from "vitest";
import { getWorkspaceShellClass } from "./layoutShell";

describe("getWorkspaceShellClass", () => {
	test("uses full-height chat shell without lg py override", () => {
		const classes = getWorkspaceShellClass(true);
		expect(classes).toContain("pb-12");
		expect(classes).toContain("pt-8");
		expect(classes).toContain("lg:h-dvh");
		expect(classes).toContain("lg:overflow-hidden");
		expect(classes).not.toContain("lg:py-6");
	});

	test("uses standard shell spacing outside chat route", () => {
		const classes = getWorkspaceShellClass(false);
		expect(classes).toContain("pb-16");
		expect(classes).toContain("pt-8");
		expect(classes).not.toContain("lg:h-dvh");
		expect(classes).not.toContain("lg:overflow-hidden");
	});
});
