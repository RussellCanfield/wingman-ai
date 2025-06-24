import { loadEnv, defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { pluginNodePolyfill } from "@rsbuild/plugin-node-polyfill";

export default ({ env, command, envMode }) => {
	const isProd = env === "production";
	console.log("Production Build:", isProd, envMode);

	const { publicVars } = loadEnv();

	return defineConfig({
		mode: isProd ? "production" : "none",
		output: {
			target: "node",
			externals: {
				"@wingman-ai/agent": "@wingman-ai/agent",
			},
		},
		plugins: [pluginReact(), pluginNodePolyfill()],
	});
};
