import { defineConfig, rspack } from "@rsbuild/core";
import path from "node:path";

export default ({ env, command, envMode }) => {
	const isProd = env === "production";
	console.log("Production Build:", isProd, envMode);

	return defineConfig({
		mode: isProd ? "production" : "none",
		source: {
			entry: {
				extension: "./src/extension.ts",
				server: "./src/server/index.ts",
			},
		},
		tools: {
			rspack: (config) => {
				config.output = {
					...config.output,
					libraryTarget: "commonjs2",
					devtoolModuleFilenameTemplate: (info) => {
						const {
							absoluteResourcePath,
							namespace,
							resourcePath,
						} = info;

						if (path.isAbsolute(absoluteResourcePath)) {
							return path.relative(
								path.join(__dirname, "out"),
								absoluteResourcePath
							);
						}

						// Mimic Webpack's default behavior:
						return `webpack://${namespace}/${resourcePath}`;
					},
				};

				return config;
			},
		},
		dev: {
			writeToDisk: true,
		},
		performance: {
			chunkSplit: {
				strategy: "single-vendor",
			},
		},
		output: {
			copy: [
				{ from: "./node_modules/gpt-3-encoder/encoder.json" },
				{ from: "./node_modules/gpt-3-encoder/vocab.bpe" },
			],
			cleanDistPath: false,
			minify: isProd,
			target: "node",
			externals: {
				vscode: "commonjs vscode",
			},
			distPath: {
				root: "out",
			},
		},
	});
};
