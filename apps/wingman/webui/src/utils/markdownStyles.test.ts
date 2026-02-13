import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesPath = new URL("../styles.css", import.meta.url);

describe("markdown styles", () => {
	it("prevents long markdown tokens from overflowing chat layout", () => {
		const css = readFileSync(stylesPath, "utf8");
		const containerRule = css.match(/\.markdown-content\s*\{[^}]*\}/);

		expect(containerRule?.[0]).toContain("@apply break-words;");
		expect(containerRule?.[0]).toContain("overflow-wrap: anywhere;");
	});

	it("applies compact paragraph spacing in markdown content", () => {
		const css = readFileSync(stylesPath, "utf8");
		const paragraphRule = css.match(/\.markdown-content p\s*\{[^}]*\}/);

		expect(paragraphRule?.[0]).toContain("@apply mb-2 last:mb-0;");
	});
});
