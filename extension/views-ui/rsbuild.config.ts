import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import path from "node:path";

export default ({ env, command, envMode }) => {
	const isProd = env === "production";
	console.log("Production Build:", isProd, envMode);

	return defineConfig({
		server: {
			open: false,
		},
		mode: isProd ? "production" : "development",
		source: {
			entry: {
				chat: "./src/App/index.tsx",
				config: "./src/Config/index.tsx",
				diff: "./src/Diff/index.tsx",
				threads: "./src/Threads/index.tsx",
				image: "./src/ImageEditor/index.tsx",
			},
		},
		tools: {
			rspack: (config) => {
				if (config.output) {
					config.output.devtoolModuleFilenameTemplate = (info) => {
						const { absoluteResourcePath, namespace, resourcePath } = info;

						if (path.isAbsolute(absoluteResourcePath)) {
							return path.relative(
								path.join(__dirname, "out", "views"),
								absoluteResourcePath,
							);
						}

						// Mimic Webpack's default behavior:
						return `webpack://${namespace}/${resourcePath}`;
					};
				}

				return config;
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
			minify: isProd,
			sourceMap: !isProd,
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
};
