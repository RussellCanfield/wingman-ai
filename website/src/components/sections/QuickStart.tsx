import { motion } from "framer-motion";
import { useState } from "react";
import { FiCheck, FiCode, FiCopy, FiMonitor, FiTerminal } from "react-icons/fi";

const QuickStart = () => {
	const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

	const copyToClipboard = (text: string, index: number) => {
		navigator.clipboard.writeText(text);
		setCopiedIndex(index);
		setTimeout(() => setCopiedIndex(null), 2000);
	};

	const steps = [
		{
			number: "1",
			title: "Install",
			command: "npm install -g @wingman-ai/agent",
		},
		{
			number: "2",
			title: "Initialize",
			command: "wingman init",
		},
		{
			number: "3",
			title: "Start Gateway",
			command: "wingman gateway start",
		},
	];

	const clients = [
		{
			icon: FiTerminal,
			name: "CLI",
			command: "wingman chat",
			description: "Chat with agents from your terminal",
		},
		{
			icon: FiMonitor,
			name: "WebUI",
			command: "http://localhost:18789",
			description: "Beautiful web interface for mobile",
		},
		{
			icon: FiCode,
			name: "VSCode",
			link: "https://github.com/RussellCanfield/wingman-ai-vscode-extension",
			description: "Extension for your editor",
		},
	];

	return (
		<section id="quick-start" className="relative z-10 px-4 py-24">
			<div className="container mx-auto">
				<div className="mb-16 text-center">
					<motion.h2
						className="mb-4 text-4xl font-bold md:text-5xl"
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6 }}
					>
						Get Started in <span className="gradient-text">60 Seconds</span>
					</motion.h2>
					<motion.p
						className="mx-auto max-w-2xl text-lg text-gray-400"
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6, delay: 0.1 }}
					>
						Three simple commands to launch your AI coding infrastructure.
					</motion.p>
				</div>

				{/* Installation steps */}
				<div className="mx-auto mb-16 max-w-3xl">
					<motion.div
						className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 backdrop-blur-xl"
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6, delay: 0.2 }}
					>
						{/* Terminal header */}
						<div className="flex items-center border-b border-white/10 bg-slate-900/90 px-4 py-3">
							<div className="flex space-x-2">
								<div className="h-3 w-3 rounded-full bg-red-500/90" />
								<div className="h-3 w-3 rounded-full bg-yellow-500/90" />
								<div className="h-3 w-3 rounded-full bg-green-500/90" />
							</div>
							<div className="ml-4 text-sm text-gray-400">Terminal</div>
						</div>

						{/* Commands */}
						<div className="p-6">
							{steps.map((step, index) => (
								<div key={step.number} className="mb-6 last:mb-0">
									<div className="mb-2 flex items-center gap-2">
										<span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/20 text-xs font-semibold text-sky-400">
											{step.number}
										</span>
										<span className="text-sm font-medium text-gray-400">
											{step.title}
										</span>
									</div>
									<div className="group relative flex items-center gap-2 rounded-lg bg-slate-900/50 p-4">
										<span className="font-mono text-sm text-sky-400">$</span>
										<code className="flex-1 font-mono text-sm text-gray-300">
											{step.command}
										</code>
										<button
											onClick={() => copyToClipboard(step.command, index)}
											type="button"
											className="rounded-lg p-2 text-gray-400 opacity-0 transition-all hover:bg-slate-800 hover:text-sky-400 group-hover:opacity-100"
										>
											{copiedIndex === index ? (
												<FiCheck className="h-4 w-4 text-green-400" />
											) : (
												<FiCopy className="h-4 w-4" />
											)}
										</button>
									</div>
								</div>
							))}
						</div>
					</motion.div>
				</div>

				{/* Client options */}
				<div className="mx-auto max-w-5xl">
					<motion.div
						className="mb-8 text-center"
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6, delay: 0.4 }}
					>
						<h3 className="mb-2 text-2xl font-semibold text-white">
							Then Connect From Anywhere
						</h3>
						<p className="text-gray-400">
							Choose your preferred interface or use all three
						</p>
					</motion.div>

					<div className="grid gap-6 md:grid-cols-3">
						{clients.map((client, index) => (
							<motion.div
								key={client.name}
								className="panel-card group relative p-6 transition-all hover:shadow-glow"
								initial={{ opacity: 0, y: 20 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true }}
								transition={{ duration: 0.6, delay: 0.5 + index * 0.1 }}
							>
								<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10">
									<client.icon className="h-6 w-6 text-sky-400" />
								</div>

								<h4 className="mb-2 text-lg font-semibold text-white">
									{client.name}
								</h4>
								<p className="mb-3 text-sm text-gray-400">
									{client.description}
								</p>

								{client.command && (
									<code className="block rounded-lg bg-slate-950/50 p-2 font-mono text-xs text-blue-400">
										{client.command}
									</code>
								)}

								{client.link && (
									<a
										href={client.link}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-1 text-sm font-medium text-sky-400 hover:text-sky-300"
									>
										View Extension →
									</a>
								)}
							</motion.div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
};

export default QuickStart;
