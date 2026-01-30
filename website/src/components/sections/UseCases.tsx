import { motion } from "framer-motion";
import {
	FiArrowRight,
	FiClock,
	FiShare2,
	FiSmartphone,
	FiUsers,
} from "react-icons/fi";

const UseCases = () => {
	const cases = [
		{
			icon: FiSmartphone,
			title: "Code from Phone, Continue in IDE",
			description:
				"Start a coding session on your phone via WebUI, pick up in VSCode later. Sessions persist across devices.",
			gradient: "from-sky-400 to-blue-500",
		},
		{
			icon: FiShare2,
			title: "Agent Swarms for Complex Tasks",
			description:
				"Launch specialized agents that collaborate on architecture, implementation, and testing in parallel.",
			gradient: "from-blue-400 to-indigo-500",
		},
		{
			icon: FiClock,
			title: "Automated Routines & Webhooks",
			description:
				"Schedule agents via CRON, trigger from GitHub events, or integrate with email workflows.",
			gradient: "from-sky-500 to-cyan-500",
		},
		{
			icon: FiUsers,
			title: "Team Collaboration",
			description:
				"Multiple developers connect to the same gateway instance for shared context and knowledge.",
			gradient: "from-blue-500 to-sky-600",
		},
	];

	return (
		<section className="relative z-10 px-4 py-24">
			<div className="container mx-auto">
				<div className="mb-16 text-center">
					<motion.h2
						className="mb-4 text-4xl font-bold md:text-5xl"
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6 }}
					>
						Built for <span className="gradient-text">Real Workflows</span>
					</motion.h2>
					<motion.p
						className="mx-auto max-w-2xl text-lg text-gray-400"
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6, delay: 0.1 }}
					>
						The distributed architecture enables scenarios that single-client
						tools can't handle.
					</motion.p>
				</div>

				<div className="grid gap-8 md:grid-cols-2">
					{cases.map((useCase, index) => (
						<motion.div
							key={useCase.title}
							className="group panel-card relative overflow-hidden p-8 transition-all hover:shadow-glow"
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.6, delay: index * 0.1 }}
						>
							{/* Gradient background on hover */}
							<div
								className={`absolute inset-0 bg-gradient-to-br ${useCase.gradient} opacity-0 transition-opacity group-hover:opacity-5`}
							/>

							<div className="relative">
								<div
									className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${useCase.gradient} shadow-lg`}
								>
									<useCase.icon className="h-7 w-7 text-white" />
								</div>

								<h3 className="mb-3 text-2xl font-semibold text-white">
									{useCase.title}
								</h3>
								<p className="mb-4 text-gray-400">{useCase.description}</p>

								<div className="flex items-center gap-2 text-sm font-medium text-sky-400 opacity-0 transition-opacity group-hover:opacity-100">
									<span>Learn more</span>
									<FiArrowRight className="h-4 w-4" />
								</div>
							</div>
						</motion.div>
					))}
				</div>

				{/* Bottom CTA */}
				<motion.div
					className="mt-16 text-center"
					initial={{ opacity: 0, y: 20 }}
					whileInView={{ opacity: 1, y: 0 }}
					viewport={{ once: true }}
					transition={{ duration: 0.6, delay: 0.4 }}
				>
					<p className="mb-4 text-lg text-gray-400">
						Ready to transform your AI coding workflow?
					</p>
					<a
						href="#quick-start"
						className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-8 py-3 font-semibold text-white shadow-glow transition-all hover:shadow-[0_0_0_1px_rgba(56,189,248,0.15),0_18px_42px_rgba(59,130,246,0.4)]"
					>
						Get Started
						<FiArrowRight />
					</a>
				</motion.div>
			</div>
		</section>
	);
};

export default UseCases;
