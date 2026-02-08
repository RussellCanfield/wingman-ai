import { motion } from "framer-motion";
import { useState } from "react";
import { FiMenu, FiX } from "react-icons/fi";
import logoImage from "../../assets/wingman_icon.webp";

const Header = () => {
	const [isMenuOpen, setIsMenuOpen] = useState(false);

	return (
		<header className="fixed w-full z-50 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800">
			<div className="container mx-auto px-4 py-4 flex items-center justify-between">
				<div className="flex items-center">
					<motion.img
						src={logoImage}
						alt="Wingman AI"
						className="h-12 mr-3"
						initial={{ opacity: 0, y: -20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5 }}
					/>
					<motion.h1
						className="text-2xl font-bold gradient-text"
						initial={{ opacity: 0, x: -20 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ duration: 0.5, delay: 0.2 }}
					>
						Wingman AI
					</motion.h1>
				</div>

				{/* Desktop Navigation */}
				<div className="hidden md:flex md:items-center space-x-8">
					<NavLinks />
				</div>

				{/* Mobile Navigation */}
				<div className="md:hidden">
					<button
						type="button"
						onClick={() => setIsMenuOpen(!isMenuOpen)}
						className="p-2 text-gray-400 hover:text-white"
						aria-label="Toggle menu"
					>
						{isMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
					</button>
				</div>
			</div>

			{/* Mobile Menu */}
			{isMenuOpen && (
				<motion.div
					className="md:hidden bg-gray-900/95 backdrop-blur-lg"
					initial={{ opacity: 0, height: 0 }}
					animate={{ opacity: 1, height: "auto" }}
					exit={{ opacity: 0, height: 0 }}
					transition={{ duration: 0.3 }}
				>
					<div className="container mx-auto px-4 py-4 flex flex-col space-y-4">
						<NavLinks mobile onClick={() => setIsMenuOpen(false)} />
					</div>
				</motion.div>
			)}
		</header>
	);
};

interface NavLinksProps {
	mobile?: boolean;
	onClick?: () => void;
}

const NavLinks = ({ mobile, onClick }: NavLinksProps) => {
	const linkClasses = mobile
		? "block py-2 text-gray-300 hover:text-white transition-colors"
		: "text-gray-300 hover:text-white transition-colors";

	const links = [
		{ text: "How It Works", href: "#how-it-works" },
		{ text: "Use Cases", href: "#use-cases" },
		{ text: "Features", href: "#features" },
		{ text: "Quick Start", href: "#quick-start" },
		{
			text: "Desktop App",
			href: "https://github.com/RussellCanfield/wingman-ai/releases",
			external: true,
		},
		{
			text: "Docs",
			href: "https://docs.getwingmanai.com",
			external: true,
		},
		{
			text: "GitHub",
			href: "https://github.com/RussellCanfield/wingman-ai",
			external: true,
		},
	];

	return (
		<>
			{links.map((link) => (
				<a
					key={link.href}
					href={link.href}
					target={link.external ? "_blank" : undefined}
					rel={link.external ? "noopener noreferrer" : undefined}
					className={linkClasses}
					onClick={onClick}
				>
					{link.text}
				</a>
			))}
			{/* biome-ignore lint/a11y/useValidAnchor: This is a valid anchor for navigation to #quick-start section */}
			<a
				href="#quick-start"
				className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-lg font-medium hover:opacity-90 transition-all"
				onClick={onClick}
			>
				Get Started
			</a>
		</>
	);
};

export default Header;
