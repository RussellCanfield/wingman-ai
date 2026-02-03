import { motion } from "framer-motion";
import {
	FiActivity,
	FiAlertTriangle,
	FiBarChart2,
	FiFileText,
	FiFilter,
	FiLink,
	FiTrendingUp,
} from "react-icons/fi";

const FinnhubMcp = () => {
	const capabilities = [
		{
			title: "Quotes + candles",
			description:
				"Realtime quotes and OHLCV candles with configurable lookback caps.",
			icon: FiTrendingUp,
		},
		{
			title: "Fundamentals + earnings",
			description:
				"Company profiles, key metrics, peers, and earnings history for context.",
			icon: FiBarChart2,
		},
		{
			title: "News + market themes",
			description:
				"Company news and broad market headlines for situational awareness.",
			icon: FiFileText,
		},
		{
			title: "Options + analytics",
			description:
				"Option chains plus built-in payoff and Greeks analysis tools.",
			icon: FiFilter,
		},
		{
			title: "Technical snapshot",
			description:
				"RSI/EMA/ATR computed from recent candles for quick signals.",
			icon: FiActivity,
		},
	];

	return (
		<section id="finnhub-mcp" className="relative z-10 px-4 py-24">
			<div className="container mx-auto">
				<div className="mb-16 text-center">
					<motion.h2
						className="mb-4 text-4xl font-bold md:text-5xl"
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6 }}
					>
						Finnhub <span className="gradient-text">MCP Server</span>
					</motion.h2>
					<motion.p
						className="mx-auto max-w-2xl text-lg text-gray-400"
						initial={{ opacity: 0, y: 20 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6, delay: 0.1 }}
					>
						Power the <span className="text-sky-300">stock-trader</span> agent
						with live market data via Wingman&apos;s finance MCP server. Candle
						data defaults to Yahoo Finance, with optional Finnhub or auto
						fallback behavior.
					</motion.p>
				</div>

				<div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
					<div className="grid gap-6 md:grid-cols-2">
						{capabilities.map((capability, index) => (
							<motion.div
								key={capability.title}
								className="panel-card group relative p-6 transition-all hover:shadow-glow"
								initial={{ opacity: 0, y: 20 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true }}
								transition={{ duration: 0.6, delay: index * 0.1 }}
							>
								<div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10">
									<capability.icon className="h-6 w-6 text-sky-400" />
								</div>
								<h3 className="mb-2 text-xl font-semibold text-white">
									{capability.title}
								</h3>
								<p className="text-sm text-gray-400">
									{capability.description}
								</p>
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
								<FiLink className="h-4 w-4" />
								<span>Wire it into Wingman</span>
							</div>
							<p className="mb-4 text-sm text-gray-400">
								Register the finance MCP server in{" "}
								<code>.wingman/wingman.config.json</code> under{" "}
								<code>mcp.servers</code> using either stdio or SSE transport.
							</p>
							<div className="rounded-lg bg-slate-950/60 p-4 font-mono text-xs text-sky-300">
								<div>mcp.servers[0].transport: "stdio" | "sse"</div>
								<div>mcp.servers[0].name: "finnhub"</div>
								<div>mcp.servers[0].env.FINNHUB_API_KEY</div>
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
								<FiFilter className="h-4 w-4" />
								<span>Environment variables</span>
							</div>
							<p className="mb-4 text-sm text-gray-400">
								Set <code>FINNHUB_API_KEY</code> and tune data sources or rate
								limits with optional overrides.
							</p>
							<div className="rounded-lg bg-slate-950/60 p-4 font-mono text-xs text-sky-300">
								<div>FINNHUB_API_KEY</div>
								<div>FINNHUB_CANDLES_PROVIDER=yahoo|finnhub|auto</div>
								<div>FINNHUB_CANDLE_MAX_DAYS_INTRADAY</div>
								<div>FINNHUB_CANDLE_MAX_DAYS_DAILY</div>
								<div>FINNHUB_RATE_LIMIT_PER_MIN</div>
							</div>
						</motion.div>

						<motion.div
							className="panel-card p-6"
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.6, delay: 0.4 }}
						>
							<div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-300">
								<FiAlertTriangle className="h-4 w-4" />
								<span>Research-only disclaimer</span>
							</div>
							<p className="text-sm text-gray-400">
								The stock-trader agent is designed for research and education
								only. It does not provide financial advice or execute trades.
							</p>
						</motion.div>
					</div>
				</div>
			</div>
		</section>
	);
};

export default FinnhubMcp;
