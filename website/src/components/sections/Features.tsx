import { motion } from "framer-motion";
import {
	FiBook,
	FiClock,
	FiCpu,
	FiDatabase,
	FiGlobe,
	FiLayers,
	FiLink,
	FiPackage,
	FiZap,
} from "react-icons/fi";

const Features = () => {
	const features = [
		{
			icon: FiDatabase,
			title: "Long-Term Memory",
			description:
				"Agents remember context across sessions with persistent memory. Build knowledge over time.",
			color: "sky",
		},
		{
			icon: FiCpu,
			title: "Automatic Parallelization",
			description:
				"Agents automatically spawn subagents for parallel task execution. Complex workflows made simple.",
			color: "blue",
		},
		{
			icon: FiPackage,
			title: "Agent Skills System",
			description:
				"Extend agent capabilities with custom skills. Reusable, composable tools for any workflow.",
			color: "sky",
		},
		{
			icon: FiZap,
			title: "Quick Agent Setup",
			description:
				"Stand up new agents in seconds with declarative JSON config. No boilerplate required.",
			color: "blue",
		},
		{
			icon: FiLink,
			title: "MCP Integration",
			description:
				"Full Model Context Protocol support. Connect to external tools, APIs, and data sources seamlessly.",
			color: "sky",
		},
		{
			icon: FiGlobe,
			title: "Tailscale Support",
			description:
				"Secure remote access to your gateway. Run agents from anywhere with encrypted connections.",
			color: "blue",
		},
		{
			icon: FiLayers,
			title: "Multi-Agent Orchestration",
			description:
				"Coordinate multiple specialized agents working together on complex problems with shared context.",
			color: "sky",
		},
		{
			icon: FiClock,
			title: "Scheduled Routines",
			description:
				"Automate agent workflows with CRON schedules. Set it and forget it.",
			color: "blue",
		},
		{
			icon: FiBook,
			title: "Persistent Sessions",
			description:
				"All conversations and state stored in durable SQLite. Pick up where you left off, always.",
			color: "sky",
		},
	];

	return (
		<section id="features" className="relative z-10 px-4 py-24">
			<div className="container mx-auto">
				<div className="mb-16 text-center">
					<motion.h2
						className="mb-4 text-4xl font-bold md:text-5xl"
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6 }}
					>
						Powerful <span className="gradient-text">Distributed</span>{" "}
						Capabilities
					</motion.h2>
					<motion.p
						className="mx-auto max-w-2xl text-lg text-gray-400"
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6, delay: 0.1 }}
					>
						Built on a foundation of persistent state, WebSocket communication,
						and intelligent agent orchestration.
					</motion.p>
				</div>

				<div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
					{features.map((feature, index) => (
						<motion.div
							key={feature.title}
							className="group panel-card relative p-8 transition-all hover:shadow-glow"
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.6, delay: index * 0.1 }}
						>
							<div className="mb-4">
								<div
									className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-${feature.color}-500/10 transition-all group-hover:bg-${feature.color}-500/20`}
								>
									<feature.icon
										className={`h-7 w-7 text-${feature.color}-400`}
									/>
								</div>
							</div>

							<h3 className="mb-3 text-xl font-semibold text-white">
								{feature.title}
							</h3>
							<p className="text-gray-400">{feature.description}</p>
						</motion.div>
					))}
				</div>

				{/* Bottom highlight */}
				<motion.div
					className="mt-16 rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-500/5 to-blue-500/5 p-8 backdrop-blur-xl"
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6, delay: 0.6 }}
				>
					<div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
						<div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-sky-500/20">
							<FiPackage className="h-8 w-8 text-sky-400" />
						</div>
						<div className="flex-1">
							<h3 className="mb-2 text-2xl font-semibold text-white">
								Extensible by design. Built for developers.
							</h3>
							<p className="text-gray-400">
								Create custom agent skills, integrate with external APIs via MCP,
								and orchestrate complex workflows. Everything is configurable,
								composable, and built on open standards.
							</p>
						</div>
					</div>
				</motion.div>
			</div>
		</section>
	);
};

export default Features;
