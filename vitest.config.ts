import { defineConfig } from "vitest/config";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "node:path";

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
		alias: {
			"@shared": path.resolve(__dirname, "./shared/src"),
		},
	},
	resolve: {
		conditions: ["import", "node"],
	},
});
