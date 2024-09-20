import { defineConfig } from "@rsbuild/core";

export default defineConfig({
	source: {
		entry: {
			extension: "./src/extension.ts",
			server: "./src/server/index.ts",
			client: "./src/client/index.ts",
		},
		define: {
			PLATFORM: "win32",
			ARCH: "x64",
		},
	},
	dev: {
		writeToDisk: true,
	},
	output: {
		copy: [
			{ from: "./node_modules/gpt-3-encoder/encoder.json" },
			{ from: "./node_modules/gpt-3-encoder/vocab.bpe" },
		],
		cleanDistPath: true,
		sourceMap: {
			js: "source-map",
		},
		target: "node",
		externals: {
			vscode: "vscode",
		},
		distPath: {
			root: "out",
		},
	},
});
