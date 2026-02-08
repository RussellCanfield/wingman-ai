import React, { useMemo, useState } from "react";
import type { ChatAttachment, Thread } from "../types";
import { ChatPanel } from "../components/ChatPanel";
import { WorkdirModal } from "../components/WorkdirModal";
import type { VoicePlaybackStatus } from "../utils/voicePlayback";

type ChatPageProps = {
	agentId: string;
	activeThread?: Thread;
	prompt: string;
	attachments: ChatAttachment[];
	fileAccept: string;
	attachmentError?: string;
	isStreaming: boolean;
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
	activeThread,
	prompt,
	attachments,
	fileAccept,
	attachmentError,
	isStreaming,
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

	const messageCount = activeThread?.messageCount ?? activeThread?.messages.length ?? 0;
	const baseOutputRoot = outputRoot ? outputRoot.replace(/\/+$/, "") : "";
	const defaultOutputDir =
		activeThread && baseOutputRoot ? `${baseOutputRoot}/${activeThread.agentId}` : baseOutputRoot || "--";

	const handleSaveWorkdir = async (path: string | null) => {
		if (!activeThread) return false;
		const ok = await onSetWorkdir(activeThread.id, path);
		if (ok) {
			setWorkdirOpen(false);
		}
		return ok;
	};

	return (
		<section className="grid gap-6 lg:grid-cols-[1fr_280px]">
			<ChatPanel
				activeThread={activeThread}
					prompt={prompt}
					attachments={attachments}
					fileAccept={fileAccept}
					attachmentError={attachmentError}
				isStreaming={isStreaming}
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
				onAddAttachments={onAddAttachments}
				onRemoveAttachment={onRemoveAttachment}
				onClearAttachments={onClearAttachments}
				onClearChat={onClearChat}
				onOpenCommandDeck={onOpenCommandDeck}
			/>

			<aside className="panel-card animate-rise space-y-4 p-5 lg:order-none order-last">
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
								<span className="uppercase tracking-[0.2em] text-slate-400">Default</span>
								<div className="mt-2 break-all font-mono">{defaultOutputDir}</div>
							</div>
						)}
					</div>
				</div>

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
							<span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Session Key</span>
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
