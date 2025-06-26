import { pluginReact } from "@rsbuild/plugin-react";

export default {
	lib: [
		{ format: "esm", syntax: "es2021" },
		{ format: "cjs", syntax: "es2021" },
	],
	output: {
		target: "node",
	},
	plugins: [pluginReact(/** options here */)],
};
