import { loadEnv, defineConfig } from "@rsbuild/core";
import path from "node:path";

export default ({ env, command, envMode }) => {
	const isProd = env === "production";
	console.log("Production Build:", isProd, envMode);

	const { publicVars } = loadEnv();

	return defineConfig({
		mode: isProd ? "production" : "none",
		source: {
			entry: {
				extension: "./src/extension.ts",
				server: "./src/server/index.ts",
			},
			define: {
				"process.env.PUBLIC_TELEMETRY_CONNECTIONSTRING": JSON.stringify(
					process.env.TELEMETRY_CONNECTIONSTRING,
				),
				...publicVars,
			},
		},
		tools: {
			rspack: (config) => {
				config.output = {
					...config.output,
					libraryTarget: "commonjs2",
					devtoolModuleFilenameTemplate: (info) => {
						const { absoluteResourcePath, namespace, resourcePath } = info;

						if (path.isAbsolute(absoluteResourcePath)) {
							return path.relative(
								path.join(__dirname, "out"),
								absoluteResourcePath,
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
				{
					from: "./audio/ui-notification.mp3",
					to: "audio",
				},
			],
			cleanDistPath: false,
			minify: isProd,
			sourceMap: !isProd,
			target: "node",
			externals: {
				vscode: "commonjs vscode",
				"./lancedb.darwin-arm64.node": "commonjs ./lancedb.darwin-arm64.node",
				"./lancedb.darwin-x64.node": "commonjs ./lancedb.darwin-x64.node",
				"./lancedb.darwin-universal.node":
					"commonjs ./lancedb.darwin-universal.node",

				// Linux (GNU)
				"./lancedb.linux-x64-gnu.node": "commonjs ./lancedb.linux-x64-gnu.node",
				"./lancedb.linux-arm64-gnu.node":
					"commonjs ./lancedb.linux-arm64-gnu.node",

				// Linux (musl)
				"./lancedb.linux-x64-musl.node":
					"commonjs ./lancedb.linux-x64-musl.node",
				"./lancedb.linux-arm64-musl.node":
					"commonjs ./lancedb.linux-arm64-musl.node",

				// Windows
				"./lancedb.win32-x64-msvc.node":
					"commonjs ./lancedb.win32-x64-msvc.node",
				"./lancedb.win32-arm64-msvc.node":
					"commonjs ./lancedb.win32-arm64-msvc.node",

				// macOS
				"./ast-grep-napi.darwin-arm64.node":
					"commonjs ./ast-grep-napi.darwin-arm64.node",
				"./ast-grep-napi.darwin-x64.node":
					"commonjs ./ast-grep-napi.darwin-x64.node",
				"./ast-grep-napi.darwin-universal.node":
					"commonjs ./ast-grep-napi.darwin-universal.node",

				// Linux GNU
				"./ast-grep-napi.linux-x64-gnu.node":
					"commonjs ./ast-grep-napi.linux-x64-gnu.node",
				"./ast-grep-napi.linux-arm64-gnu.node":
					"commonjs ./ast-grep-napi.linux-arm64-gnu.node",

				// Linux musl
				"./ast-grep-napi.linux-x64-musl.node":
					"commonjs ./ast-grep-napi.linux-x64-musl.node",
				"./ast-grep-napi.linux-arm64-musl.node":
					"commonjs ./ast-grep-napi.linux-arm64-musl.node",

				// Windows
				"./ast-grep-napi.win32-x64-msvc.node":
					"commonjs ./ast-grep-napi.win32-x64-msvc.node",
				"./ast-grep-napi.win32-arm64-msvc.node":
					"commonjs ./ast-grep-napi.win32-arm64-msvc.node",
			},
			distPath: {
				root: "out",
			},
		},
	});
};
