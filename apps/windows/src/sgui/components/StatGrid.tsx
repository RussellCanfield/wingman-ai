import React from "react";

export type StatGridProps = {
	title: string;
	subtitle?: string;
	stats: Array<{
		label: string;
		value: string | number;
		helper?: string;
	}>;
};

export const StatGrid: React.FC<StatGridProps> = ({ title, subtitle, stats }) => {
	return (
		<div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-lg">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<p className="text-xs uppercase tracking-[0.25em] text-slate-400">
						{title}
					</p>
					{subtitle ? (
						<h4 className="mt-1 text-lg font-semibold text-slate-100">
							{subtitle}
						</h4>
					) : null}
				</div>
			</div>
			<div className="mt-4 grid gap-3 sm:grid-cols-2">
				{stats.map((stat) => (
					<div
						key={`${stat.label}-${stat.value}`}
						className="rounded-xl border border-white/5 bg-slate-900/70 p-3"
					>
						<div className="text-xs uppercase tracking-[0.2em] text-slate-400">
							{stat.label}
						</div>
						<div className="mt-2 text-2xl font-semibold text-slate-100">
							{stat.value}
						</div>
						{stat.helper ? (
							<div className="mt-1 text-xs text-slate-400">{stat.helper}</div>
						) : null}
					</div>
				))}
			</div>
		</div>
	);
};

export default StatGrid;
