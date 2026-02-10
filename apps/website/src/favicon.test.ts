import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const websiteIndexPath = new URL("../index.html", import.meta.url);
const favicon32Path = new URL("../public/favicon-32x32.png", import.meta.url);
const favicon64Path = new URL("../public/favicon-64x64.png", import.meta.url);

describe("website favicon", () => {
	it("links desktop favicons in index.html", () => {
		const html = readFileSync(websiteIndexPath, "utf8");
		expect(html).toContain(
			'<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />'
		);
		expect(html).toContain(
			'<link rel="icon" type="image/png" sizes="64x64" href="/favicon-64x64.png" />'
		);
	});

	it("includes desktop favicon assets in public directory", () => {
		expect(existsSync(favicon32Path)).toBe(true);
		expect(existsSync(favicon64Path)).toBe(true);
	});
});
