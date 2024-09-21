import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

export default defineConfig({
	server: {
		open: false,
	},
	source: {
		entry: {
			chat: "./src/Chat/index.tsx",
			config: "./src/Config/index.tsx",
			diff: "./src/Diff/index.tsx",
		},
	},
	performance: {
		chunkSplit: {
			strategy: "single-vendor",
		},
	},
	dev: {
		writeToDisk: true,
	},
	output: {
		distPath: {
			root: "../out/views",
			js: "static",
			css: "static",
		},
		filename: {
			js: "[name].js",
			css: "[name].css",
		},
	},
	security: {
		nonce: "CSP_NONCE_PLACEHOLDER",
	},
	html: {
		template: "./index.html",
	},
	plugins: [pluginReact()],
});
