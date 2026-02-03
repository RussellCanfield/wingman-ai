import { motion } from "framer-motion";
import {
	FiCode,
	FiCopy,
	FiFolder,
	FiKey,
	FiLayers,
	FiSearch,
	FiTrendingUp,
	FiUser,
} from "react-icons/fi";

const BundledAgents = () => {
	const agents = [
		{
			name: "main",
			title: "Main",
			description:
				"Primary agent for general coding, research, and problem solving.",
			icon: FiLayers,
		},
		{
			name: "coding",
			title: "Coding",
			description:
				"Lead coding orchestrator that plans, delegates, and reviews work.",
			icon: FiCode,
		},
		{
			name: "researcher",
			title: "Researcher",
			description:
				"Web research and documentation triage with source-first summaries.",
			icon: FiSearch,
		},
		{
			name: "stock-trader",
			title: "Stock Trader",
			description:
				"Options research agent with data-health checks and risk guardrails. (Research use only.)",
			icon: FiTrendingUp,
		},
		{
			name: "wingman",
			title: "Wingman",
			description: "Workspace-specific assistant tuned to your repo.",
			icon: FiUser,
		},
	];

	return (
		<section id="bundled-agents" className="relative z-10 px-4 py-24">
			<div className="container mx-auto">
				<div className="mb-16 text-center">
					<motion.h2
						className="mb-4 text-4xl font-bold md:text-5xl"
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6 }}
					>
						Bundled <span className="gradient-text">Agents</span> Ready Day One
					</motion.h2>
					<motion.p
						className="mx-auto max-w-2xl text-lg text-gray-400"
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6, delay: 0.1 }}
					>
						Wingman ships with a curated set of agents stored under{" "}
						<code className="px-2 text-sky-300">
							apps/wingman/.wingman/agents
						</code>
						. When you run <span className="text-sky-300">wingman init</span>,
						they are copied into your workspace at{" "}
						<code className="px-2 text-sky-300">.wingman/agents</code> so you
						can customize them immediately.
					</motion.p>
				</div>

				<div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
					<div className="grid gap-6 md:grid-cols-2">
						{agents.map((agent, index) => (
							<motion.div
								key={agent.name}
								className="panel-card group relative p-6 transition-all hover:shadow-glow"
								initial={{ opacity: 0, y: 20 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true }}
								transition={{ duration: 0.6, delay: index * 0.1 }}
							>
								<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10">
									<agent.icon className="h-6 w-6 text-sky-400" />
								</div>
								<h3 className="mb-2 text-xl font-semibold text-white">
									{agent.title}
								</h3>
								<p className="text-sm text-gray-400">{agent.description}</p>
							</motion.div>
						))}
					</div>

					<div className="space-y-6">
						<motion.div
							className="panel-card p-6"
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.6, delay: 0.2 }}
						>
							<div className="mb-3 flex items-center gap-2 text-sm font-semibold text-sky-300">
								<FiFolder className="h-4 w-4" />
								<span>Where they live</span>
							</div>
							<p className="mb-4 text-sm text-gray-400">
								Bundled agents ship with the CLI package and are copied into
								each workspace during initialization. Edit them in-place to
								change system prompts, tools, or subagents.
							</p>
							<div className="rounded-lg bg-slate-950/60 p-4 font-mono text-xs text-sky-300">
								<div>apps/wingman/.wingman/agents</div>
								<div>.wingman/agents</div>
							</div>
						</motion.div>

						<motion.div
							className="panel-card p-6"
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.6, delay: 0.3 }}
						>
							<div className="mb-3 flex items-center gap-2 text-sm font-semibold text-sky-300">
								<FiCopy className="h-4 w-4" />
								<span>Editable templates</span>
							</div>
							<p className="mb-4 text-sm text-gray-400">
								Each agent folder includes an <code>agent.md</code> or{" "}
								<code>agent.json</code> plus any prompt files used by subagents.
								Treat these as templates you can clone and tailor per project.
							</p>
						</motion.div>

						<motion.div
							className="panel-card p-6"
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.6, delay: 0.4 }}
						>
							<div className="mb-3 flex items-center gap-2 text-sm font-semibold text-sky-300">
								<FiKey className="h-4 w-4" />
								<span>Provider environment variables</span>
							</div>
							<p className="mb-4 text-sm text-gray-400">
								Set API keys via environment variables (or store tokens in{" "}
								<code>~/.wingman/credentials.json</code>) so bundled agents can
								authenticate with their models.
							</p>
							<div className="rounded-lg bg-slate-950/60 p-4 font-mono text-xs text-sky-300">
								<div>OPENAI_API_KEY</div>
								<div>ANTHROPIC_API_KEY</div>
								<div>OPENROUTER_API_KEY</div>
								<div>XAI_API_KEY</div>
							</div>
						</motion.div>
					</div>
				</div>
			</div>
		</section>
	);
};

export default BundledAgents;
