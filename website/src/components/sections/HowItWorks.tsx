import { motion } from "framer-motion";
import {
	FiDownload,
	FiMonitor,
	FiServer,
	FiShare2,
	FiSmartphone,
	FiTerminal,
} from "react-icons/fi";

const HowItWorks = () => {
	const installScriptCommand =
		"curl -fsSL https://getwingmanai.com/install.sh | bash";
	const npmInstallCommand = "npm install -g @wingman-ai/gateway && wingman init";

	const steps = [
		{
			number: "01",
			title: "Install Once",
			description:
				"Install via the quick script or npm. Initialize your workspace with interactive setup.",
			icon: FiDownload,
			commands: [installScriptCommand, npmInstallCommand],
		},
		{
			number: "02",
			title: "Gateway Starts",
			description:
				"Launch your local AI agent runtime. The gateway handles all agent execution and session persistence.",
			icon: FiServer,
			commands: ["wingman gateway start"],
		},
		{
			number: "03",
			title: "Connect Anywhere",
			description:
				"Access your agents from CLI, WebUI, or VSCode. All clients share the same persistent sessions.",
			icon: FiMonitor,
			command: "",
		},
		{
			number: "04",
			title: "Agents Collaborate",
			description:
				"Spawn multiple agents that work together on complex tasks with coordinated workflows.",
			icon: FiShare2,
			command: "",
		},
	];

	return (
		<section id="how-it-works" className="relative z-10 px-4 py-24">
			<div className="container mx-auto">
				<div className="mb-16 text-center">
					<motion.h2
						className="mb-4 text-4xl font-bold md:text-5xl"
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6 }}
					>
						How <span className="gradient-text">Wingman Gateway</span> Works
					</motion.h2>
					<motion.p
						className="mx-auto max-w-2xl text-lg text-gray-400"
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6, delay: 0.1 }}
					>
						Your AI coding infrastructure, not just another extension. Sessions
						persist across all your devices.
					</motion.p>
				</div>

				<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
					{steps.map((step, index) => (
						<motion.div
							key={step.number}
							className="panel-card group relative p-6 transition-all hover:shadow-glow"
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.6, delay: index * 0.1 }}
						>
							<div className="mb-4 flex items-start justify-between">
								<div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/10">
									<step.icon className="h-6 w-6 text-sky-400" />
								</div>
								<span className="text-5xl font-bold text-white/5">
									{step.number}
								</span>
							</div>

							<h3 className="mb-2 text-xl font-semibold text-white">
								{step.title}
							</h3>
							<p className="mb-4 text-sm text-gray-400">{step.description}</p>

							{step.commands && step.commands.length > 0 && (
								<div className="space-y-2">
									{step.commands.map((command) => (
										<div
											key={command}
											className="rounded-lg bg-slate-950/50 p-3"
										>
											<code className="font-mono text-xs text-sky-400">
												$ {command}
											</code>
										</div>
									))}
								</div>
							)}

							{step.number === "03" && (
								<div className="mt-4 space-y-2">
									<div className="flex items-center gap-2 text-sm text-gray-400">
										<FiTerminal className="h-4 w-4 text-blue-400" />
										<span>CLI: wingman chat</span>
									</div>
									<div className="flex items-center gap-2 text-sm text-gray-400">
										<FiMonitor className="h-4 w-4 text-blue-400" />
										<span>WebUI: localhost:18789</span>
									</div>
								</div>
							)}
						</motion.div>
					))}
				</div>

				{/* Architecture visualization */}
				<motion.div
					className="mt-16 rounded-2xl border border-white/10 bg-slate-900/60 p-8 backdrop-blur-xl"
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6, delay: 0.4 }}
				>
					<div className="flex flex-col items-center gap-8 md:flex-row md:justify-around">
						{/* CLI Client */}
						<div className="flex flex-col items-center gap-2">
							<div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
								<FiTerminal className="h-8 w-8 text-blue-400" />
							</div>
							<span className="text-sm font-medium text-gray-300">CLI</span>
						</div>

						{/* Connection lines */}
						<div className="hidden rotate-0 border-t-2 border-dashed border-sky-500/30 md:block md:w-20" />

						{/* Gateway (center) */}
						<div className="relative">
							<div className="absolute -inset-4 animate-pulseSoft rounded-full bg-sky-500/20 blur-xl" />
							<div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 shadow-glow">
								<FiServer className="h-12 w-12 text-white" />
							</div>
							<div className="mt-2 text-center text-sm font-semibold text-sky-400">
								Gateway
							</div>
						</div>

						{/* Connection lines */}
						<div className="hidden rotate-0 border-t-2 border-dashed border-sky-500/30 md:block md:w-20" />

						{/* WebUI Client */}
						<div className="flex flex-col items-center gap-2">
							<div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
								<FiMonitor className="h-8 w-8 text-blue-400" />
							</div>
							<span className="text-sm font-medium text-gray-300">WebUI</span>
						</div>

						{/* Connection lines */}
						<div className="hidden rotate-0 border-t-2 border-dashed border-sky-500/30 md:block md:w-20" />

						{/* VSCode Client */}
						<div className="flex flex-col items-center gap-2">
							<div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
								<FiSmartphone className="h-8 w-8 text-blue-400" />
							</div>
							<span className="text-sm font-medium text-gray-300">VSCode</span>
						</div>
					</div>

					<div className="mt-8 text-center">
						<p className="text-sm text-gray-400">
							<span className="font-semibold text-sky-400">
								WebSocket-based
							</span>{" "}
							real-time communication • Sessions persist across restarts •
							Multiple agents can collaborate
						</p>
					</div>
				</motion.div>
			</div>
		</section>
	);
};

export default HowItWorks;
