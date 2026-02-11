import React from "react";
import type { IconType } from "react-icons";
import {
	FiAlertTriangle,
	FiCheckCircle,
	FiChevronDown,
	FiClock,
} from "react-icons/fi";
import type { ToolEvent } from "../types";

type ToolEventPanelProps = {
	toolEvents: ToolEvent[];
	variant?: "panel" | "inline";
};

export const ToolEventPanel: React.FC<ToolEventPanelProps> = ({
	toolEvents,
	variant = "panel",
}) => {
	const sorted = [...toolEvents].sort((a, b) => {
		const aTime = a.startedAt ?? a.timestamp ?? a.completedAt ?? 0;
		const bTime = b.startedAt ?? b.timestamp ?? b.completedAt ?? 0;
		return aTime - bTime;
	});
	const completedCount = sorted.filter(
		(event) => event.status === "completed",
	).length;
	const errorCount = sorted.filter((event) => event.status === "error").length;
	const invokedAgents = summarizeInvokedAgents(sorted);

	const showHeader = variant === "panel";
	const containerClass =
		variant === "panel"
			? "rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-slate-900/70 p-4"
			: "space-y-2.5";

	return (
		<section className={containerClass}>
			{showHeader ? (
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h3 className="text-sm font-semibold text-slate-200">
							Tool activity
						</h3>
						<p className="text-xs text-slate-400">Recent tool calls</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<span className="pill">{sorted.length} total</span>
						{completedCount > 0 ? (
							<span className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-200">
								{completedCount} done
							</span>
						) : null}
						{errorCount > 0 ? (
							<span className="rounded-full border border-rose-400/35 bg-rose-500/15 px-3 py-1 text-[11px] font-semibold text-rose-200">
								{errorCount} failed
							</span>
						) : null}
					</div>
					{invokedAgents.length > 0 ? (
						<div className="flex w-full flex-wrap items-center gap-2">
							<span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
								Invoked agents
							</span>
							{invokedAgents.map((agent) => (
								<span
									key={agent.label}
									className="rounded-full border border-sky-400/35 bg-sky-500/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-200"
								>
									{agent.label}
									{agent.running > 0 ? " active" : ` ${agent.total}`}
								</span>
							))}
						</div>
					) : null}
				</div>
			) : null}
			<div className={showHeader ? "mt-3 space-y-2.5" : "space-y-2.5"}>
				{sorted.map((event) => (
					<ToolEventCard key={event.id} event={event} />
				))}
			</div>
		</section>
	);
};

