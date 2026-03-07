import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const requiredExclusions = [
	"!src/tests/**",
	"!src/**/tests/**",
	"!src/**/*.test.ts",
	"!src/**/*.test.tsx",
	"!src/**/*.integration.test.ts",
];

describe("rslib build config", () => {
	it("excludes test sources from bundleless entries and declaration generation", async () => {
		const { default: config } = await import("../../rslib.config.mjs");
		const tsconfigBuild = JSON.parse(
			readFileSync(
				new URL("../../tsconfig.build.json", import.meta.url),
				"utf-8",
			),
		) as {
			compilerOptions?: {
				composite?: boolean;
				incremental?: boolean;
			};
			exclude?: string[];
		};

		for (const lib of config.lib) {
			expect(lib.bundle).toBe(false);
			expect(lib.source?.tsconfigPath).toBe("./tsconfig.build.json");
			expect(lib.source?.entry?.index).toEqual(
				expect.arrayContaining(["src/**", ...requiredExclusions]),
			);
		}

		expect(tsconfigBuild.compilerOptions).toMatchObject({
			composite: false,
			incremental: false,
		});
		expect(tsconfigBuild.exclude).toEqual(
			expect.arrayContaining([
				"src/tests/**",
				"src/**/tests/**",
				"src/**/*.test.ts",
				"src/**/*.test.tsx",
				"src/**/*.integration.test.ts",
			]),
		);
	});
});
