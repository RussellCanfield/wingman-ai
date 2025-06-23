import * as path from "node:path";
import { defineConfig } from "rspress/config";

export default defineConfig({
	root: path.join(__dirname, "docs"),
	title: "Wingman-AI",
	description: "Wingman-AI Documentation",
	icon: "/icon.png",
	logo: {
		light: "/Logo-black.png",
		dark: "/Logo-white.png",
	},
	themeConfig: {
		socialLinks: [
			{
				icon: "github",
				mode: "link",
				content: "https://github.com/RussellCanfield/wingman-ai",
			},
		],
	},
});
