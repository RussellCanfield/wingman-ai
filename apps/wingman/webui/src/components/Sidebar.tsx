import type React from "react";
import {
	FiBookOpen,
	FiEdit2,
	FiLink2,
	FiMessageSquare,
	FiPlus,
	FiRefreshCw,
	FiSettings,
	FiTrash2,
	FiUser,
} from "react-icons/fi";
import { NavLink } from "react-router-dom";
import wingmanIcon from "../assets/wingman_icon.webp";
import type { ControlUiAgent, Thread } from "../types";

type SidebarProps = {
	variant?: "default" | "mobile-drawer";
	activeAgents: ControlUiAgent[];
	selectedAgentId: string;
	threads: Thread[];
	activeThreadId: string;
	loadingThreads: boolean;
	onSelectAgent: (agentId: string) => void;
	onSelectThread: (threadId: string) => void;
	onCreateThread: (
		agentId: string,
		name?: string,
	) => Promise<Thread | null> | undefined;
	onDeleteThread: (threadId: string) => void;
	onRenameThread: (threadId: string) => void;
	onNavigate?: () => void;
	getAgentLabel: (agentId: string) => string;
};

export const Sidebar: React.FC<SidebarProps> = ({
	variant = "default",
	activeAgents,
	selectedAgentId,
	threads,
	activeThreadId,
	loadingThreads,
	onSelectAgent,
	onSelectThread,
	onCreateThread,
	onDeleteThread,
	onRenameThread,
	onNavigate,
	getAgentLabel,
}) => {
	const agentSelectId =
		variant === "mobile-drawer"
			? "sidebar-agent-select-mobile"
			: "sidebar-agent-select";
	const threadCardClass = (active: boolean) =>
		`rounded-xl border px-3 py-2 text-xs font-semibold transition ${active
			? "border-sky-500/50 bg-sky-500/15 text-sky-300"
			: "border-white/10 bg-slate-950/50 text-slate-300 hover:border-sky-400/50"
		}`;
	const footerLinkClass = (active: boolean) =>
		`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${active
			? "border-sky-500/50 bg-sky-500/15 text-sky-300"
			: "border-white/10 bg-slate-950/40 text-slate-300 hover:border-sky-400/50"
		}`;
	const sectionLabelClass =
		"text-[10px] uppercase tracking-[0.22em] text-slate-400";

	const handleCreateConversation = async () => {
		const thread = await onCreateThread(selectedAgentId);
		if (thread) {
			onNavigate?.();
		}
	};

	const handleSelectConversation = (threadId: string) => {
		onSelectThread(threadId);
		onNavigate?.();
	};

	const content = (
		<>
			<div className="shrink-0 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
				<div className="flex items-center gap-3">
					<img
						src={wingmanIcon}
						alt="Wingman"
						className="h-11 w-11 rounded-xl border border-white/10 bg-slate-950/70 p-1.5"
					/>
					<h2 className="text-lg font-semibold text-slate-100">Wingman</h2>
				</div>
			</div>

			<div className="shrink-0 space-y-3">
				<div className="flex items-center justify-end gap-3">
					<button
						type="button"
						className="button-secondary flex items-center gap-2 px-3 py-2 text-xs"
						onClick={() => void handleCreateConversation()}
						title="New conversation"
					>
						<FiPlus />
						<span>New</span>
					</button>
				</div>
				<div className="flex flex-col gap-1">
					<label htmlFor={agentSelectId} className={sectionLabelClass}>
						Agent
					</label>
					<select
						id={agentSelectId}
						className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-200"
						value={selectedAgentId}
						onChange={(event) => onSelectAgent(event.target.value)}
					>
						{activeAgents.map((agent) => (
							<option key={agent.id} value={agent.id}>
								{agent.name || agent.id}
							</option>
						))}
					</select>
				</div>
			</div>

			<div className="min-h-0 flex flex-1 flex-col gap-3 overflow-hidden">
				<div className="flex items-center justify-between gap-3">
					<p className={sectionLabelClass}>Conversations</p>
					<span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
						{loadingThreads ? "--" : threads.length}
					</span>
				</div>
				<div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
					{loadingThreads ? (
						<div className="rounded-xl border border-dashed border-white/15 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
							Loading conversations...
						</div>
					) : threads.length === 0 ? (
						<div className="rounded-xl border border-dashed border-white/15 bg-slate-950/40 px-3 py-2 text-xs text-slate-400">
							No conversations yet.
						</div>
					) : (
						threads.map((thread) => (
							<div
								key={thread.id}
								className={threadCardClass(thread.id === activeThreadId)}
							>
								<div className="flex items-start justify-between gap-2">
									<button
										type="button"
										onClick={() => handleSelectConversation(thread.id)}
										className="min-w-0 flex-1 text-left"
									>
										<div className="truncate">{thread.name}</div>
										<div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">
											<span className="pill flex items-center gap-1 px-2 py-0.5 text-[9px]">
												<FiUser className="text-[11px]" />
												{getAgentLabel(thread.agentId)}
											</span>
											<span className="flex items-center gap-1">
												<FiMessageSquare className="text-[11px]" />
												{thread.messageCount ?? thread.messages.length}
											</span>
										</div>
									</button>
									<div className="flex items-center gap-1">
										<button
											type="button"
											className="rounded-full border border-transparent p-2 text-[12px] text-slate-400 transition hover:border-sky-400/50 hover:text-sky-300"
											onClick={() => onRenameThread(thread.id)}
											title="Rename"
										>
											<FiEdit2 />
										</button>
										<button
											type="button"
											className="rounded-full border border-transparent p-2 text-[12px] text-slate-400 transition hover:border-rose-400/40 hover:text-rose-500"
											onClick={() => onDeleteThread(thread.id)}
											title="Delete"
										>
											<FiTrash2 />
										</button>
									</div>
								</div>
							</div>
						))
					)}
				</div>
			</div>

			<div className="shrink-0 space-y-3 border-t border-white/10 pt-4">
				<div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-400">
					<FiSettings className="h-3.5 w-3.5" />
					<span>Workspace</span>
				</div>
				<div className="space-y-2">
					<NavLink
						to="/settings"
						end
						className={({ isActive }) => footerLinkClass(isActive)}
						onClick={onNavigate}
					>
						<FiSettings className="h-4 w-4" />
						<span>Settings</span>
					</NavLink>
					<NavLink
						to="/webhooks"
						className={({ isActive }) => footerLinkClass(isActive)}
						onClick={onNavigate}
					>
						<FiLink2 className="h-4 w-4" />
						<span>Webhooks</span>
					</NavLink>
					<NavLink
						to="/routines"
						className={({ isActive }) => footerLinkClass(isActive)}
						onClick={onNavigate}
					>
						<FiRefreshCw className="h-4 w-4" />
						<span>Routines</span>
					</NavLink>
					<a
						href="https://docs.getwingmanai.com"
						target="_blank"
						rel="noreferrer"
						className={footerLinkClass(false)}
						onClick={onNavigate}
					>
						<FiBookOpen className="h-4 w-4" />
						<span>Docs</span>
					</a>
				</div>
			</div>
		</>
	);

	if (variant === "mobile-drawer") {
		return (
			<nav className="flex h-full min-h-0 min-w-0 flex-col gap-5">
				{content}
			</nav>
		);
	}

	return (
		<nav className="panel-card animate-rise flex h-full min-h-0 min-w-0 flex-col gap-5 overflow-hidden p-5">
			{content}
		</nav>
	);
};
