import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const configPath = new URL("../rspress.config.ts", import.meta.url);
const favicon32Path = new URL("../docs/public/favicon-32x32.png", import.meta.url);
const favicon64Path = new URL("../docs/public/favicon-64x64.png", import.meta.url);

describe("docs website favicon", () => {
	it("uses desktop favicon in rspress config", () => {
		const config = readFileSync(configPath, "utf8");
		expect(config).toMatch(/icon:\s*['"]\/favicon-32x32\.png['"]/);
	});

	it("includes desktop favicon assets in public directory", () => {
		expect(existsSync(favicon32Path)).toBe(true);
		expect(existsSync(favicon64Path)).toBe(true);
	});
});
