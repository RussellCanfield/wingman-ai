import React from "react";
import type { ThinkingEvent, ToolEvent } from "../types";
import { ToolEventPanel } from "./ToolEventPanel";

type ThinkingPanelProps = {
	thinkingEvents: ThinkingEvent[];
	toolEvents: ToolEvent[];
	isStreaming: boolean;
};

export const ThinkingPanel: React.FC<ThinkingPanelProps> = ({
	thinkingEvents,
	toolEvents,
	isStreaming,
}) => {
	const sortedThinking = [...thinkingEvents].sort(
		(a, b) => a.updatedAt - b.updatedAt,
	);
	const activeTools = toolEvents.filter((event) => event.status === "running")
		.length;
	const hasThinking = sortedThinking.length > 0;
	const hasTools = toolEvents.length > 0;
	const summaryParts: string[] = [];

	if (hasThinking) {
		summaryParts.push(
			`${sortedThinking.length} subagent${sortedThinking.length === 1 ? "" : "s"}`,
		);
	}
	if (hasTools) {
		summaryParts.push(
			`${toolEvents.length} tool${toolEvents.length === 1 ? "" : "s"}`,
		);
	}
	if (activeTools > 0) {
		summaryParts.push(
			`${activeTools} running`,
		);
	}

	const summary = summaryParts.length > 0 ? summaryParts.join(" • ") : "Activity";

	return (
		<details
			className="rounded-2xl border border-sky-400/40 bg-sky-500/10 px-4 py-3 text-sm text-slate-200 shadow-[0_10px_18px_rgba(18,14,12,0.08)]"
			defaultOpen={isStreaming && (hasThinking || activeTools > 0)}
		>
			<summary className="flex cursor-pointer list-none items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
						Thinking
					</span>
					<span className="text-xs text-slate-400">{summary}</span>
				</div>
				<div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">
					{isStreaming ? (
						<span className="flex items-center gap-1">
							<span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
							<span>Streaming</span>
						</span>
					) : (
						<span>Idle</span>
					)}
				</div>
			</summary>
			<div className="mt-3 space-y-3">
				{hasThinking ? (
					<div className="space-y-2">
						{sortedThinking.map((event) => (
							<details
								key={event.id}
								className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2"
							>
								<summary className="flex cursor-pointer list-none items-center justify-between gap-3">
									<div>
										<div className="text-sm font-semibold text-slate-100">
											{event.node ? event.node : "Subagent"}
										</div>
										<div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
											{formatTime(event.updatedAt)}
										</div>
									</div>
									<span className="rounded-full border border-sky-400/40 bg-sky-500/12 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300">
										Insight
									</span>
								</summary>
								<div className="mt-3 whitespace-pre-wrap text-xs text-slate-300">
									{event.content}
								</div>
							</details>
						))}
					</div>
				) : null}
				{hasTools ? (
					<div className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
						<ToolEventPanel
							toolEvents={toolEvents}
							activeCount={activeTools}
							variant="inline"
						/>
					</div>
				) : null}
			</div>
		</details>
	);
};

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
