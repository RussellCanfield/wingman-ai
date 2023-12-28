import { defineConfig } from "vite";
import path, { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

/** @type {import('vite').UserConfig} */
const config = defineConfig({
	assetsInclude: ["**/*.ttf"],
	publicDir: "./src/webview-ui/public",
	resolve: {
		alias: {
			"@node-llama": path.resolve(__dirname, "./node-llama-cpp/dist"),
		},
	},
	build: {
		lib: {
			entry: "./src/extension.ts",
		},
		rollupOptions: {
			external: ["vscode"],
			input: {
				extension: resolve(__dirname, "src/extension.ts"),
				index: resolve(__dirname, "src/webview-ui/index.tsx"),
			},
			output: [
				{
					format: "cjs",
					entryFileNames: "[name].js",
				},
				{
					format: "es",
					entryFileNames: "[name].[format].js",
				},
			],
		},
		sourcemap: false,
		outDir: "out",
	},
	define: {
		"process.env": process.env,
	},
	plugins: [
		// viteStaticCopy({
		// 	targets: [
		// 		{
		// 			src: resolve(__dirname, "./llamaBins"),
		// 			dest: ".",
		// 		},
		// 		{
		// 			src: resolve(__dirname, "./models"),
		// 			dest: ".",
		// 		},
		// 	],
		// }),
	],
});

export default config;
