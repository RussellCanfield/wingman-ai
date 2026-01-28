import React from "react";
import type { ToolEvent } from "../types";

type ToolEventPanelProps = {
	toolEvents: ToolEvent[];
	activeCount: number;
	variant?: "panel" | "inline";
};

export const ToolEventPanel: React.FC<ToolEventPanelProps> = ({
	toolEvents,
	activeCount,
	variant = "panel",
}) => {
	const sorted = [...toolEvents].sort((a, b) => {
		const aTime = a.startedAt ?? 0;
		const bTime = b.startedAt ?? 0;
		return aTime - bTime;
	});

	const showHeader = variant === "panel";
	const containerClass =
		variant === "panel"
			? "rounded-2xl border border-black/10 bg-white/80 p-4"
			: "space-y-2";

	return (
		<section className={containerClass}>
			{showHeader ? (
				<div className="flex items-center justify-between">
					<div>
						<h3 className="text-sm font-semibold text-slate-700">Tool activity</h3>
						<p className="text-xs text-slate-500">
							{activeCount > 0
								? `${activeCount} tool${activeCount === 1 ? "" : "s"} running`
								: "Recent tool calls"}
						</p>
					</div>
					<span className="pill">{sorted.length}</span>
				</div>
			) : null}
			<div className={showHeader ? "mt-3 space-y-2" : "space-y-2"}>
				{sorted.map((event) => (
					<ToolEventCard key={event.id} event={event} />
				))}
			</div>
		</section>
	);
};

const ToolEventCard: React.FC<{ event: ToolEvent }> = ({ event }) => {
	const statusLabel =
		event.status === "running"
			? "Running"
			: event.status === "error"
				? "Error"
				: "Completed";
	const statusTone =
		event.status === "running"
			? "border-amber-200/60 bg-amber-50/70 text-amber-700"
			: event.status === "error"
				? "border-rose-200/60 bg-rose-50/70 text-rose-600"
				: "border-emerald-200/60 bg-emerald-50/70 text-emerald-700";

	const argsText = stringifyPreview(event.args);
	const outputText = stringifyPreview(
		event.error ? { error: event.error } : event.output,
	);

	return (
		<details className="rounded-xl border border-black/10 bg-white/90 px-3 py-2">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-3">
				<div>
					<div className="text-sm font-semibold text-slate-800">{event.name}</div>
					{event.startedAt ? (
						<div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
							{formatTime(event.startedAt)}
						</div>
					) : null}
				</div>
				<span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${statusTone}`}>
					{statusLabel}
				</span>
			</summary>
			<div className="mt-3 space-y-3 text-xs text-slate-600">
				{argsText ? (
					<div>
						<span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Args</span>
						<pre className="mt-2 max-h-32 overflow-auto rounded-lg border border-black/5 bg-slate-50/70 p-2 text-[11px] text-slate-600">
							{argsText}
						</pre>
					</div>
				) : null}
				{outputText ? (
					<div>
						<span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
							{event.error ? "Error" : "Output"}
						</span>
						<pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-black/5 bg-slate-50/70 p-2 text-[11px] text-slate-600">
							{outputText}
						</pre>
					</div>
				) : null}
			</div>
		</details>
	);
};

function stringifyPreview(value: any): string | null {
	if (value === null || value === undefined) return null;
	let text: string;
	if (typeof value === "string") {
		text = value;
	} else {
		try {
			text = JSON.stringify(value, null, 2);
		} catch {
			text = String(value);
		}
	}
	if (text.length > 800) {
		return `${text.slice(0, 800)}...`;
	}
	return text;
}

function formatTime(timestamp?: number): string {
	if (!timestamp) return "--";
	try {
		return new Date(timestamp).toLocaleTimeString(undefined, {
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return "--";
	}
}
