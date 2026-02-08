import { motion } from "framer-motion";
import { useState } from "react";
import {
	FiArrowRight,
	FiCpu,
	FiDatabase,
	FiDownload,
	FiMonitor,
	FiShare2,
} from "react-icons/fi";

const Hero = () => {
	const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
	const installScriptCommand =
		"curl -fsSL https://getwingmanai.com/install.sh | bash";
	const npmCommand = "npm install -g @wingman-ai/gateway";

	const copyToClipboard = (command: string) => {
		navigator.clipboard.writeText(command);
		setCopiedCommand(command);
		setTimeout(() => setCopiedCommand(null), 2000);
	};

	return (
		<section className="relative z-10 px-4 pb-16 pt-28 md:pb-24 md:pt-32">
			<div className="container mx-auto">
				<div className="flex flex-col items-center lg:flex-row">
					<div className="mb-10 w-full text-center lg:mb-0 lg:w-1/2 lg:text-left">
						<motion.h1
							className="mb-6 text-4xl font-bold md:text-5xl lg:text-6xl"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.6 }}
						>
							<span className="gradient-text">Distributed AI Agents.</span>
							<br />
							Persistent Sessions.
							<br />
							Multi-Client Control.
						</motion.h1>

						<motion.p
							className="mx-auto mb-8 max-w-xl text-xl text-gray-300 lg:mx-0"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.6, delay: 0.2 }}
						>
							Wingman Gateway powers your AI coding workflow with a persistent
							runtime that you can access anywhere. Endless possibilities.
						</motion.p>

						{/* Product badges */}
						<motion.div
							className="mb-8 flex flex-wrap justify-center gap-4 lg:justify-start"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.6, delay: 0.3 }}
						>
							<div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/50 px-4 py-2 backdrop-blur-sm">
								<FiDatabase className="h-3 w-3 text-sky-400" />
								<span className="text-sm text-gray-300">
									Persistent Sessions
								</span>
							</div>
							<div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/50 px-4 py-2 backdrop-blur-sm">
								<FiShare2 className="h-3 w-3 text-sky-400" />
								<span className="text-sm text-gray-300">
									Multi-Agent Collaboration
								</span>
							</div>
							<div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/50 px-4 py-2 backdrop-blur-sm">
								<FiCpu className="h-3 w-3 text-sky-400" />
								<span className="text-sm text-gray-300">
									Distributed Architecture
								</span>
							</div>
							<div className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/50 px-4 py-2 backdrop-blur-sm">
								<FiMonitor className="h-3 w-3 text-sky-400" />
								<span className="text-sm text-gray-300">
									Desktop Companion App
								</span>
							</div>
						</motion.div>

						<motion.div
							className="flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap lg:justify-start"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.6, delay: 0.4 }}
						>
							<button
								onClick={() => copyToClipboard(installScriptCommand)}
								type="button"
								className="btn-primary flex items-center justify-center gap-2 text-xs sm:justify-start sm:text-sm"
							>
								{copiedCommand === installScriptCommand ? (
									<>✓ Copied!</>
								) : (
									<>
										<FiDownload /> {installScriptCommand}
									</>
								)}
							</button>
							<button
								onClick={() => copyToClipboard(npmCommand)}
								type="button"
								className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-slate-900/70 px-6 py-3 text-xs font-semibold text-white transition-all hover:border-sky-500/30 hover:bg-slate-900/90 sm:justify-start sm:text-sm"
							>
								{copiedCommand === npmCommand ? (
									<>✓ Copied!</>
								) : (
									<>
										<FiDownload /> {npmCommand}
									</>
								)}
							</button>
							<a
								href="#how-it-works"
								className="flex items-center justify-center gap-2 rounded-full border border-white/10 bg-slate-900/70 px-6 py-3 text-sm font-medium text-white transition-all hover:border-sky-500/30 hover:bg-slate-900/90 sm:justify-start"
							>
								See How It Works <FiArrowRight />
							</a>
							<a
								href="https://github.com/RussellCanfield/wingman-ai/releases"
								target="_blank"
								rel="noopener noreferrer"
								className="flex items-center justify-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-6 py-3 text-sm font-medium text-sky-200 transition-all hover:border-sky-400/50 hover:bg-sky-500/20 sm:justify-start"
							>
								<FiMonitor />
								Desktop Companion (macOS)
							</a>
						</motion.div>

						{/* Quick stats */}
						<motion.div
							className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-gray-400 lg:justify-start"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: 0.6, delay: 0.6 }}
						>
							<div className="flex items-center gap-2">
								<div className="h-2 w-2 animate-pulseSoft rounded-full bg-sky-400" />
								<span>100% Open Source</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="h-2 w-2 animate-pulseSoft rounded-full bg-blue-500" />
								<span>WebSocket-Based</span>
							</div>
							<div className="flex items-center gap-2">
								<div className="h-2 w-2 animate-pulseSoft rounded-full bg-sky-500" />
								<span>Local & Private</span>
							</div>
						</motion.div>
					</div>

					<div className="w-full lg:w-1/2">
						<motion.div
							className="relative z-10"
							initial={{ opacity: 0, scale: 0.8 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ duration: 0.8, delay: 0.3 }}
						>
							{/* Architecture Diagram */}
							<div className="relative">
								{/* Ambient light effects */}
								<div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-sky-500/10 blur-2xl" />
								<div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-blue-500/10 blur-2xl" />

								{/* Main frame */}
								<div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 shadow-glow backdrop-blur-sm transition-all">
									{/* Subtle gradient overlay */}
									<div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-sky-600/[0.07] to-blue-500/[0.05]" />

									{/* Window controls bar */}
									<div className="flex items-center border-b border-white/10 bg-slate-800/90 px-4 py-2 backdrop-blur-sm">
										<div className="flex space-x-2">
											<div className="h-3 w-3 rounded-full bg-red-500/90 shadow-lg shadow-red-500/20" />
											<div className="h-3 w-3 rounded-full bg-yellow-500/90 shadow-lg shadow-yellow-500/20" />
											<div className="h-3 w-3 rounded-full bg-green-500/90 shadow-lg shadow-green-500/20" />
										</div>
										<div className="mx-auto text-sm font-medium text-gray-400">
											Wingman Gateway
										</div>
									</div>

									{/* Content area */}
									<div className="relative p-8">
										<div className="space-y-4 font-mono text-sm">
											<div className="text-sky-400">
												$ wingman gateway start
											</div>
											<div className="text-gray-400">
												✓ Gateway started at localhost:18789
											</div>
											<div className="text-gray-400">
												✓ WebSocket server ready
											</div>
											<div className="text-gray-400">
												✓ Persistent sessions enabled
											</div>
											<div className="mt-6 text-gray-500">
												# Connect from anywhere:
											</div>
											<div className="text-blue-400">$ wingman chat</div>
											<div className="text-blue-400">
												$ open http://localhost:18789
											</div>
											<div className="text-gray-500"># VSCode extension</div>
											<div className="mt-6 flex items-center gap-2">
												<div className="h-2 w-2 animate-pulseSoft rounded-full bg-sky-400" />
												<span className="text-sm text-gray-400">
													Agents ready for collaboration
												</span>
											</div>
										</div>
									</div>
								</div>

								{/* Reflection effect */}
								<div className="absolute -inset-0.5 -z-10 bg-gradient-to-b from-sky-500/10 to-blue-500/10 opacity-50 blur-2xl" />
							</div>
						</motion.div>
					</div>
				</div>
			</div>
		</section>
	);
};

export default Hero;
