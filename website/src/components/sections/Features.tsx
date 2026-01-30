import { motion } from "framer-motion";
import {
	FiClock,
	FiDatabase,
	FiLink,
	FiMonitor,
	FiShare2,
	FiShield,
} from "react-icons/fi";

const Features = () => {
	const features = [
		{
			icon: FiDatabase,
			title: "Persistent Sessions",
			description:
				"Sessions survive restarts. Pick up where you left off, from any client.",
			color: "sky",
		},
		{
			icon: FiMonitor,
			title: "Multi-Client Architecture",
			description:
				"CLI for automation, WebUI for mobile, VSCode for development. One gateway powers all.",
			color: "blue",
		},
		{
			icon: FiShare2,
			title: "Agent Collaboration",
			description:
				"Multiple agents work together on complex tasks with coordinated workflows.",
			color: "sky",
		},
		{
			icon: FiClock,
			title: "Routine Automation",
			description:
				"Schedule agent runs via CRON. Review results in persistent threads.",
			color: "blue",
		},
		{
			icon: FiLink,
			title: "Webhook Integration",
			description:
				"Trigger agents from external systems: GitHub, email, CI/CD pipelines.",
			color: "sky",
		},
		{
			icon: FiShield,
			title: "Local & Private Options",
			description:
				"Run 100% locally with Ollama or LMStudio. Your code never leaves your machine.",
			color: "blue",
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
						and multi-agent orchestration.
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
							<FiDatabase className="h-8 w-8 text-sky-400" />
						</div>
						<div className="flex-1">
							<h3 className="mb-2 text-2xl font-semibold text-white">
								Everything persists. Nothing gets lost.
							</h3>
							<p className="text-gray-400">
								Your conversations, context, and agent state are stored in a
								durable SQLite database. Close your laptop, come back tomorrow,
								and pick up exactly where you left off.
							</p>
						</div>
					</div>
				</motion.div>
			</div>
		</section>
	);
};

export default Features;
