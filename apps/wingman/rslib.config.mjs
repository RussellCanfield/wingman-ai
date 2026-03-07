import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

const dependencies = Object.keys(pkg.dependencies || {});
const nonTestSourceEntries = [
	"src/**",
	"!src/tests/**",
	"!src/**/tests/**",
	"!src/**/*.test.ts",
	"!src/**/*.test.tsx",
	"!src/**/*.integration.test.ts",
];

export default {
	lib: [
		{
			format: "esm",
			syntax: "es2021",
			dts: true,
			bundle: false,
			source: {
				entry: {
					index: nonTestSourceEntries,
				},
				tsconfigPath: "./tsconfig.build.json",
			},
		},
		{
			format: "cjs",
			syntax: "es2021",
			dts: true,
			bundle: false,
			source: {
				entry: {
					index: nonTestSourceEntries,
				},
				tsconfigPath: "./tsconfig.build.json",
			},
		},
	],
	external: dependencies,
};
