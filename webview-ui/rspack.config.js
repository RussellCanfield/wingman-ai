// @ts-check

const rspack = require("@rspack/core");
const path = require("path");

/** @type {import('@rspack/cli').Configuration} */
const config = {
	entry: "./src/index.tsx",
	target: "node",
	resolve: {
		tsConfigPath: path.resolve(__dirname, "tsconfig.json"),
	},
	output: {
		clean: true,
	},
	module: {
		rules: [
			{
				test: /\.(ts|tsx)$/,
				use: {
					loader: "builtin:swc-loader",
					options: {
						sourceMap: true,
						jsc: {
							parser: {
								syntax: "typescript",
								jsx: true,
							},
							externalHelpers: true,
							preserveAllComments: false,
							transform: {
								react: {
									runtime: "automatic",
									throwIfNamespace: true,
									useBuiltins: false,
								},
							},
						},
					},
				},
				type: "javascript/auto",
			},
		],
	},
	plugins: [
		new rspack.HtmlRspackPlugin({
			template: "./index.html",
		}),
	],
};
module.exports = config;
