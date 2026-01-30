import React from "react";

type EventLogPanelProps = {
	eventLog: string[];
};

export const EventLogPanel: React.FC<EventLogPanelProps> = ({ eventLog }) => {
	return (
		<section className="panel-card animate-rise space-y-3 p-5">
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">Telemetry</h3>
				<span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Live events</span>
			</div>
			<div className="max-h-60 overflow-auto rounded-xl border border-white/10 bg-slate-900/65 p-3 text-xs font-mono text-slate-200">
				{eventLog.length === 0 ? (
					<div className="text-slate-400">No events yet.</div>
				) : (
					eventLog.map((entry, idx) => (
						<div
							key={`${entry}-${idx}`}
							className="border-b border-dashed border-white/10 py-1 last:border-0"
						>
							{entry}
						</div>
					))
				)}
			</div>
		</section>
	);
};
