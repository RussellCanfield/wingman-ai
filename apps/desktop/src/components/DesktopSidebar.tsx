import type React from "react";
import { NavLink } from "react-router-dom";
import type { AgentSummary, SessionThread } from "../lib/gatewayModels.js";
import {
	ChevronDownIcon,
	type IconProps,
	PlusIcon,
	RefreshIcon,
	SettingsIcon,
	WingmanMark,
} from "./DesktopIcons.js";

type RouteUtilityItem = {
	type: "route";
	path: string;
	label: string;
	icon: (props: IconProps) => React.JSX.Element;
};

type LinkUtilityItem = {
	type: "link";
	href: string;
	label: string;
	icon: (props: IconProps) => React.JSX.Element;
};

export type DesktopUtilityItem = RouteUtilityItem | LinkUtilityItem;

type DesktopSidebarProps = {
	agents: Pick<AgentSummary, "id" | "displayName">[];
	selectedAgentId: string;
	threads: SessionThread[];
	selectedThreadId?: string | null;
	sessionsLoading: boolean;
	utilityItems: DesktopUtilityItem[];
	onSelectAgent: (agentId: string) => void;
	onSelectThread: (threadId: string) => void;
	onCreateThread: () => void | Promise<unknown>;
	onRefreshThreads: () => void | Promise<unknown>;
	onNavigate?: () => void;
	statusBadge?: React.ReactNode;
};

const sectionLabelClass =
	"text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400";

export function DesktopSidebar({
	agents,
	selectedAgentId,
	threads,
	selectedThreadId,
	sessionsLoading,
	utilityItems,
	onSelectAgent,
	onSelectThread,
	onCreateThread,
	onRefreshThreads,
	onNavigate,
	statusBadge,
}: DesktopSidebarProps): React.JSX.Element {
	const agentSelectId = "desktop-sidebar-agent-select";

	return (
		<section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/78 shadow-[0_24px_80px_rgba(2,12,27,0.52)] backdrop-blur-2xl">
			<div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
				<WingmanMark />
				<div className="min-w-0">
					<div className="truncate text-base font-semibold text-slate-50">
						Wingman
					</div>
					<div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
						Desktop
					</div>
				</div>
			</div>

			<div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
				<div className="shrink-0 space-y-3">
					<div className="flex items-center justify-end gap-2">
						<button
							type="button"
							className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-[0_16px_32px_rgba(37,99,235,0.26)] transition duration-150 ease-out hover:-translate-y-px hover:from-cyan-300 hover:to-blue-400 hover:shadow-[0_20px_36px_rgba(56,189,248,0.32)] active:translate-y-0 active:scale-[0.99]"
							onClick={() => {
								void onCreateThread();
								onNavigate?.();
							}}
							title="New session"
						>
							<PlusIcon className="h-3.5 w-3.5 shrink-0" />
							<span>New</span>
						</button>
					</div>

					<div className="flex flex-col gap-1">
						<label htmlFor={agentSelectId} className={sectionLabelClass}>
							Agent
						</label>
						<div className="relative">
							<select
								id={agentSelectId}
								className="h-11 w-full appearance-none rounded-2xl border border-white/12 bg-slate-950/65 px-3 pr-10 text-sm text-slate-100 outline-none ring-sky-300/30 transition hover:border-sky-400/35 focus:border-sky-400/45 focus:ring"
								value={selectedAgentId}
								onChange={(event) => onSelectAgent(event.target.value)}
							>
								{agents.map((agent) => (
									<option key={agent.id} value={agent.id}>
										{agent.displayName}
									</option>
								))}
							</select>
							<div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
								<ChevronDownIcon />
							</div>
						</div>
					</div>
				</div>

				<div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
					<div className="flex items-center justify-between gap-3">
						<div>
							<p className={sectionLabelClass}>Conversations</p>
							<p className="mt-1 text-[11px] text-slate-400">
								{threads.length} total
							</p>
						</div>
						<button
							type="button"
							className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/12 bg-slate-950/55 text-slate-300 transition duration-150 ease-out hover:-translate-y-px hover:border-sky-400/40 hover:bg-slate-800/90 hover:text-sky-100 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
							onClick={() => void onRefreshThreads()}
							disabled={sessionsLoading}
							aria-label={sessionsLoading ? "Refreshing sessions" : "Refresh sessions"}
							title={sessionsLoading ? "Refreshing sessions" : "Refresh sessions"}
						>
							<RefreshIcon className="h-3.5 w-3.5" />
						</button>
					</div>

					<div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
						{sessionsLoading ? (
							<div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/55 px-3 py-3 text-xs text-slate-400">
								Loading sessions...
							</div>
						) : threads.length === 0 ? (
							<div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/55 px-3 py-3 text-xs text-slate-400">
								No sessions yet.
							</div>
						) : (
							threads.map((thread) => (
								<button
									key={thread.id}
									type="button"
									onClick={() => {
										onSelectThread(thread.id);
										onNavigate?.();
									}}
									className={`w-full rounded-2xl border px-3 py-2.5 text-left text-xs transition duration-150 ease-out ${
										thread.id === selectedThreadId
											? "border-sky-400/55 bg-sky-500/12 shadow-[0_16px_30px_rgba(2,132,199,0.12)]"
											: "border-white/10 bg-slate-950/55 hover:border-sky-400/35 hover:bg-slate-900/85"
									}`}
								>
									<div className="truncate font-semibold text-slate-100">
										{thread.name}
									</div>
									<div className="mt-1 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.15em] text-slate-400">
										<span className="truncate">{thread.agentId}</span>
										<span>{thread.messageCount ?? thread.messages.length}</span>
									</div>
								</button>
							))
						)}
					</div>
				</div>

				<div className="mt-4 shrink-0 space-y-3 border-t border-white/10 pt-4">
					<div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
						<SettingsIcon className="h-3.5 w-3.5" />
						<span>Workspace</span>
					</div>
					<nav className="space-y-2">
						{utilityItems.map((item) => {
							const Icon = item.icon;
							if (item.type === "route") {
								return (
									<NavLink
										key={item.path}
										to={item.path}
										onClick={onNavigate}
										className={({ isActive }) =>
											`flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2 text-sm transition duration-150 ease-out ${
												isActive
													? "border-sky-400/55 bg-sky-500/12 text-sky-100"
													: "border-white/10 bg-slate-950/55 text-slate-200 hover:-translate-y-px hover:border-sky-400/35 hover:bg-slate-900/85 hover:text-sky-100"
											}`
										}
									>
										<Icon className="h-4 w-4 shrink-0" />
										<span>{item.label}</span>
									</NavLink>
								);
							}

							return (
								<a
									key={item.href}
									href={item.href}
									target="_blank"
									rel="noreferrer"
									className="flex w-full items-center gap-2.5 rounded-2xl border border-white/10 bg-slate-950/55 px-3 py-2 text-sm text-slate-200 transition duration-150 ease-out hover:-translate-y-px hover:border-sky-400/35 hover:bg-slate-900/85 hover:text-sky-100"
								>
									<Icon className="h-4 w-4 shrink-0" />
									<span>{item.label}</span>
								</a>
							);
						})}
					</nav>
					{statusBadge ? <div className="pt-1">{statusBadge}</div> : null}
				</div>
			</div>
		</section>
	);
}
