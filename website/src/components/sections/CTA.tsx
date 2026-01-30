import { motion } from "framer-motion";
import { useState } from "react";
import { FiCheck, FiCode, FiDownload, FiGithub, FiStar } from "react-icons/fi";

const CTA = () => {
	const [copied, setCopied] = useState(false);

	const copyToClipboard = () => {
		navigator.clipboard.writeText("npm install -g @wingman-ai/agent");
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<section className="relative z-10 px-4 py-24">
			<div className="container mx-auto">
				<motion.div
					className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-sky-500/10 to-blue-600/10 p-12 backdrop-blur-xl md:p-16"
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6 }}
				>
					{/* Background glow effect */}
					<div className="absolute -left-20 -top-20 h-60 w-60 rounded-full bg-sky-500/20 blur-3xl" />
					<div className="absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-blue-500/20 blur-3xl" />

					<div className="relative text-center">
						<motion.h2
							className="mb-4 text-4xl font-bold md:text-5xl"
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.6, delay: 0.1 }}
						>
							Start Your{" "}
							<span className="gradient-text">
								Distributed AI Infrastructure
							</span>
						</motion.h2>

						<motion.p
							className="mx-auto mb-8 max-w-2xl text-lg text-gray-300"
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.6, delay: 0.2 }}
						>
							Get started in 60 seconds. 100% open source. No vendor lock-in.
						</motion.p>

						{/* Primary CTA */}
						<motion.div
							className="mb-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.6, delay: 0.3 }}
						>
							<button
								onClick={copyToClipboard}
								type="button"
								className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-8 py-4 text-lg font-semibold text-white shadow-glow transition-all hover:shadow-[0_0_0_1px_rgba(56,189,248,0.15),0_18px_42px_rgba(59,130,246,0.4)]"
							>
								{copied ? (
									<>
										<FiCheck className="h-5 w-5" />
										Copied!
									</>
								) : (
									<>
										<FiDownload className="h-5 w-5" />
										npm install -g @wingman-ai/agent
									</>
								)}
							</button>
						</motion.div>

						{/* Social proof */}
						<motion.div
							className="mb-8 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400"
							initial={{ opacity: 0 }}
							whileInView={{ opacity: 1 }}
							viewport={{ once: true }}
							transition={{ duration: 0.6, delay: 0.4 }}
						>
							<div className="flex items-center gap-2">
								<FiStar className="h-4 w-4 text-yellow-500" />
								<span>Open Source</span>
							</div>
							<div className="flex items-center gap-2">
								<FiGithub className="h-4 w-4" />
								<a
									href="https://github.com/RussellCanfield/wingman-ai"
									target="_blank"
									rel="noopener noreferrer"
									className="hover:text-sky-400"
								>
									Star on GitHub
								</a>
							</div>
							<div className="flex items-center gap-2">
								<FiCode className="h-4 w-4" />
								<span>Multi-Platform</span>
							</div>
						</motion.div>

						{/* VSCode extension mention */}
						<motion.div
							className="text-sm text-gray-500"
							initial={{ opacity: 0 }}
							whileInView={{ opacity: 1 }}
							viewport={{ once: true }}
							transition={{ duration: 0.6, delay: 0.5 }}
						>
							Also available as a{" "}
							<a
								href="https://github.com/RussellCanfield/wingman-ai-vscode-extension"
								target="_blank"
								rel="noopener noreferrer"
								className="text-sky-400 hover:text-sky-300"
							>
								VS Code extension
							</a>
						</motion.div>
					</div>
				</motion.div>
			</div>
		</section>
	);
};

export default CTA;
