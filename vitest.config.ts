import { defineConfig } from "vitest/config";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
	plugins: [
		nodePolyfills({
			include: ["path", "fs", "util", "buffer", "process"],
		}),
	],
	test: {
		globals: true,
		environment: "node",
		setupFiles: ["./vitest.setup.ts"],
		exclude: ["**/node_modules/**", "**/dist/**", "**/out/**"],
	},
	resolve: {
		conditions: ["import", "node"],
	},
});
