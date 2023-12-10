import { defineConfig } from "vite";
import path, { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

/** @type {import('vite').UserConfig} */
const config = defineConfig({
	resolve: {
		alias: {
			"@node-llama": path.resolve(__dirname, "./node-llama-cpp/dist"),
		},
	},
	build: {
		ssr: true,
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
					src: resolve(__dirname, "./llamaBins"),
					dest: ".",
				},
				{
					src: resolve(__dirname, "./src/models"),
					dest: ".",
				},
			],
		}),
	],
});

export default config;
