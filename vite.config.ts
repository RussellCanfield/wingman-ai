import { resolve } from "path";

/** @type {import('vite').UserConfig} */
export default {
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
	plugins: [],
};
