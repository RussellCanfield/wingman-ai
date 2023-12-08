import { defineConfig } from "vite";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";
import topLevelAwait from "vite-plugin-top-level-await";
import wasmPack from "vite-plugin-wasm-pack";
import wasm from "vite-plugin-wasm";

/** @type {import('vite').UserConfig} */
const config = defineConfig({
	assetsInclude: ["**/*.wasm"],
	build: {
		lib: {
			entry: "./src/extension.ts",
			formats: ["cjs"],
			fileName: "extension",
		},
		rollupOptions: {
			external: ["vscode"],
			input: {
				extension: resolve(__dirname, "src/extension.ts"),
				index: resolve(__dirname, "src/webview-ui/index.tsx"),
			},
			output: {
				entryFileNames: "[name].js",
			},
		},
		sourcemap: true,
		outDir: "out",
	},
	define: {
		"process.env": process.env,
	},
	plugins: [
		viteStaticCopy({
			targets: [
				{
					src: resolve(__dirname, "src/wasm"),
					dest: ".",
				},
				{
					src: resolve(__dirname, "src/js"),
					dest: ".",
				},
			],
		}),
		wasm(),
		topLevelAwait(),
		//wasmPack(["./llm_wasm"]),
	],
});

export default config;
