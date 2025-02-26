/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./src/**/*.{html,js,ts,jsx,tsx}"],
	safelist: ["bg-code-light", "bg-code-dark"],
	theme: {
		extend: {
			animation: {
				"spin-slow": "spin 3s linear infinite",
				gradient: 'gradient-animation 3s ease infinite',
			},
			colors: {
				code: {
					light: "#f6f8fa",
					dark: "#151b23",
				},
			},
			keyframes: {
				'gradient-animation': {
					'0%': { backgroundPosition: '0% 50%' },
					'50%': { backgroundPosition: '100% 50%' },
					'100%': { backgroundPosition: '0% 50%' },
				},
				'fadeIn': {
					'0%': { opacity: '0' },
					'100%': { opacity: '1' },
				},
			},
		},
	},
	plugins: [],
};
