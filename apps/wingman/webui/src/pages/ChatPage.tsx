import type React from "react";
import { useState } from "react";
import { FiChevronDown } from "react-icons/fi";
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
	const agentLabel = activeAgent?.displayName || agentId;
	const toolSummary = summarizeCompactList(tools, "None configured");
	const mcpSummaryBase = summarizeCompactList(
		mcpServers,
		mcpUsesGlobal ? "Global only" : "None configured",
	);
	const mcpSummary =
		mcpUsesGlobal && mcpServers.length > 0
			? `${mcpSummaryBase} + global`
			: mcpSummaryBase;
	const messageCountLabel = `${messageCount} ${messageCount === 1 ? "msg" : "msgs"}`;

	const handleSaveWorkdir = async (path: string | null) => {
		if (!activeThread) return false;
		const ok = await onSetWorkdir(activeThread.id, path);
		if (ok) {
			setWorkdirOpen(false);
		}
		return ok;
	};

	const sidebarCardClass =
		"rounded-2xl border border-sky-500/20 bg-gradient-to-br from-slate-900/85 via-[#081329]/85 to-slate-950/90 p-3 shadow-[inset_0_1px_0_rgba(148,163,184,0.12),0_14px_28px_rgba(2,12,30,0.35)]";
	const drawerSummaryClass =
		"flex cursor-pointer list-none items-center justify-between gap-2";
	const sidebarLabelClass =
		"text-[10px] uppercase tracking-[0.2em] text-slate-400";
	const sidebarMetaClass =
		"rounded-xl border border-slate-700/70 bg-slate-950/75 px-3 py-2";
	const summaryChipClass =
		"inline-flex max-w-full items-center rounded-full border border-slate-700/70 bg-slate-950/75 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-300";
	const drawerShellClass =
		"panel-card animate-rise shrink-0 overflow-hidden px-4 py-2";

	return (
		<section className="grid h-full min-h-0 min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-hidden">
			<details
				data-testid="chat-side-panel"
				className={`${drawerShellClass} group`}
			>
				<summary className={drawerSummaryClass}>
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<p className="text-sm font-semibold text-slate-100">
								Thread Details
							</p>
							<span className={summaryChipClass}>{messageCountLabel}</span>
							<span className={`${summaryChipClass} max-w-[220px] truncate`}>
								{agentLabel}
							</span>
						</div>
					</div>
					<span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-600/70 bg-slate-900/70 text-slate-300 transition group-open:border-sky-400/40 group-open:bg-sky-500/15 group-open:text-sky-100">
						<FiChevronDown
							aria-hidden="true"
							className="h-4 w-4 transition-transform duration-200 group-open:rotate-180"
						/>
					</span>
				</summary>
				<div className="mt-2 grid max-h-[28vh] gap-3 overflow-y-auto pr-1">
					<div className={sidebarCardClass}>
						<div className="flex items-center justify-between gap-3">
							<div>
								<p className="text-sm font-semibold text-slate-100">
									Working Folder
								</p>
								<p className="mt-1 text-[11px] text-slate-400">
									Where this thread writes files
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
						<div
							className={`${sidebarMetaClass} mt-3 text-[11px] text-slate-300`}
						>
							<span className={sidebarLabelClass}>
								{activeThread?.workdir ? "Current" : "Default"}
							</span>
							<div className="mt-2 break-all font-mono text-slate-200">
								{activeThread?.workdir || defaultOutputDir}
							</div>
						</div>
					</div>

					<div className={`${sidebarCardClass} flex flex-col gap-3`}>
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-sm font-semibold text-slate-100">
									Agent Setup
								</p>
								<p className="mt-1 text-[11px] text-slate-400">
									Only the config that affects this thread
								</p>
							</div>
							<button
								type="button"
								className="rounded-full border border-rose-400/40 bg-rose-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-100 transition hover:border-rose-300/70 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
								onClick={() => activeThread && onDeleteThread(activeThread.id)}
								disabled={!activeThread}
							>
								Delete Thread
							</button>
						</div>
						<dl className="grid gap-2 sm:grid-cols-2">
							<div className={sidebarMetaClass}>
								<dt className={sidebarLabelClass}>Agent</dt>
								<dd className="mt-1 truncate text-[12px] text-slate-200">
									{agentLabel}
								</dd>
							</div>
							<div className={sidebarMetaClass}>
								<dt className={sidebarLabelClass}>Model</dt>
								<dd className="mt-1 break-all font-mono text-[11px] text-slate-200">
									{modelLabel}
								</dd>
							</div>
							{activeAgent?.reasoningEffort ? (
								<div className={sidebarMetaClass}>
									<dt className={sidebarLabelClass}>Reasoning</dt>
									<dd className="mt-1 text-[12px] text-slate-200">
										{activeAgent.reasoningEffort}
									</dd>
								</div>
							) : null}
							<div className={sidebarMetaClass}>
								<dt className={sidebarLabelClass}>Tools</dt>
								<dd className="mt-1 break-words text-[12px] text-slate-200">
									{toolSummary}
								</dd>
							</div>
							<div className={sidebarMetaClass}>
								<dt className={sidebarLabelClass}>MCP</dt>
								<dd className="mt-1 break-words text-[12px] text-slate-200">
									{mcpSummary}
								</dd>
							</div>
						</dl>
					</div>
				</div>
			</details>

			<div className="min-h-0 overflow-hidden">
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

			<WorkdirModal
				open={workdirOpen}
				currentWorkdir={activeThread?.workdir || null}
				defaultWorkdir={resolvedDefaultOutputDir || undefined}
				onClose={() => setWorkdirOpen(false)}
				onSave={handleSaveWorkdir}
			/>
		</section>
	);
};

function summarizeCompactList(items: string[], emptyLabel: string) {
	if (items.length === 0) {
		return emptyLabel;
	}
	if (items.length <= 2) {
		return items.join(", ");
	}
	return `${items[0]}, ${items[1]} +${items.length - 2}`;
}
