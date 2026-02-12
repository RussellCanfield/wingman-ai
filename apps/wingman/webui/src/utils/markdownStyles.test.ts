import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesPath = new URL("../styles.css", import.meta.url);

describe("markdown styles", () => {
	it("removes paragraph bottom margin in markdown content", () => {
		const css = readFileSync(stylesPath, "utf8");
		const paragraphRule = css.match(/\.markdown-content p\s*\{[^}]*\}/);

		expect(paragraphRule?.[0]).toContain("@apply mb-0;");
		expect(paragraphRule?.[0]).not.toContain("mb-2");
	});
});
