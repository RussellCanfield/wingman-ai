import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

const dependencies = Object.keys(pkg.dependencies || {});

export default {
	lib: [
		{ format: "esm", syntax: "es2021", dts: true, bundle: false },
		{ format: "cjs", syntax: "es2021", dts: true, bundle: false },
	],
	external: dependencies,
};