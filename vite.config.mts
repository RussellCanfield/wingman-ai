import { defineConfig } from "vite";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";
import wasmPack from "vite-plugin-wasm-pack";

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
	plugins: [wasmPack(["./llm_wasm"])],
});

export default config;
