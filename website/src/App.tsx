import { useEffect } from "react";
import Footer from "./components/layout/Footer";
import Header from "./components/layout/Header";
import CTA from "./components/sections/CTA";
import Features from "./components/sections/Features";
import Hero from "./components/sections/Hero";
import HowItWorks from "./components/sections/HowItWorks";
import QuickStart from "./components/sections/QuickStart";
import UseCases from "./components/sections/UseCases";

function App() {
	// Scroll to anchor links smoothly
	useEffect(() => {
		const handleAnchorClick = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			const closestAnchor = target.closest("a");

			if (
				closestAnchor &&
				closestAnchor.getAttribute("href")?.startsWith("#") &&
				!closestAnchor.getAttribute("href")?.includes("://")
			) {
				e.preventDefault();
				const targetId = closestAnchor.getAttribute("href")?.substring(1);
				if (targetId) {
					const targetElement = document.getElementById(targetId);
					if (targetElement) {
						window.scrollTo({
							top: targetElement.offsetTop - 80, // Offset for header
							behavior: "smooth",
						});
					}
				}
			}
		};

		document.addEventListener("click", handleAnchorClick);
		return () => document.removeEventListener("click", handleAnchorClick);
	}, []);

	return (
		<div className="relative min-h-screen overflow-hidden">
			{/* Background effects */}
			<div className="aurora" />
			<div className="orb orb-a" />
			<div className="orb orb-b" />
			<div className="orb orb-c" />
			<div className="gridlines" />
			<div className="noise" />

			{/* Content */}
			<Header />
			<main>
				<Hero />
				<HowItWorks />
				<UseCases />
				<Features />
				<QuickStart />
				<CTA />
			</main>
			<Footer />
		</div>
	);
}

export default App;
