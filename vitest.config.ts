import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["**/src/**/*.test.{ts,tsx,js,jsx}"],
		exclude: ["**/node_modules/**", "**/dist/**", "**/out/**"],
	},
	resolve: {
		conditions: ["import", "node"],
		alias: {
			"@": resolve(__dirname, "apps", "wingman", "src"),
		},
	},
});
