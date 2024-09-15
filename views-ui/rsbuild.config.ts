import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";

export default defineConfig({
	server: {
		open: false,
	},
	source: {
		entry: {
			views: "./src/index.tsx",
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
			css: "[name].[contenthash:8].css",
		},
	},
	security: {
		nonce: "CSP_NONCE_PLACEHOLDER",
	},
	html: {
		template: "./index.html",
		tags: [
			{
				tag: "link",
				attrs: {
					rel: "stylesheet",
					uri: "CODICONS_URI",
					none: "CSP_NONCE_PLACEHOLDER",
				},
			},
		],
	},
	plugins: [pluginReact()],
});
