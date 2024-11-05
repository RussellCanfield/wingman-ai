/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./src/**/*.{html,js,ts,jsx,tsx}"],
	safelist: ["bg-code-light", "bg-code-dark"],
	theme: {
		extend: {
			animation: {
				"spin-slow": "spin 3s linear infinite",
			},
			colors: {
				code: {
					light: "#f6f8fa",
					dark: "#151b23",
				},
			},
		},
	},
	plugins: [],
};
