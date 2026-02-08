import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		host: "127.0.0.1",
		port: 1420,
		strictPort: true,
	},
	build: {
		rollupOptions: {
			input: {
				main: resolve(__dirname, "index.html"),
				overlay: resolve(__dirname, "overlay.html"),
			},
		},
	},
});
