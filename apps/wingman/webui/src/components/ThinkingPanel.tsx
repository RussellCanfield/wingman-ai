import type React from "react";
import { useState } from "react";
import type { ThinkingEvent } from "../types";

type ThinkingPanelProps = {
	thinkingEvents: ThinkingEvent[];
	isStreaming: boolean;
};

export const ThinkingPanel: React.FC<ThinkingPanelProps> = ({
	thinkingEvents,
	isStreaming,
}) => {
	const sortedThinking = [...thinkingEvents].sort(
		(a, b) => a.updatedAt - b.updatedAt,
	);
	const hasThinking = sortedThinking.length > 0;
	const [isThinkingOpen, setIsThinkingOpen] = useState(() =>
		shouldOpenThinkingPanelByDefault({
			isStreaming,
			hasThinking,
			activeTools: 0,
		}),
	);
	if (!hasThinking) {
		return null;
	}
	const summary = buildThinkingSummary({
		thinkingCount: sortedThinking.length,
		toolCount: 0,
	});

	return (
		<div className="space-y-3">
			<details
				className="rounded-xl border border-sky-400/35 bg-sky-500/10 px-3 py-2 text-sm text-slate-200"
				open={isThinkingOpen}
				onToggle={(event) => setIsThinkingOpen(event.currentTarget.open)}
			>
				<summary className="flex cursor-pointer list-none items-center justify-between gap-3">
					<span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
						Subagent notes
					</span>
					<span className="text-xs text-slate-400">{summary}</span>
				</summary>
				<div className="mt-2 space-y-2">
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
			</details>
		</div>
	);
};

export function shouldOpenThinkingPanelByDefault(_params: {
	isStreaming: boolean;
	hasThinking: boolean;
	activeTools: number;
}): boolean {
	return false;
}

export function buildThinkingSummary({
	thinkingCount,
	toolCount,
}: {
	thinkingCount: number;
	toolCount: number;
}): string {
	const summaryParts: string[] = [];
	if (thinkingCount > 0) {
		summaryParts.push(
			`${thinkingCount} subagent${thinkingCount === 1 ? "" : "s"}`,
		);
	}
	if (toolCount > 0) {
		summaryParts.push(`${toolCount} tool${toolCount === 1 ? "" : "s"}`);
	}
	return summaryParts.length > 0 ? summaryParts.join(" • ") : "Activity";
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
