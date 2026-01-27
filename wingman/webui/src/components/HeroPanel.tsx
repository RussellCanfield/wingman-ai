import React from "react";
import type { GatewayHealth, GatewayStats } from "../types";

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
	return (
		<section className="glass-edge animate-floatIn relative overflow-hidden rounded-[32px] px-7 py-7">
			<div className="relative z-10 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
				<div className="space-y-4">
					<p className="text-xs uppercase tracking-[0.3em] text-slate-500">
						Wingman Control Core
					</p>
					<h1 className="text-4xl font-semibold tracking-tight text-ink">
						<span className="text-gradient">Gateway</span> Mission Console
					</h1>
					<p className="text-sm text-slate-600">
						Run your agent fleet, inspect runtime state, and stream intelligence through a single command deck.
					</p>
					<div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
						<span className="pill">channel: webui</span>
						<span className="pill">active agent: {agentId}</span>
						<span className="pill">thread: {activeThreadName || "--"}</span>
					</div>
				</div>
				<div className="space-y-4">
					<div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/90 px-4 py-3 shadow-[0_10px_24px_rgba(18,14,12,0.12)]">
						<div>
							<p className="text-xs uppercase tracking-[0.2em] text-slate-500">Status</p>
							<p className="text-lg font-semibold">{statusLabel}</p>
						</div>
						<span
							className={`h-3 w-3 rounded-full ${
								connected ? "bg-emerald-500 animate-pulseSoft" : "bg-slate-300"
							}`}
						/>
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="stat-card p-3">
							<span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Health</span>
							<strong className="mt-2 block text-lg">{health.status || "--"}</strong>
						</div>
						<div className="stat-card p-3">
							<span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Uptime</span>
							<strong className="mt-2 block text-lg">{formatDuration(health.stats?.uptime)}</strong>
						</div>
						<div className="stat-card p-3">
							<span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Nodes</span>
							<strong className="mt-2 block text-lg">{stats.nodes?.totalNodes ?? "--"}</strong>
						</div>
						<div className="stat-card p-3">
							<span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Groups</span>
							<strong className="mt-2 block text-lg">{stats.groups?.totalGroups ?? "--"}</strong>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};
