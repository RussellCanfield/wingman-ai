import { motion } from "framer-motion";
import {
	FiClock,
	FiDatabase,
	FiGlobe,
	FiLayers,
	FiLink,
	FiMessageCircle,
	FiPackage,
	FiRadio,
	FiShield,
	FiVolume2,
} from "react-icons/fi";

const Features = () => {
	const features = [
		{
			icon: FiDatabase,
			title: "Durable Sessions",
			description:
				"Sessions persist in the gateway so every client can pick up where it left off.",
			color: "sky",
		},
		{
			icon: FiLayers,
			title: "Multi-Agent Orchestration",
			description:
				"Delegate work to specialist agents with shared context and coordinated outputs.",
			color: "blue",
		},
		{
			icon: FiPackage,
			title: "Skills + Extensibility",
			description:
				"Compose reusable skills, hooks, and middleware to match your team's workflow.",
			color: "sky",
		},
		{
			icon: FiLink,
			title: "MCP Integration",
			description:
				"Connect to external tools and APIs through Model Context Protocol servers.",
			color: "blue",
		},
		{
			icon: FiVolume2,
			title: "Voice Output (TTS)",
			description:
				"Gateway-level voice providers power spoken responses in your UI and clients.",
			color: "sky",
		},
		{
			icon: FiMessageCircle,
			title: "Discord + Channel Adapters",
			description:
				"Route channels to agents and stream responses back to Discord and other outputs.",
			color: "blue",
		},
		{
			icon: FiClock,
			title: "Routines + Webhooks",
			description:
				"Schedule workflows or trigger them from external systems with durable sessions.",
			color: "sky",
		},
		{
			icon: FiRadio,
			title: "Broadcast Rooms",
			description:
				"Opt into swarm-style responses with explicit room broadcasts.",
			color: "blue",
		},
		{
			icon: FiShield,
			title: "Gateway Auth + Pairing",
			description:
				"Token or password auth with Control UI pairing for safer remote access.",
			color: "sky",
		},
		{
			icon: FiGlobe,
			title: "Remote Discovery",
			description:
				"Advertise your gateway on LAN or Tailscale and connect from anywhere.",
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
						Built on persistent state, streaming protocols, and channel adapters
						that span voice, webhooks, and team chat.
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
							<FiVolume2 className="h-8 w-8 text-sky-400" />
						</div>
						<div className="flex-1">
							<h3 className="mb-2 text-2xl font-semibold text-white">
								Advanced channels, voice, and automation.
							</h3>
							<p className="text-gray-400">
								Wire voice output, Discord routing, and webhook-driven workflows
								into durable sessions. Configure it once and reuse it across
								clients and teams.
							</p>
						</div>
					</div>
				</motion.div>
			</div>
		</section>
	);
};

export default Features;
