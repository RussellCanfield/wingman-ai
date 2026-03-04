import type React from "react";
import { useMemo, useState } from "react";
import { ChatPanel } from "../components/ChatPanel";
import { WorkdirModal } from "../components/WorkdirModal";
import type {
	AgentSummary,
	ChatAttachment,
	SummarizationConfig,
	Thread,
} from "../types";
import type { VoicePlaybackStatus } from "../utils/voicePlayback";

type ChatPageProps = {
	agentId: string;
	activeAgent?: AgentSummary;
	activeThread?: Thread;
	prompt: string;
	attachments: ChatAttachment[];
	fileAccept: string;
	attachmentError?: string;
	isStreaming: boolean;
	isContextSummarizing: boolean;
	queuedPromptCount: number;
	connected: boolean;
	loadingThread: boolean;
	outputRoot?: string;
	voiceAutoEnabled: boolean;
	voicePlayback: { status: VoicePlaybackStatus; messageId?: string };
	dynamicUiEnabled: boolean;
	summarizationConfig?: SummarizationConfig;
	onToggleVoiceAuto: () => void;
	onSpeakVoice: (messageId: string, text: string) => void;
	onStopVoice: () => void;
	onPromptChange: (value: string) => void;
	onSendPrompt: () => void;
	onStopPrompt: () => void;
	onAddAttachments: (files: FileList | File[] | null) => void;
	onRemoveAttachment: (id: string) => void;
	onClearAttachments: () => void;
	onClearChat: () => void;
	onDeleteThread: (threadId: string) => void;
	onOpenCommandDeck: () => void;
	onSetWorkdir: (threadId: string, workdir: string | null) => Promise<boolean>;
};

