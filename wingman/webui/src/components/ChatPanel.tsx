import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatAttachment, Thread } from "../types";
import { ThinkingPanel } from "./ThinkingPanel";
import { extractImageFiles } from "../utils/attachments";

type ChatPanelProps = {
	activeThread?: Thread;
	prompt: string;
	attachments: ChatAttachment[];
	attachmentError?: string;
	isStreaming: boolean;
	connected: boolean;
	loading: boolean;
	onPromptChange: (value: string) => void;
	onSendPrompt: () => void;
	onAddAttachments: (files: FileList | File[] | null) => void;
	onRemoveAttachment: (id: string) => void;
	onClearAttachments: () => void;
	onClearChat: () => void;
	onOpenCommandDeck: () => void;
};

const QUICK_PROMPTS = [
	"Summarize the latest updates in this thread.",
	"Draft a plan of attack for the next task.",
	"List open questions we need to resolve.",
];

export const ChatPanel: React.FC<ChatPanelProps> = ({
	activeThread,
	prompt,
	attachments,
	attachmentError,
	isStreaming,
	connected,
	loading,
	onPromptChange,
	onSendPrompt,
	onAddAttachments,
	onRemoveAttachment,
	onClearAttachments,
	onClearChat,
	onOpenCommandDeck,
}) => {
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const autoScrollRef = useRef<boolean>(true);
	const [previewAttachment, setPreviewAttachment] = useState<ChatAttachment | null>(null);
	const canSend = connected && !isStreaming && (prompt.trim() || attachments.length > 0);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		if (autoScrollRef.current) {
			el.scrollTop = el.scrollHeight;
		}
	}, [activeThread?.messages, isStreaming]);

	useEffect(() => {
		autoScrollRef.current = true;
	}, [activeThread?.id]);

	useEffect(() => {
		if (!previewAttachment) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setPreviewAttachment(null);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [previewAttachment]);

	const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			onSendPrompt();
		}
	};

	const handlePickFiles = () => {
		fileInputRef.current?.click();
	};

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		onAddAttachments(event.target.files);
		if (event.target) {
			event.target.value = "";
		}
	};

	const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
		if (isStreaming) return;
		const items = event.clipboardData?.items;
		const imageFiles = extractImageFiles(items);
		if (imageFiles.length === 0) return;
		event.preventDefault();
		onAddAttachments(imageFiles);
		const text = event.clipboardData?.getData("text/plain");
		if (text) {
			onPromptChange(`${prompt}${text}`);
		}
	};

	const handleScroll = () => {
		const el = scrollRef.current;
		if (!el) return;
		const threshold = 40;
		const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		autoScrollRef.current = distanceFromBottom <= threshold;
	};

	const lastAssistantId = useMemo(() => {
		if (!activeThread) return undefined;
		for (let i = activeThread.messages.length - 1; i >= 0; i -= 1) {
			const msg = activeThread.messages[i];
			if (msg.role === "assistant") {
				return msg.id;
			}
		}
		return undefined;
	}, [activeThread]);
	const legacyToolEvents = activeThread?.toolEvents || [];
	const legacyThinkingEvents = activeThread?.thinkingEvents || [];

	return (
		<section className="panel-card animate-rise flex h-[calc(100vh-120px)] min-h-[1200px] flex-col gap-4 p-4 sm:gap-6 sm:p-6">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h2 className="text-lg font-semibold">Mission Stream</h2>
					<p className="mt-1 text-sm text-slate-400">
						Thread: <span className="font-semibold text-slate-200">{activeThread?.name || "--"}</span>
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<button className="button-secondary" onClick={onClearChat} type="button">
						Clear
					</button>
				</div>
			</header>

			<div
				ref={scrollRef}
				onScroll={handleScroll}
				className="flex-1 min-h-0 space-y-4 overflow-auto rounded-2xl border border-white/10 bg-gradient-to-b from-slate-950/80 to-slate-900/80 p-3 sm:p-4"
			>
				{loading ? (
					<div className="grid h-full place-items-center text-sm text-slate-400">
						Loading messages...
					</div>
				) : !activeThread || activeThread.messages.length === 0 ? (
					<div className="grid h-full place-items-center text-sm text-slate-400">
						<div className="max-w-sm text-center">
							<p className="text-base font-semibold text-slate-200">Launch a new mission.</p>
							<p className="mt-2 text-sm text-slate-400">
								Send a prompt to begin, or pick a quick prompt below to shape the session.
							</p>
						</div>
					</div>
				) : (
					<>
						{activeThread.messages.map((msg) => {
							const hasLegacyEvents =
								msg.id === lastAssistantId &&
								(legacyToolEvents.length > 0 || legacyThinkingEvents.length > 0);
							const toolEvents =
								msg.toolEvents && msg.toolEvents.length > 0
									? msg.toolEvents
									: hasLegacyEvents
										? legacyToolEvents
										: [];
							const thinkingEvents =
								msg.thinkingEvents && msg.thinkingEvents.length > 0
									? msg.thinkingEvents
									: hasLegacyEvents
										? legacyThinkingEvents
										: [];
							const hasNestedActivity =
								msg.role === "assistant" &&
								(toolEvents.length > 0 || thinkingEvents.length > 0);
							const isActiveMessage =
								msg.role === "assistant" && isStreaming && msg.id === lastAssistantId;

							return (
								<div
									key={msg.id}
									className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
								>
									<div
										className={`w-fit max-w-[90%] rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-[0_10px_18px_rgba(18,14,12,0.08)] sm:max-w-[78%] ${msg.role === "user"
											? "border-white/10 bg-slate-950/60 text-slate-100"
											: "border-sky-400/40 bg-sky-500/10 text-slate-100"
											}`}
									>
										<div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-400">
											<span>{msg.role === "user" ? "You" : "Wingman"}</span>
											<span>{formatTime(msg.createdAt)}</span>
										</div>
										{msg.role === "assistant" && !msg.content ? (
											<div className="mt-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400">
												<span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
												<span className="h-2 w-2 animate-pulse rounded-full bg-sky-400 [animation-delay:150ms]" />
												<span className="h-2 w-2 animate-pulse rounded-full bg-sky-400 [animation-delay:300ms]" />
											</div>
										) : (
											<ReactMarkdown
												remarkPlugins={[remarkGfm]}
												className="markdown-content mt-2 text-sm leading-relaxed"
												components={{
													a: ({ node, ...props }) => (
														<a
															{...props}
															className="text-sky-300 underline decoration-sky-400/40 underline-offset-4"
															target="_blank"
															rel="noreferrer"
														/>
													),
													code: ({ node, inline, className, children, ...props }) =>
														inline ? (
															<code
																{...props}
																className="rounded bg-white/10 px-1 py-0.5 text-[0.85em]"
															>
																{children}
															</code>
														) : (
															<pre className="mt-3 overflow-auto rounded-lg border border-white/10 bg-slate-900/60 p-3 text-xs">
																<code {...props} className={className}>
																	{children}
																</code>
															</pre>
														),
													ul: ({ node, ...props }) => (
														<ul {...props} className="ml-5 list-disc space-y-1" />
													),
													ol: ({ node, ...props }) => (
														<ol {...props} className="ml-5 list-decimal space-y-1" />
													),
													blockquote: ({ node, ...props }) => (
														<blockquote
															{...props}
															className="border-l-2 border-sky-400/60 pl-3 text-slate-300"
														/>
													),
												}}
											>
												{msg.content}
											</ReactMarkdown>
										)}
										{msg.attachments && msg.attachments.length > 0 ? (
											<div className="mt-3 grid gap-2 sm:grid-cols-2">
												{msg.attachments.map((attachment) => (
													<div
														key={attachment.id}
														className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/50"
													>
														<button
															type="button"
															className="group relative block w-full"
															onClick={() => setPreviewAttachment(attachment)}
														>
															<img
																src={attachment.dataUrl}
																alt={attachment.name || "Attachment"}
																className="h-36 w-full cursor-zoom-in object-cover transition duration-200 group-hover:scale-[1.02]"
																loading="lazy"
															/>
															<span className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-white/5" />
														</button>
														{attachment.name ? (
															<div className="truncate border-t border-white/10 px-2 py-1 text-[11px] text-slate-400">
																{attachment.name}
															</div>
														) : null}
													</div>
												))}
											</div>
										) : null}
										{hasNestedActivity ? (
											<div className="mt-3">
												<ThinkingPanel
													thinkingEvents={thinkingEvents}
													toolEvents={toolEvents}
													isStreaming={isActiveMessage}
												/>
											</div>
										) : null}
									</div>
								</div>
							);
						})}
					</>
				)}
			</div>

			<div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 sm:p-4">
				{!connected ? (
					<div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs text-amber-200">
						<div>
							<span className="font-semibold">Gateway not connected.</span>{" "}
							Open the Command Deck to connect before sending prompts.
						</div>
						<button className="button-secondary px-3 py-1 text-xs" type="button" onClick={onOpenCommandDeck}>
							Open Command Deck
						</button>
					</div>
				) : null}
				<div className="flex items-center justify-between">
					<label className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Prompt</label>
					<div className="flex items-center gap-2 text-xs text-slate-400">
						<button
							type="button"
							className="button-secondary px-3 py-1 text-xs"
							onClick={handlePickFiles}
							disabled={isStreaming}
						>
							Add Images
						</button>
						<input
							ref={fileInputRef}
							type="file"
							accept="image/*"
							multiple
							className="hidden"
							onChange={handleFileChange}
						/>
					</div>
				</div>
				{attachments.length > 0 ? (
					<div className="mt-3 flex flex-wrap gap-2">
						{attachments.map((attachment) => (
							<div
								key={attachment.id}
								className="group relative flex items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-slate-900/60 pr-2 text-xs"
							>
								<img
									src={attachment.dataUrl}
									alt={attachment.name || "Attachment"}
									className="h-12 w-12 cursor-zoom-in object-cover"
									onClick={() => setPreviewAttachment(attachment)}
								/>
								<span className="max-w-[160px] truncate text-slate-300">
									{attachment.name || "Image"}
								</span>
								<button
									type="button"
									className="text-slate-400 transition hover:text-rose-500"
									onClick={() => onRemoveAttachment(attachment.id)}
								>
									×
								</button>
							</div>
						))}
						<button
							type="button"
							className="text-xs text-slate-400 underline decoration-slate-300 underline-offset-4"
							onClick={onClearAttachments}
						>
							Clear all
						</button>
					</div>
				) : null}
				{attachmentError ? (
					<div className="mt-2 text-xs text-rose-500">{attachmentError}</div>
				) : null}
				<textarea
					className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900/70 px-3 py-3 text-sm focus:shadow-glow"
					rows={3}
					value={prompt}
					onChange={(event) => onPromptChange(event.target.value)}
					onKeyDown={handleKeyDown}
					onPaste={handlePaste}
					placeholder="Ask Wingman to do something..."
					disabled={isStreaming}
				/>
				<div className="mt-3 flex flex-wrap items-center justify-between gap-3">
					<div className="flex flex-wrap items-center gap-2">
						{QUICK_PROMPTS.map((item) => (
							<button
								key={item}
								type="button"
								className="rounded-full border border-white/10 bg-slate-900/60 px-3 py-1 text-xs text-slate-300 transition hover:border-sky-400/50"
								onClick={() => onPromptChange(item)}
							>
								{item}
							</button>
						))}
					</div>
					<div className="flex items-center gap-3 text-xs text-slate-400">
						<button
							className="button-primary"
							onClick={onSendPrompt}
							type="button"
							disabled={!canSend}
						>
							Send Prompt
						</button>
					</div>
				</div>
			</div>
			{previewAttachment ? (
				<div
					className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6"
					onClick={() => setPreviewAttachment(null)}
				>
					<div
						className="max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl bg-slate-950 shadow-2xl"
						onClick={(event) => event.stopPropagation()}
					>
						<img
							src={previewAttachment.dataUrl}
							alt={previewAttachment.name || "Attachment preview"}
							className="max-h-[85vh] max-w-[90vw] object-contain"
						/>
						<div className="flex items-center justify-between gap-4 border-t border-white/10 px-4 py-2 text-xs text-slate-400">
							<span className="truncate">{previewAttachment.name || "Image preview"}</span>
							<button
								type="button"
								className="text-slate-400 transition hover:text-slate-300"
								onClick={() => setPreviewAttachment(null)}
							>
								Close
							</button>
						</div>
					</div>
				</div>
			) : null}
		</section>
	);
};

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