const ToolEventCard: React.FC<{ event: ToolEvent }> = ({ event }) => {
	const status = TOOL_STATUS_STYLES[event.status];
	const showStatusBadge = event.status !== "completed";
	const actorLabel = resolveActorLabel(event);
	const taskTarget = resolveTaskTarget(event);
	const delegatedLabel =
		getNormalizedToolName(event) === "task"
			? null
			: resolveDelegatedLabel(event);
	const editDiffPreview = buildEditFileDiffPreview(event);
	const argsText = stringifyToolEventValue(event.args);
	const outputText = stringifyToolEventValue(
		event.error ? { error: event.error } : event.output,
	);
	const argsSummary = summarizeToolEventValue(event.args);
	const outputSummary = summarizeToolEventValue(
		event.error ? { error: event.error } : event.output,
	);
	const duration = formatToolEventDuration(event);
	const startedAt = event.startedAt ?? event.timestamp;
	const completedAt = event.completedAt;
	const startedLabel = formatToolEventTime(startedAt);
	const completedLabel = formatToolEventTime(completedAt);
	const hasTimingMeta =
		startedLabel !== "--" || completedLabel !== "--" || Boolean(duration);

	return (
		<details
			className={`group w-full min-w-0 rounded-xl border bg-gradient-to-br px-3 py-2 shadow-[0_8px_20px_rgba(2,8,20,0.35)] ${status.frameTone}`}
		>
			<summary className="flex cursor-pointer list-none items-center justify-between gap-3">
				<div className="min-w-0 flex items-center gap-3">
					<span
						className={`relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${status.iconTone}`}
					>
						<status.Icon className="h-4 w-4" />
						{event.status === "running" ? (
							<span className="absolute inset-0 rounded-lg border border-amber-300/60 animate-ping" />
						) : null}
					</span>
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<div className="truncate text-sm font-semibold text-slate-100">
								{event.name}
							</div>
							{taskTarget ? (
								<span className="rounded-full border border-violet-400/35 bg-violet-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200">
									{taskTarget}
								</span>
							) : null}
							{delegatedLabel ? (
								<span className="rounded-full border border-violet-400/35 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-100">
									via {delegatedLabel}
								</span>
							) : null}
							{actorLabel ? (
								<span className="rounded-full border border-sky-400/40 bg-sky-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-200">
									{actorLabel}
								</span>
							) : null}
							{duration ? (
								<span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">
									{duration}
								</span>
							) : null}
						</div>
						<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
							{argsSummary ? (
								<span className="max-w-[420px] truncate">
									<span className="text-slate-500">args:</span> {argsSummary}
								</span>
							) : outputSummary ? (
								<span className="max-w-[420px] truncate">
									<span className="text-slate-500">output:</span>{" "}
									{outputSummary}
								</span>
							) : null}
						</div>
					</div>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{showStatusBadge ? (
						<span
							className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${status.badgeTone}`}
						>
							{status.label}
						</span>
					) : null}
					<span className="inline-flex h-5 w-5 items-center justify-center text-slate-500 transition group-open:rotate-180 group-open:text-slate-300">
						<FiChevronDown className="h-4 w-4" />
						<span className="sr-only">Toggle details</span>
					</span>
				</div>
			</summary>
			<div className="mt-3 space-y-3 border-t border-white/10 pt-3 text-xs text-slate-300">
				{hasTimingMeta ? (
					<div
						data-testid="tool-timing-meta"
						className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400"
					>
						{startedLabel !== "--" ? (
							<span>
								<span className="text-slate-500">Started:</span> {startedLabel}
							</span>
						) : null}
						{completedLabel !== "--" ? (
							<span>
								<span className="text-slate-500">Completed:</span>{" "}
								{completedLabel}
							</span>
						) : null}
						{duration ? (
							<span>
								<span className="text-slate-500">Duration:</span> {duration}
							</span>
						) : null}
					</div>
				) : null}
				{editDiffPreview ? (
					<EditFileDiffPreview preview={editDiffPreview} />
				) : null}
				{argsText ? <ToolPayload label="Args" value={argsText} /> : null}
				{outputText ? (
					<ToolPayload
						label={event.error ? "Error" : "Output"}
						value={outputText}
					/>
				) : null}
				{!argsText && !outputText ? (
					<div className="rounded-lg border border-dashed border-white/15 bg-slate-950/50 px-3 py-2 text-[11px] text-slate-400">
						No arguments or output were captured for this call.
					</div>
				) : null}
			</div>
		</details>
	);
};

function resolveActorLabel(event: ToolEvent): string | null {
	if (typeof event.actor === "string" && event.actor.trim()) {
		return event.actor.trim();
	}
	if (typeof event.node === "string" && event.node.trim()) {
		return event.node.trim();
	}
	return null;
}

function summarizeInvokedAgents(events: ToolEvent[]): Array<{
	label: string;
	total: number;
	running: number;
}> {
	const counts = new Map<string, { total: number; running: number }>();
	for (const event of events) {
		const label = resolveActorLabel(event);
		if (!label) continue;
		const current = counts.get(label) || { total: 0, running: 0 };
		current.total += 1;
		if (event.status === "running") current.running += 1;
		counts.set(label, current);
	}
	return Array.from(counts.entries())
		.map(([label, value]) => ({ label, ...value }))
		.sort((a, b) => a.label.localeCompare(b.label));
}

type EditFileDiffPreviewModel = {
	filePath: string;
	replaceAll: boolean;
	diffText: string;
};

function resolveTaskTarget(event: ToolEvent): string | null {
	if (!event?.args || typeof event.args !== "object") return null;
	const direct =
		event.args.subagent_type ??
		event.args.subagentType ??
		event.args.subagent ??
		event.args.subAgent ??
		event.args.agent;
	if (typeof direct !== "string" || !direct.trim()) return null;
	return direct.trim();
}

function resolveDelegatedLabel(event: ToolEvent): string | null {
	const delegated = event.delegatedSubagentType;
	if (typeof delegated !== "string" || !delegated.trim()) return null;
	return delegated.trim();
}

function buildEditFileDiffPreview(
	event: ToolEvent,
): EditFileDiffPreviewModel | null {
	if (getNormalizedToolName(event) !== "edit_file") return null;
	const args = event.args;
	if (!args || typeof args !== "object") return null;

	const filePath =
		typeof args.file_path === "string" && args.file_path.trim()
			? args.file_path.trim()
			: null;
	const oldString =
		typeof args.old_string === "string" ? args.old_string : null;
	const newString =
		typeof args.new_string === "string" ? args.new_string : null;
	if (!filePath || oldString === null || newString === null) return null;

	if (
		oldString.includes("\u0000") ||
		newString.includes("\u0000") ||
		oldString.length > 4_000 ||
		newString.length > 4_000
	) {
		return null;
	}

	const oldLines = clipDiffLines(oldString, "-");
	const newLines = clipDiffLines(newString, "+");
	const diffText = [
		`--- ${filePath}`,
		`+++ ${filePath}`,
		"@@ replacement @@",
		...oldLines,
		...newLines,
	].join("\n");

	return {
		filePath,
		replaceAll: args.replace_all === true,
		diffText,
	};
}

function clipDiffLines(value: string, prefix: "-" | "+"): string[] {
	const maxLines = 24;
	const lines = value.split("\n");
	const clipped = lines.slice(0, maxLines).map((line) => `${prefix}${line}`);
	if (lines.length > maxLines) {
		clipped.push(`${prefix}... (${lines.length - maxLines} more line(s))`);
	}
	return clipped;
}

function getNormalizedToolName(event: ToolEvent): string {
	if (typeof event?.name !== "string") return "";
	return event.name.trim().toLowerCase();
}

const EditFileDiffPreview: React.FC<{ preview: EditFileDiffPreviewModel }> = ({
	preview,
}) => (
	<div>
		<div className="flex flex-wrap items-center gap-2">
			<span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
				Diff preview
			</span>
			<span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">
				{preview.filePath}
			</span>
			{preview.replaceAll ? (
				<span className="rounded-full border border-amber-400/35 bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100">
					replace all
				</span>
			) : null}
		</div>
		<pre className="mt-2 max-h-52 w-full min-w-0 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-lg border border-white/10 bg-slate-950/80 p-2 text-[11px] text-slate-300">
			{preview.diffText}
		</pre>
	</div>
);

const ToolPayload: React.FC<{ label: string; value: string }> = ({
	label,
	value,
}) => (
	<div>
		<span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
			{label}
		</span>
		<pre className="mt-2 max-h-40 w-full min-w-0 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-lg border border-white/10 bg-slate-950/80 p-2 text-[11px] text-slate-300">
			{value}
		</pre>
	</div>
);

type ToolStatusStyle = {
	label: string;
	Icon: IconType;
	frameTone: string;
	iconTone: string;
	badgeTone: string;
};

const TOOL_STATUS_STYLES: Record<ToolEvent["status"], ToolStatusStyle> = {
	running: {
		label: "Running",
		Icon: FiClock,
		frameTone:
			"border-amber-400/35 from-amber-500/8 via-slate-900/70 to-slate-950/70",
		iconTone: "border-amber-400/50 bg-amber-500/15 text-amber-200",
		badgeTone: "border-amber-400/45 bg-amber-500/15 text-amber-200",
	},
	completed: {
		label: "Completed",
		Icon: FiCheckCircle,
		frameTone:
			"border-emerald-400/30 from-emerald-500/8 via-slate-900/70 to-slate-950/70",
		iconTone: "border-emerald-400/45 bg-emerald-500/15 text-emerald-200",
		badgeTone: "border-emerald-400/40 bg-emerald-500/12 text-emerald-200",
	},
	error: {
		label: "Error",
		Icon: FiAlertTriangle,
		frameTone:
			"border-rose-400/35 from-rose-500/10 via-slate-900/70 to-slate-950/70",
		iconTone: "border-rose-400/45 bg-rose-500/15 text-rose-200",
		badgeTone: "border-rose-400/45 bg-rose-500/15 text-rose-200",
	},
};

export function stringifyToolEventValue(
	value: unknown,
	maxLength = 1200,
): string | null {
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
	if (text.length > maxLength) {
		return `${text.slice(0, maxLength)}...`;
	}
	return text;
}

export function summarizeToolEventValue(
	value: unknown,
	maxLength = 160,
): string | null {
	const text = stringifyToolEventValue(value, maxLength * 2);
	if (!text) return null;
	const compact = text.replace(/\s+/g, " ").trim();
	if (!compact) return null;
	if (compact.length > maxLength) {
		return `${compact.slice(0, maxLength)}...`;
	}
	return compact;
}

export function formatToolEventDuration(
	event: ToolEvent,
	now = Date.now(),
): string | null {
	const start = event.startedAt ?? event.timestamp;
	if (!start) return null;
	const end =
		event.completedAt ?? (event.status === "running" ? now : undefined);
	if (!end || end < start) return null;

	const durationMs = Math.max(0, end - start);
	if (durationMs < 1000) {
		return `${durationMs}ms`;
	}
	if (durationMs < 10_000) {
		return `${(durationMs / 1000).toFixed(1)}s`;
	}
	if (durationMs < 60_000) {
		return `${Math.round(durationMs / 1000)}s`;
	}

	const minutes = Math.floor(durationMs / 60_000);
	const seconds = Math.round((durationMs % 60_000) / 1000);
	return `${minutes}m ${seconds}s`;
}

export function formatToolEventTime(timestamp?: number): string {
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
