import React from "react";

type StatusTone = "ok" | "warning" | "error" | "pending" | "info";

type StatusItem = {
	label: string;
	status: StatusTone;
	value?: string | number;
	helper?: string;
};

export type StatusListProps = {
	title: string;
	subtitle?: string;
	items: StatusItem[];
};

const toneStyles: Record<StatusTone, { dot: string; text: string }> = {
	ok: { dot: "bg-emerald-400", text: "text-emerald-300" },
	warning: { dot: "bg-amber-400", text: "text-amber-300" },
	error: { dot: "bg-rose-400", text: "text-rose-300" },
	pending: { dot: "bg-sky-400", text: "text-sky-300" },
	info: { dot: "bg-blue-400", text: "text-blue-300" },
};

export const StatusList: React.FC<StatusListProps> = ({ title, subtitle, items }) => {
	return (
		<div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-lg">
			<div>
				<p className="text-xs uppercase tracking-[0.25em] text-slate-400">{title}</p>
				{subtitle ? (
					<h4 className="mt-1 text-lg font-semibold text-slate-100">{subtitle}</h4>
				) : null}
			</div>
			<div className="mt-4 space-y-3">
				{items.map((item) => {
					const tone = toneStyles[item.status];
					return (
						<div
							key={`${item.label}-${item.status}`}
							className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-slate-900/70 px-3 py-2"
						>
							<div className="flex items-start gap-3">
								<span className={`mt-1 h-2.5 w-2.5 rounded-full ${tone.dot}`} />
								<div>
									<div className="text-sm font-semibold text-slate-100">{item.label}</div>
									{item.helper ? (
										<div className="text-xs text-slate-400">{item.helper}</div>
									) : null}
								</div>
							</div>
							<div className={`text-sm font-semibold ${tone.text}`}>
								{item.value ?? item.status}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default StatusList;
