import React from "react";
import { NavLink } from "react-router-dom";
import { FiEdit2, FiMessageSquare, FiPlus, FiTrash2, FiUser } from "react-icons/fi";
import type { ControlUiAgent, Thread } from "../types";

type SidebarProps = {
	activeAgents: ControlUiAgent[];
	selectedAgentId: string;
	threads: Thread[];
	activeThreadId: string;
	loadingThreads: boolean;
	onSelectAgent: (agentId: string) => void;
	onSelectThread: (threadId: string) => void;
	onCreateThread: (agentId: string, name?: string) => Promise<Thread | null> | void;
	onDeleteThread: (threadId: string) => void;
	onRenameThread: (threadId: string) => void;
	hostLabel: string;
	deviceId: string;
	getAgentLabel: (agentId: string) => string;
};

export const Sidebar: React.FC<SidebarProps> = ({
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
	hostLabel,
	deviceId,
	getAgentLabel,
}) => {
	const navClass = (active: boolean) =>
		`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold transition ${active
			? "border-emerald-500/40 bg-emerald-100/60 text-emerald-700"
			: "border-black/10 bg-white/70 text-slate-600 hover:border-emerald-200/60"
		}`;

	return (
		<nav className="panel-card animate-rise flex h-full flex-col gap-6 p-5">
			<div>
				<p className="text-xs uppercase tracking-[0.3em] text-slate-500">Navigation</p>
				<h2 className="mt-2 text-lg font-semibold">Command Panel</h2>
			</div>

			<div className="space-y-2">
				<NavLink to="/chat" className={({ isActive }) => navClass(isActive)}>
					<span>Chat</span>
				</NavLink>
				<NavLink to="/command" className={({ isActive }) => navClass(isActive)}>
					<span>Command Deck</span>
				</NavLink>
				<NavLink to="/agents" className={({ isActive }) => navClass(isActive)}>
					<span>Agents</span>
				</NavLink>
				<NavLink to="/webhooks" className={({ isActive }) => navClass(isActive)}>
					<span>Webhooks</span>
				</NavLink>
				<NavLink to="/routines" className={({ isActive }) => navClass(isActive)}>
					<span>Routines</span>
				</NavLink>
			</div>

			<div className="space-y-3">
				<p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Threads</p>
				<div className="flex items-center gap-2">
					<div className="flex w-full flex-col gap-1">
						<label className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Agent</label>
						<select
							className="w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700"
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
					<button
						type="button"
						className="button-secondary flex items-center gap-2 px-3 py-2 text-xs"
						onClick={() => onCreateThread(selectedAgentId)}
						title="New thread"
					>
						<FiPlus />
						<span>New</span>
					</button>
				</div>
				<div className="max-h-[45vh] space-y-2 overflow-auto pr-1 lg:max-h-[420px]">
					{loadingThreads ? (
						<div className="rounded-xl border border-dashed border-black/15 bg-white/60 px-3 py-2 text-xs text-slate-500">
							Loading threads...
						</div>
					) : threads.length === 0 ? (
						<div className="rounded-xl border border-dashed border-black/15 bg-white/60 px-3 py-2 text-xs text-slate-500">
							No threads yet.
						</div>
					) : (
						threads.map((thread) => (
							<div
								key={thread.id}
								className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
									thread.id === activeThreadId
										? "border-emerald-500/40 bg-emerald-100/50 text-emerald-700"
										: "border-black/10 bg-white/70 text-slate-600 hover:border-emerald-200/60"
								}`}
							>
								<div className="flex items-start justify-between gap-2">
									<button
										type="button"
										onClick={() => onSelectThread(thread.id)}
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
											className="rounded-full border border-transparent p-2 text-[12px] text-slate-400 transition hover:border-emerald-200/60 hover:text-emerald-600"
											onClick={() => onRenameThread(thread.id)}
											title="Rename"
										>
											<FiEdit2 />
										</button>
										<button
											type="button"
											className="rounded-full border border-transparent p-2 text-[12px] text-slate-400 transition hover:border-rose-200/60 hover:text-rose-500"
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

			<div className="mt-auto space-y-2 text-xs text-slate-500">
				<div className="pill">host: {hostLabel}</div>
				<div className="pill">device: {deviceId || "--"}</div>
			</div>
		</nav>
	);
};
