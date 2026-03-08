import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

describe("button styles", () => {
	it("defines hover states for shared button variants", () => {
		expect(styles).toContain(".button-primary");
		expect(styles).toContain("hover:-translate-y-px");
		expect(styles).toContain("hover:from-sky-400");
		expect(styles).toContain(".button-secondary");
		expect(styles).toContain("hover:border-sky-400/45");
		expect(styles).toContain("hover:bg-slate-800/90");
		expect(styles).toContain(".button-ghost");
		expect(styles).toContain("hover:bg-white/5");
		expect(styles).toContain("hover:text-slate-100");
	});
});
