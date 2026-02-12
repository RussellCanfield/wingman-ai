import React, { useEffect, useState } from "react";
import { HiMiniChevronDown, HiMiniChevronUp } from "react-icons/hi2";
import type { GatewayHealth, GatewayStats } from "../types";

const HERO_PANEL_EXPANDED_KEY = "wingman_hero_panel_expanded";
const HERO_PANEL_TOGGLE_BUTTON_CLASS =
	"grid h-8 w-8 flex-shrink-0 place-items-center self-center rounded-full border border-white/10 bg-slate-900/65 text-slate-300 leading-none transition-colors hover:text-slate-100";

export const getInitialHeroPanelExpanded = (
	storedValue: string | null,
): boolean => {
	if (storedValue !== null) return storedValue === "true";
	return false;
};

type HeroPanelProps = {
	agentId: string;
	activeThreadName?: string;
	statusLabel: string;
	connected: boolean;
	health: GatewayHealth;
	stats: GatewayStats;
	formatDuration: (ms?: number) => string;
};

export const HeroPanel: React.FC<HeroPanelProps> = ({
	agentId,
	activeThreadName,
	statusLabel,
	connected,
	health,
	stats,
	formatDuration,
}) => {
	const [isExpanded, setIsExpanded] = useState<boolean>(() => {
		if (typeof window === "undefined") return false;
		const stored = localStorage.getItem(HERO_PANEL_EXPANDED_KEY);
		return getInitialHeroPanelExpanded(stored);
	});

	useEffect(() => {
		if (typeof window === "undefined") return;
		localStorage.setItem(HERO_PANEL_EXPANDED_KEY, String(isExpanded));
	}, [isExpanded]);

	const toggleExpanded = () => setIsExpanded((prev) => !prev);

	return (
		<section className="glass-edge animate-floatIn relative overflow-hidden rounded-2xl px-4 py-3 lg:rounded-[32px] lg:px-7 lg:py-7 transition-all duration-300 ease-in-out">
			{/* Compact view - shown whenever collapsed */}
			<div>
				{!isExpanded && (
					<div className="space-y-2">
						{/* Line 1: Status and key metrics */}
						<div className="flex items-center justify-between gap-3">
							<div className="flex items-center gap-2 flex-wrap">
								<span
									className={`h-2.5 w-2.5 rounded-full ${
										connected
											? "bg-sky-500 animate-pulseSoft"
											: "bg-slate-600"
									}`}
								/>
								<span className="text-sm font-semibold text-ink">
									Gateway
								</span>
								<span className="text-slate-400">•</span>
								<span className="text-xs text-slate-300">
									{statusLabel}
								</span>
								<span className="text-slate-400">•</span>
								<span className="text-xs text-slate-300">
									Health: {health.status || "--"}
								</span>
							</div>
							<button
								type="button"
								onClick={toggleExpanded}
								aria-expanded={false}
								aria-label="Expand mission console"
								className={HERO_PANEL_TOGGLE_BUTTON_CLASS}
							>
								<HiMiniChevronDown className="pointer-events-none block h-5 w-5" />
							</button>
						</div>
						{/* Line 2: Agent, thread, uptime */}
						<div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
							<span>agent: {agentId}</span>
							<span>•</span>
							<span>thread: {activeThreadName || "--"}</span>
							<span>•</span>
							<span>uptime: {formatDuration(health.stats?.uptime)}</span>
						</div>
					</div>
				)}
			</div>

			{/* Full view - shown only when expanded */}
			<div className={isExpanded ? "block" : "hidden"}>
				<div className="mb-3 flex justify-end">
					<button
						type="button"
						onClick={toggleExpanded}
						aria-expanded={true}
						aria-label="Collapse mission console"
						className={HERO_PANEL_TOGGLE_BUTTON_CLASS}
					>
						<HiMiniChevronUp className="pointer-events-none block h-5 w-5" />
					</button>
				</div>
				<div className="relative z-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
					<div className="space-y-4">
						<p className="text-xs uppercase tracking-[0.3em] text-slate-400">
							Wingman Control Core
						</p>
						<h1 className="text-4xl font-semibold tracking-tight text-ink">
							<span className="text-gradient">Gateway</span> Mission Console
						</h1>
						<p className="text-sm text-slate-300">
							Run your agent fleet, inspect runtime state, and stream intelligence through a single command deck.
						</p>
						<div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
							<span className="pill">channel: webui</span>
							<span className="pill">active agent: {agentId}</span>
							<span className="pill">thread: {activeThreadName || "--"}</span>
						</div>
					</div>
					<div className="space-y-4">
						<div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 shadow-[0_10px_24px_rgba(18,14,12,0.12)]">
							<div>
								<p className="text-xs uppercase tracking-[0.2em] text-slate-400">Status</p>
								<p className="text-lg font-semibold">{statusLabel}</p>
							</div>
							<span
								className={`h-3 w-3 rounded-full ${
									connected ? "bg-sky-500/100 animate-pulseSoft" : "bg-slate-600"
								}`}
							/>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="stat-card p-3">
								<span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Health</span>
								<strong className="mt-2 block text-lg">{health.status || "--"}</strong>
							</div>
							<div className="stat-card p-3">
								<span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Uptime</span>
								<strong className="mt-2 block text-lg">{formatDuration(health.stats?.uptime)}</strong>
							</div>
							<div className="stat-card p-3">
								<span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Nodes</span>
								<strong className="mt-2 block text-lg">{stats.nodes?.totalNodes ?? "--"}</strong>
							</div>
							<div className="stat-card p-3">
								<span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Groups</span>
								<strong className="mt-2 block text-lg">{stats.groups?.totalGroups ?? "--"}</strong>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};
