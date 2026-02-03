import React from "react";

type TimelineStatus = "neutral" | "info" | "success" | "warning" | "error";

type TimelineItem = {
	time: string;
	title: string;
	description?: string;
	status?: TimelineStatus;
	tag?: string;
};

export type TimelineProps = {
	title: string;
	subtitle?: string;
	items: TimelineItem[];
};

const statusStyles: Record<TimelineStatus, { dot: string; text: string }> = {
	neutral: { dot: "bg-slate-400", text: "text-slate-300" },
	info: { dot: "bg-sky-400", text: "text-sky-300" },
	success: { dot: "bg-emerald-400", text: "text-emerald-300" },
	warning: { dot: "bg-amber-400", text: "text-amber-300" },
	error: { dot: "bg-rose-400", text: "text-rose-300" },
};

export const Timeline: React.FC<TimelineProps> = ({ title, subtitle, items }) => {
	return (
		<div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-lg">
			<div>
				<p className="text-xs uppercase tracking-[0.25em] text-slate-400">{title}</p>
				{subtitle ? (
					<h4 className="mt-1 text-lg font-semibold text-slate-100">{subtitle}</h4>
				) : null}
			</div>
			<div className="mt-4 space-y-4">
				{items.map((item, index) => {
					const status = statusStyles[item.status ?? "neutral"];
					const isLast = index === items.length - 1;
					return (
						<div key={`${item.title}-${item.time}`} className="relative pl-7">
							<div
								className={`absolute left-[9px] top-2 h-2.5 w-2.5 rounded-full ${status.dot}`}
							/>
							{!isLast ? (
								<div className="absolute left-[13px] top-6 h-full w-px bg-white/10" />
							) : null}
							<div className="flex flex-wrap items-center gap-3">
								<span className="text-xs uppercase tracking-[0.2em] text-slate-400">
									{item.time}
								</span>
								{item.tag ? (
									<span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-slate-300">
										{item.tag}
									</span>
								) : null}
							</div>
							<div className="mt-1 text-sm font-semibold text-slate-100">
								{item.title}
							</div>
							{item.description ? (
								<p className={`mt-1 text-sm ${status.text}`}>{item.description}</p>
							) : null}
						</div>
					);
				})}
			</div>
		</div>
	);
};

export default Timeline;
