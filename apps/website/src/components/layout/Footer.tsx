import {
	FiCode,
	FiExternalLink,
	FiGithub,
	FiHeart,
	FiPackage,
	FiServer,
} from "react-icons/fi";
import logoImage from "../../assets/wingman_icon.webp";

const Footer = () => {
	return (
		<footer className="bg-gray-900 py-12 border-t border-gray-800">
			<div className="container mx-auto px-4">
				<div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
					{/* Brand */}
					<div className="md:col-span-1">
						<div className="flex items-center mb-4">
							<img src={logoImage} alt="Wingman AI" className="h-8 mr-3" />
							<h2 className="text-xl font-bold gradient-text">Wingman AI</h2>
						</div>
						<p className="text-gray-400 text-sm mb-4">
							Distributed AI agent infrastructure for developers. Open source
							and privacy-focused.
						</p>
						<div className="flex items-center gap-4">
							<a
								href="https://github.com/RussellCanfield/wingman-ai"
								className="text-gray-400 hover:text-white transition-colors"
								target="_blank"
								rel="noopener noreferrer"
								aria-label="GitHub"
							>
								<FiGithub size={20} />
							</a>
						</div>
					</div>

					{/* Products */}
					<div>
						<h3 className="text-white font-semibold mb-4">Products</h3>
						<ul className="space-y-2">
							<li>
								<a
									href="/"
									className="text-gray-400 hover:text-white transition-colors flex items-center text-sm"
								>
									<FiServer className="mr-1" size={12} /> Wingman Gateway
								</a>
							</li>
							<li>
								<a
									href="https://github.com/RussellCanfield/wingman-ai-vscode-extension"
									className="text-gray-400 hover:text-white transition-colors flex items-center text-sm"
									target="_blank"
									rel="noopener noreferrer"
								>
									<FiCode className="mr-1" size={12} /> VS Code Extension{" "}
									<FiExternalLink className="ml-1" size={12} />
								</a>
							</li>
							<li>
								<a
									href="https://www.npmjs.com/package/@wingman-ai/gateway"
									className="text-gray-400 hover:text-white transition-colors flex items-center text-sm"
									target="_blank"
									rel="noopener noreferrer"
								>
									<FiPackage className="mr-1" size={12} /> CLI Tool{" "}
									<FiExternalLink className="ml-1" size={12} />
								</a>
							</li>
						</ul>
					</div>

					{/* Resources */}
					<div>
						<h3 className="text-white font-semibold mb-4">Resources</h3>
						<ul className="space-y-2">
							<li>
								<a
									href="https://docs.getwingmanai.com"
									className="text-gray-400 hover:text-white transition-colors flex items-center text-sm"
									target="_blank"
									rel="noopener noreferrer"
								>
									Documentation <FiExternalLink className="ml-1" size={12} />
								</a>
							</li>
							<li>
								<a
									href="https://github.com/RussellCanfield/wingman-ai/releases"
									className="text-gray-400 hover:text-white transition-colors flex items-center text-sm"
									target="_blank"
									rel="noopener noreferrer"
								>
									Release Notes <FiExternalLink className="ml-1" size={12} />
								</a>
							</li>
							<li>
								<a
									href="https://modelcontextprotocol.io/introduction"
									className="text-gray-400 hover:text-white transition-colors flex items-center text-sm"
									target="_blank"
									rel="noopener noreferrer"
								>
									MCP Documentation{" "}
									<FiExternalLink className="ml-1" size={12} />
								</a>
							</li>
						</ul>
					</div>

					{/* Support */}
					<div>
						<h3 className="text-white font-semibold mb-4">Support</h3>
						<ul className="space-y-2">
							<li>
								<a
									href="https://github.com/RussellCanfield/wingman-ai/issues"
									className="text-gray-400 hover:text-white transition-colors flex items-center text-sm"
									target="_blank"
									rel="noopener noreferrer"
								>
									Report Issues <FiExternalLink className="ml-1" size={12} />
								</a>
							</li>
							<li>
								<a
									href="https://github.com/RussellCanfield/wingman-ai/discussions"
									className="text-gray-400 hover:text-white transition-colors flex items-center text-sm"
									target="_blank"
									rel="noopener noreferrer"
								>
									Discussions <FiExternalLink className="ml-1" size={12} />
								</a>
							</li>
							<li>
								<a
									href="https://github.com/RussellCanfield/wingman-ai/blob/main/CONTRIBUTING.md"
									className="text-gray-400 hover:text-white transition-colors flex items-center text-sm"
									target="_blank"
									rel="noopener noreferrer"
								>
									Contributing <FiExternalLink className="ml-1" size={12} />
								</a>
							</li>
						</ul>
					</div>
				</div>

				{/* Quick Install */}
				<div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700 mb-8">
					<div className="text-center">
						<h3 className="text-lg font-semibold mb-4">Quick Start</h3>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg font-mono text-sm border border-gray-700">
								npm install -g @wingman-ai/gateway
							</div>
							<a
								href="#quick-start"
								className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-lg font-medium hover:opacity-90 transition-all text-sm"
							>
								View Full Guide
							</a>
						</div>
					</div>
				</div>

				<div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center text-gray-500 text-sm">
					<p className="mb-2 md:mb-0">
						&copy; 2025 Wingman AI. All rights reserved. Open source under MIT
						License.
					</p>
					<p className="flex items-center gap-2">
						Made with{" "}
						<FiHeart className="text-red-500 hover:text-red-400 transition-colors" />{" "}
						by the community
					</p>
				</div>
			</div>
		</footer>
	);
};

export default Footer;
