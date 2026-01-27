const path = require("node:path");

module.exports = {
	content: [
		path.join(__dirname, "index.html"),
		path.join(__dirname, "src/**/*.{ts,tsx}"),
	],
	theme: {
		extend: {
			colors: {
				ink: "#12110f",
				sand: "#f2ece4",
				accent: "#008d73",
				accentWarm: "#ff7a3d",
			},
			fontFamily: {
				display: ["Sora", "system-ui", "-apple-system", "sans-serif"],
				mono: [
					"JetBrains Mono",
					"ui-monospace",
					"SFMono-Regular",
					"Menlo",
					"Consolas",
					"monospace",
				],
			},
			boxShadow: {
				glow: "0 0 0 1px rgba(0, 141, 115, 0.12), 0 18px 42px rgba(0, 141, 115, 0.18)",
			},
			keyframes: {
				drift: {
					"0%, 100%": { transform: "translate3d(0, 0, 0)" },
					"50%": { transform: "translate3d(40px, -30px, 0)" },
				},
				floatIn: {
					"0%": { opacity: "0", transform: "translateY(18px)" },
					"100%": { opacity: "1", transform: "translateY(0)" },
				},
				rise: {
					"0%": { opacity: "0", transform: "translateY(12px)" },
					"100%": { opacity: "1", transform: "translateY(0)" },
				},
				pulseSoft: {
					"0%": { boxShadow: "0 0 0 0 rgba(0, 141, 115, 0.4)" },
					"70%": { boxShadow: "0 0 0 8px rgba(0, 141, 115, 0)" },
					"100%": { boxShadow: "0 0 0 0 rgba(0, 141, 115, 0)" },
				},
			},
			animation: {
				drift: "drift 14s ease-in-out infinite",
				floatIn: "floatIn 0.7s cubic-bezier(0.22, 0.61, 0.36, 1)",
				rise: "rise 0.6s cubic-bezier(0.22, 0.61, 0.36, 1)",
				pulseSoft: "pulseSoft 1.6s ease-in-out infinite",
			},
		},
	},
	plugins: [],
};
