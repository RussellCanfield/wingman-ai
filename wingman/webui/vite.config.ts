import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
	root: __dirname,
	plugins: [react()],
	server: {
		proxy: {
			"/api": {
				target: "http://127.0.0.1:18789",
				changeOrigin: true,
			},
			"/webhooks": {
				target: "http://127.0.0.1:18789",
				changeOrigin: true,
			},
			"/ws": {
				target: "http://127.0.0.1:18789",
				ws: true,
			},
		},
	},
	base: "/",
	build: {
		outDir: resolve(__dirname, "../dist/webui"),
		emptyOutDir: true,
	},
});
