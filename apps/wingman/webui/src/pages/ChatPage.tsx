import type React from "react";
import { useMemo, useState } from "react";
import { ChatPanel } from "../components/ChatPanel";
import { WorkdirModal } from "../components/WorkdirModal";
import type { AgentSummary, ChatAttachment, Thread } from "../types";
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
	queuedPromptCount: number;
	connected: boolean;
	loadingThread: boolean;
	outputRoot?: string;
	voiceAutoEnabled: boolean;
	voicePlayback: { status: VoicePlaybackStatus; messageId?: string };
	dynamicUiEnabled: boolean;
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
	queuedPromptCount,
	connected,
	loadingThread,
	outputRoot,
	voiceAutoEnabled,
	voicePlayback,
	dynamicUiEnabled,
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
					queuedPromptCount={queuedPromptCount}
					connected={connected}
					loading={loadingThread}
					voiceAutoEnabled={voiceAutoEnabled}
					voicePlayback={voicePlayback}
					dynamicUiEnabled={dynamicUiEnabled}
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

			<aside className="panel-card animate-rise order-last space-y-4 p-5 lg:order-none lg:min-h-0 lg:w-[280px] lg:overflow-y-auto">
				<div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/50 px-4 py-3">
					<div className="flex items-center justify-between text-sm font-semibold text-slate-200">
						<span>Working Folder</span>
						<button
							type="button"
							className="button-secondary px-3 py-1 text-xs"
							onClick={() => setWorkdirOpen(true)}
							disabled={!activeThread}
						>
							{activeThread?.workdir ? "Change" : "Set"}
						</button>
					</div>
					<div className="mt-3 text-xs text-slate-300">
						{activeThread?.workdir ? (
							<div className="break-all font-mono">{activeThread.workdir}</div>
						) : (
							<div>
								<span className="uppercase tracking-[0.2em] text-slate-400">
									Default
								</span>
								<div className="mt-2 break-all font-mono">
									{defaultOutputDir}
								</div>
							</div>
						)}
					</div>
				</div>

				<details className="group rounded-2xl border border-dashed border-white/10 bg-slate-950/50 px-4 py-3">
					<summary className="cursor-pointer list-none text-sm font-semibold text-slate-200">
						Agent Details
					</summary>
					<div className="mt-4 space-y-3 text-xs text-slate-300">
						<div className="flex items-center justify-between">
							<span>Agent</span>
							<span className="pill">
								{activeAgent?.displayName || agentId}
							</span>
						</div>
						<div className="flex items-center justify-between gap-2">
							<span>Model</span>
							<span className="pill break-all">{modelLabel}</span>
						</div>
						{activeAgent?.reasoningEffort ? (
							<div className="flex items-center justify-between">
								<span>Reasoning</span>
								<span className="pill">{activeAgent.reasoningEffort}</span>
							</div>
						) : null}
						<div>
							<span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
								Tools
							</span>
							{tools.length > 0 ? (
								<div className="mt-2 flex flex-wrap gap-2">
									{tools.map((tool) => (
										<span key={tool} className="pill">
											{tool}
										</span>
									))}
								</div>
							) : (
								<div className="mt-2 rounded-xl border border-dashed border-white/15 bg-slate-950/50 px-3 py-2 text-[11px] text-slate-400">
									No custom tools configured.
								</div>
							)}
						</div>
						<div>
							<div className="flex items-center justify-between gap-2">
								<span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
									MCP Servers
								</span>
								{mcpUsesGlobal ? (
									<span className="pill">Global enabled</span>
								) : null}
							</div>
							{mcpServers.length > 0 ? (
								<div className="mt-2 flex flex-wrap gap-2">
									{mcpServers.map((server) => (
										<span key={server} className="pill">
											{server}
										</span>
									))}
								</div>
							) : (
								<div className="mt-2 rounded-xl border border-dashed border-white/15 bg-slate-950/50 px-3 py-2 text-[11px] text-slate-400">
									No MCP servers configured.
								</div>
							)}
						</div>
					</div>
				</details>

				<details className="group rounded-2xl border border-dashed border-white/10 bg-slate-950/50 px-4 py-3">
					<summary className="cursor-pointer list-none text-sm font-semibold text-slate-200">
						Session Snapshot
					</summary>
					<div className="mt-4 space-y-3 text-xs text-slate-300">
						<div className="flex items-center justify-between">
							<span>Agent</span>
							<span className="pill">{agentId}</span>
						</div>
						<div className="flex items-center justify-between">
							<span>Thread</span>
							<span className="pill">{activeThread?.name || "--"}</span>
						</div>
						<div className="flex items-center justify-between">
							<span>Messages</span>
							<span className="pill">{messageCount}</span>
						</div>
						<div className="flex items-center justify-between">
							<span>Created</span>
							<span className="pill">{createdAt}</span>
						</div>
						<div>
							<span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
								Session Key
							</span>
							<div className="mt-2 break-all rounded-xl border border-dashed border-white/15 bg-slate-950/50 px-3 py-2 font-mono text-[11px] text-slate-400">
								{sessionKey}
							</div>
						</div>
					</div>
				</details>

				<details className="group rounded-2xl border border-dashed border-white/10 bg-slate-950/50 px-4 py-3">
					<summary className="cursor-pointer list-none text-sm font-semibold text-slate-200">
						Guidance
					</summary>
					<ul className="mt-4 space-y-2 text-xs text-slate-300">
						<li className="rounded-xl border border-dashed border-white/15 bg-slate-950/50 px-3 py-2">
							Use the command deck to refresh stats or rotate credentials.
						</li>
						<li className="rounded-xl border border-dashed border-white/15 bg-slate-950/50 px-3 py-2">
							Create separate threads for each mission to keep context clean.
						</li>
						<li className="rounded-xl border border-dashed border-white/15 bg-slate-950/50 px-3 py-2">
							Shift + Enter inserts a new line in prompts.
						</li>
					</ul>
				</details>

				<button
					type="button"
					className="rounded-full border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-rose-200 transition hover:border-rose-400/60"
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