export const ChatPage: React.FC<ChatPageProps> = ({
	agentId,
	activeAgent,
	activeThread,
	prompt,
	attachments,
	fileAccept,
	attachmentError,
	isStreaming,
	isContextSummarizing,
	queuedPromptCount,
	connected,
	loadingThread,
	outputRoot,
	voiceAutoEnabled,
	voicePlayback,
	dynamicUiEnabled,
	summarizationConfig,
	onToggleVoiceAuto,
	onSpeakVoice,
	onStopVoice,
	onPromptChange,
	onSendPrompt,
	onStopPrompt,
	onAddAttachments,
	onRemoveAttachment,
	onClearAttachments,
	onClearChat,
	onDeleteThread,
	onOpenCommandDeck,
	onSetWorkdir,
}) => {
	const [workdirOpen, setWorkdirOpen] = useState(false);
	const sessionKey = useMemo(() => {
		if (!activeThread) return "--";
		return activeThread.id;
	}, [activeThread]);

	const createdAt = activeThread?.createdAt
		? new Date(activeThread.createdAt).toLocaleString()
		: "--";

	const messageCount =
		activeThread?.messageCount ?? activeThread?.messages.length ?? 0;
	const baseOutputRoot = outputRoot ? outputRoot.replace(/\/+$/, "") : "";
	const resolvedDefaultOutputDir =
		activeThread && baseOutputRoot
			? `${baseOutputRoot}/${activeThread.agentId}`
			: null;
	const defaultOutputDir = resolvedDefaultOutputDir || "--";
	const modelLabel = activeAgent?.model?.trim() || "Default";
	const tools = activeAgent?.tools || [];
	const mcpServers = activeAgent?.mcpServers || [];
	const mcpUsesGlobal = Boolean(activeAgent?.mcpUseGlobal);

	const handleSaveWorkdir = async (path: string | null) => {
		if (!activeThread) return false;
		const ok = await onSetWorkdir(activeThread.id, path);
		if (ok) {
			setWorkdirOpen(false);
		}
		return ok;
	};

	const sidebarCardClass =
		"rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/85 via-[#081329]/85 to-slate-950/90 p-4 shadow-[inset_0_1px_0_rgba(148,163,184,0.12),0_14px_28px_rgba(2,12,30,0.35)]";
	const sidebarSummaryClass =
		"flex cursor-pointer list-none items-start justify-between gap-3";
	const sidebarLabelClass =
		"text-[10px] uppercase tracking-[0.2em] text-slate-400";
	const sidebarTagClass =
		"rounded-full border border-sky-500/30 bg-slate-950/75 px-3 py-1 font-mono text-[11px] text-slate-200";
	const sidebarValueClass =
		"rounded-xl border border-slate-700/70 bg-slate-950/75 px-3 py-2 font-mono text-[11px] text-slate-200";
	const sidebarEmptyStateClass =
		"mt-2 rounded-xl border border-slate-700/70 bg-slate-950/75 px-3 py-2 text-[11px] text-slate-400";

	return (
		<section className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
			<div className="min-h-0 flex-1">
				<ChatPanel
					activeThread={activeThread}
					defaultOutputDir={resolvedDefaultOutputDir}
					prompt={prompt}
					attachments={attachments}
					fileAccept={fileAccept}
					attachmentError={attachmentError}
					isStreaming={isStreaming}
					isContextSummarizing={isContextSummarizing}
					queuedPromptCount={queuedPromptCount}
					connected={connected}
					loading={loadingThread}
					voiceAutoEnabled={voiceAutoEnabled}
					voicePlayback={voicePlayback}
					dynamicUiEnabled={dynamicUiEnabled}
					summarizationConfig={summarizationConfig}
					onToggleVoiceAuto={onToggleVoiceAuto}
					onSpeakVoice={onSpeakVoice}
					onStopVoice={onStopVoice}
					onPromptChange={onPromptChange}
					onSendPrompt={onSendPrompt}
					onStopPrompt={onStopPrompt}
					onAddAttachments={onAddAttachments}
					onRemoveAttachment={onRemoveAttachment}
					onClearAttachments={onClearAttachments}
					onClearChat={onClearChat}
					onOpenCommandDeck={onOpenCommandDeck}
				/>
			</div>

			<aside className="panel-card animate-rise order-last flex flex-col gap-4 overflow-hidden border border-sky-500/20 bg-gradient-to-b from-[#071127]/95 via-[#050f24]/95 to-[#030919]/95 p-4 lg:order-none lg:min-h-0 lg:w-[320px] lg:overflow-y-auto">
				<div className={sidebarCardClass}>
					<div className="flex items-center justify-between gap-3">
						<div>
							<p className="text-sm font-semibold text-slate-100">
								Working Folder
							</p>
							<p className="mt-1 text-[11px] text-slate-400">
								Output path for this thread
							</p>
						</div>
						<button
							type="button"
							className="button-secondary px-3 py-1 text-xs"
							onClick={() => setWorkdirOpen(true)}
							disabled={!activeThread}
						>
							{activeThread?.workdir ? "Change" : "Set"}
						</button>
					</div>
					<div className="mt-3 rounded-xl border border-slate-700/70 bg-slate-950/75 px-3 py-3 text-[11px] text-slate-300">
						{activeThread?.workdir ? (
							<div className="break-all font-mono text-slate-200">
								{activeThread.workdir}
							</div>
						) : (
							<div>
								<span className={sidebarLabelClass}>Default</span>
								<div className="mt-2 break-all font-mono text-slate-200">
									{defaultOutputDir}
								</div>
							</div>
						)}
					</div>
				</div>

				<details className={`${sidebarCardClass} group`} open>
					<summary className={sidebarSummaryClass}>
						<div>
							<p className="text-sm font-semibold text-slate-100">
								Agent Details
							</p>
							<p className="mt-1 text-[11px] text-slate-400">
								Model, tools, and MCP routing
							</p>
						</div>
						<span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-slate-600/70 bg-slate-900/70 text-xs font-semibold text-slate-300 transition group-open:border-sky-400/40 group-open:bg-sky-500/15 group-open:text-sky-100">
							<span className="group-open:hidden">+</span>
							<span className="hidden group-open:inline">-</span>
						</span>
					</summary>
					<div className="mt-4 space-y-3 text-xs text-slate-300">
						<div className="flex items-center justify-between gap-3">
							<span className={sidebarLabelClass}>Agent</span>
							<span className={sidebarTagClass}>
								{activeAgent?.displayName || agentId}
							</span>
						</div>
						<div className="space-y-2">
							<span className={sidebarLabelClass}>Model</span>
							<div className={`${sidebarValueClass} break-all`}>
								{modelLabel}
							</div>
						</div>
						{activeAgent?.reasoningEffort ? (
							<div className="flex items-center justify-between gap-3">
								<span className={sidebarLabelClass}>Reasoning</span>
								<span className={sidebarTagClass}>
									{activeAgent.reasoningEffort}
								</span>
							</div>
						) : null}
						<div>
							<span className={sidebarLabelClass}>Tools</span>
							{tools.length > 0 ? (
								<div className="mt-2 flex flex-wrap gap-2">
									{tools.map((tool) => (
										<span key={tool} className={sidebarTagClass}>
											{tool}
										</span>
									))}
								</div>
							) : (
								<div className={sidebarEmptyStateClass}>
									No custom tools configured.
								</div>
							)}
						</div>
						<div>
							<div className="flex items-center justify-between gap-2">
								<span className={sidebarLabelClass}>MCP Servers</span>
								{mcpUsesGlobal ? (
									<span className={sidebarTagClass}>Global enabled</span>
								) : null}
							</div>
							{mcpServers.length > 0 ? (
								<div className="mt-2 flex flex-wrap gap-2">
									{mcpServers.map((server) => (
										<span key={server} className={sidebarTagClass}>
											{server}
										</span>
									))}
								</div>
							) : (
								<div className={sidebarEmptyStateClass}>
									No MCP servers configured.
								</div>
							)}
						</div>
					</div>
				</details>

				<details className={`${sidebarCardClass} group`} open>
					<summary className={sidebarSummaryClass}>
						<div>
							<p className="text-sm font-semibold text-slate-100">
								Session Snapshot
							</p>
							<p className="mt-1 text-[11px] text-slate-400">
								Thread metadata and diagnostics
							</p>
						</div>
						<span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-slate-600/70 bg-slate-900/70 text-xs font-semibold text-slate-300 transition group-open:border-sky-400/40 group-open:bg-sky-500/15 group-open:text-sky-100">
							<span className="group-open:hidden">+</span>
							<span className="hidden group-open:inline">-</span>
						</span>
					</summary>
					<div className="mt-4 space-y-3 text-xs text-slate-300">
						<div className="grid grid-cols-2 gap-2">
							<div className="rounded-xl border border-slate-700/70 bg-slate-950/75 px-3 py-2">
								<span className={sidebarLabelClass}>Agent</span>
								<div className="mt-1 truncate font-mono text-[11px] text-slate-200">
									{agentId}
								</div>
							</div>
							<div className="rounded-xl border border-slate-700/70 bg-slate-950/75 px-3 py-2">
								<span className={sidebarLabelClass}>Messages</span>
								<div className="mt-1 font-mono text-[11px] text-slate-200">
									{messageCount}
								</div>
							</div>
						</div>
						<div className="rounded-xl border border-slate-700/70 bg-slate-950/75 px-3 py-2">
							<span className={sidebarLabelClass}>Thread</span>
							<div className="mt-1 break-all font-mono text-[11px] text-slate-200">
								{activeThread?.name || "--"}
							</div>
						</div>
						<div className="rounded-xl border border-slate-700/70 bg-slate-950/75 px-3 py-2">
							<span className={sidebarLabelClass}>Created</span>
							<div className="mt-1 text-[11px] text-slate-200">{createdAt}</div>
						</div>
						<div>
							<span className={sidebarLabelClass}>Session Key</span>
							<div className="mt-2 break-all rounded-xl border border-slate-700/70 bg-slate-950/75 px-3 py-2 font-mono text-[11px] text-slate-300">
								{sessionKey}
							</div>
						</div>
					</div>
				</details>

				<details className={`${sidebarCardClass} group`}>
					<summary className={sidebarSummaryClass}>
						<div>
							<p className="text-sm font-semibold text-slate-100">Guidance</p>
							<p className="mt-1 text-[11px] text-slate-400">
								Recommended workflow habits
							</p>
						</div>
						<span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-slate-600/70 bg-slate-900/70 text-xs font-semibold text-slate-300 transition group-open:border-sky-400/40 group-open:bg-sky-500/15 group-open:text-sky-100">
							<span className="group-open:hidden">+</span>
							<span className="hidden group-open:inline">-</span>
						</span>
					</summary>
					<ul className="mt-4 space-y-2 text-xs text-slate-300">
						<li className="rounded-xl border border-slate-700/70 bg-slate-950/75 px-3 py-2">
							Use the command deck to refresh stats or rotate credentials.
						</li>
						<li className="rounded-xl border border-slate-700/70 bg-slate-950/75 px-3 py-2">
							Create separate threads for each mission to keep context clean.
						</li>
						<li className="rounded-xl border border-slate-700/70 bg-slate-950/75 px-3 py-2">
							Shift + Enter inserts a new line in prompts.
						</li>
					</ul>
				</details>

				<button
					type="button"
					className="mt-1 rounded-full border border-rose-400/45 bg-gradient-to-r from-rose-500/20 to-rose-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-rose-100 transition hover:border-rose-300/70 hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-60"
					onClick={() => activeThread && onDeleteThread(activeThread.id)}
					disabled={!activeThread}
				>
					Delete Thread
				</button>
			</aside>

			<WorkdirModal
				open={workdirOpen}
				currentWorkdir={activeThread?.workdir || null}
				outputRoot={baseOutputRoot || undefined}
				onClose={() => setWorkdirOpen(false)}
				onSave={handleSaveWorkdir}
			/>
		</section>
	);
};
