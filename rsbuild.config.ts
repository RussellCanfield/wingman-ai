import { defineConfig } from "@rsbuild/core";

export default ({ env, command, envMode }) => {
	const isProd = env === "production";
	console.log("Production Build:", isProd);
	return defineConfig({
		source: {
			entry: {
				extension: "./src/extension.ts",
				server: "./src/server/index.ts",
				client: "./src/client/index.ts",
			},
			define: {
				PLATFORM: "win32",
				ARCH: "x64",
			},
		},
		dev: {
			writeToDisk: true,
		},
		output: {
			copy: [
				{ from: "./node_modules/gpt-3-encoder/encoder.json" },
				{ from: "./node_modules/gpt-3-encoder/vocab.bpe" },
			],
			cleanDistPath: false,
			minify: isProd,
			sourceMap: {
				js: isProd ? false : "source-map",
			},
			target: "node",
			externals: {
				vscode: "vscode",
			},
			distPath: {
				root: "out",
			},
		},
	});
};
