import type React from "react";
import { ChevronDownIcon, ToolIcon } from "./DesktopIcons.js";
import type { ToolEvent } from "../lib/gatewayModels.js";
import {
	findToolTextArg,
	formatToolDisplayName,
	normalizeToolName,
} from "../lib/toolDisplay.js";
import { summarizeToolEventValue, ToolEventPanel } from "./ToolEventPanel.js";

type ToolActivityRollupProps = {
	toolEvents: ToolEvent[];
	className?: string;
};

export function ToolActivityRollup({
	toolEvents,
	className = "",
}: ToolActivityRollupProps): React.JSX.Element | null {
	if (toolEvents.length === 0) {
		return null;
	}

	const sortedToolEvents = sortToolEventsByTime(toolEvents);
	const tickerLines = sortedToolEvents.map(buildToolActivityTickerLine);
	const hasRunningTool = sortedToolEvents.some(
		(event) => event.status === "running",
	);
	const hasErrorTool = sortedToolEvents.some((event) => event.status === "error");
	const translateYRem = Math.max(0, tickerLines.length - 1) * 1.25;
	const iconTone = hasRunningTool
		? "border-sky-400/35 bg-sky-500/12 text-sky-200 shadow-[0_0_16px_rgba(56,189,248,0.2)]"
		: hasErrorTool
			? "border-rose-400/35 bg-rose-500/12 text-rose-200 shadow-[0_0_16px_rgba(251,113,133,0.16)]"
			: "border-white/10 bg-white/5 text-slate-300";

	return (
		<div className={`space-y-2 ${className}`.trim()}>
			<details data-testid="tool-activity-rollup" className="group">
				<summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg border border-white/10 bg-slate-950/45 px-3 py-2 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)] transition hover:border-sky-400/30 hover:bg-slate-900/60">
					<span
						data-testid="tool-activity-rollup-icon"
						className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${iconTone}`}
					>
						<ToolIcon className="h-3.5 w-3.5" />
						<span className="sr-only">Tool activity</span>
					</span>
					<div className="min-w-0 flex-1 overflow-hidden">
						<div className="min-w-0 h-5 overflow-hidden">
							<div
								data-testid="tool-activity-rollup-ticker"
								className="transition-transform duration-500 ease-out will-change-transform"
								style={{ transform: `translateY(-${translateYRem}rem)` }}
							>
								{tickerLines.map((line, index) => (
									<div
										key={`${sortedToolEvents[index]?.id ?? index}-${line}`}
										className="tool-rollup-line h-5 truncate text-sm font-medium leading-5"
									>
										{line}
									</div>
								))}
							</div>
						</div>
					</div>
					<span className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-slate-500 transition group-open:rotate-180 group-open:text-slate-200">
						<ChevronDownIcon className="h-4 w-4" />
						<span className="sr-only">Toggle tool activity details</span>
					</span>
				</summary>

				<div className="ml-4 mt-2 border-l border-white/10 pl-4">
					<ToolEventPanel toolEvents={sortedToolEvents} variant="inline" />
				</div>
			</details>
		</div>
	);
}

export function sortToolEventsByTime(toolEvents: ToolEvent[]): ToolEvent[] {
	return [...toolEvents].sort((a, b) => {
		const aTime =
			a.streamOrder ?? a.startedAt ?? a.timestamp ?? a.completedAt ?? 0;
		const bTime =
			b.streamOrder ?? b.startedAt ?? b.timestamp ?? b.completedAt ?? 0;
		return aTime - bTime;
	});
}

export function buildToolActivityTickerLine(event: ToolEvent): string {
	const normalizedName = normalizeToolName(event.name);
	const filePath = findToolTextArg(event.args, [
		"file_path",
		"path",
		"target_file",
		"targetPath",
		"dir",
		"directory",
	]);
	if (normalizedName === "read_file" && filePath) {
		return `Read ${formatPathLabel(filePath)}`;
	}
	if (normalizedName === "edit_file" && filePath) {
		return `${event.status === "running" ? "Editing" : "Edited"} ${formatPathLabel(filePath)}`;
	}
	if (normalizedName === "write_file" && filePath) {
		return `${event.status === "running" ? "Writing" : "Wrote"} ${formatPathLabel(filePath)}`;
	}
	if (normalizedName === "list_dir" || normalizedName === "ls") {
		return `Exploring ${filePath ? formatPathLabel(filePath) : "files"}`;
	}
	if (
		normalizedName === "internet_search" ||
		normalizedName === "web_search" ||
		normalizedName === "search_web"
	) {
		const query = findToolTextArg(event.args, [
			"query",
			"q",
			"pattern",
			"search",
		]);
		return query ? `Searching web for ${query}` : "Searching the web";
	}
	if (
		normalizedName === "grep_search" ||
		normalizedName === "glob_search" ||
		normalizedName === "file_search" ||
		normalizedName === "glob" ||
		normalizedName === "grep"
	) {
		const query = findToolTextArg(event.args, [
			"query",
			"q",
			"pattern",
			"search",
		]);
		return query ? `Searching files for ${query}` : "Searching files";
	}
	if (
		normalizedName === "command_execute" ||
		normalizedName === "run_command"
	) {
		const command = findToolTextArg(event.args, ["command", "cmd"]);
		return command
			? `${event.status === "running" ? "Running" : "Ran"} ${command}`
			: event.status === "running"
				? "Running command"
				: "Ran command";
	}
	if (normalizedName === "task") {
		const taskTarget = findToolTextArg(event.args, [
			"subagent_type",
			"subagentType",
			"subagent",
			"subAgent",
			"agent",
		]);
		const summary = findToolTextArg(event.args, ["description", "prompt"]);
		if (taskTarget && summary) {
			return `Delegating to ${taskTarget} · ${summary}`;
		}
		if (taskTarget) {
			return `Delegating to ${taskTarget}`;
		}
	}
	const toolName = formatToolDisplayName(event.name);
	const taskTarget = findToolTextArg(event.args, [
		"subagent_type",
		"subagentType",
		"subagent",
		"subAgent",
		"agent",
	]);
	const actorLabel = resolveActorLabel(event);
	const argsSummary = summarizeToolEventValue(event.args, 56);
	const outputSummary = summarizeToolEventValue(event.output, 56);
	const errorSummary =
		typeof event.error === "string" && event.error.trim()
			? event.error.trim()
			: null;
	const primaryLabel = taskTarget ? `${toolName} -> ${taskTarget}` : toolName;
	const secondaryLabel =
		argsSummary || outputSummary || errorSummary || actorLabel || null;
	return secondaryLabel ? `${primaryLabel} · ${secondaryLabel}` : primaryLabel;
}

function resolveActorLabel(event: ToolEvent): string | null {
	if (typeof event.actor === "string" && event.actor.trim()) {
		return event.actor.trim();
	}
	if (typeof event.node === "string" && event.node.trim()) {
		return event.node.trim();
	}
	return null;
}

function formatPathLabel(path: string): string {
	const normalizedPath = path.replaceAll("\\", "/").trim();
	if (!normalizedPath) {
		return "file";
	}
	const segments = normalizedPath.split("/").filter(Boolean);
	const label = segments.slice(-2).join("/");
	return label || normalizedPath;
}
