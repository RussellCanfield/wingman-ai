const path = require("node:path");

module.exports = {
	content: [
		path.join(__dirname, "index.html"),
		path.join(__dirname, "src/**/*.{ts,tsx}"),
	],
	theme: {
		extend: {
			colors: {
				ink: "#e2e8f0",
				sand: "#0b1120",
				accent: "#38bdf8",
				accentWarm: "#3b82f6",
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
				glow: "0 0 0 1px rgba(56, 189, 248, 0.15), 0 18px 42px rgba(59, 130, 246, 0.24)",
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
					"0%": { boxShadow: "0 0 0 0 rgba(56, 189, 248, 0.5)" },
					"70%": { boxShadow: "0 0 0 8px rgba(56, 189, 248, 0)" },
					"100%": { boxShadow: "0 0 0 0 rgba(56, 189, 248, 0)" },
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
