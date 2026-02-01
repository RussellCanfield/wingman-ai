import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FiAlertTriangle, FiLoader, FiMic, FiStopCircle, FiVolume2 } from "react-icons/fi";
import type { ChatAttachment, Thread } from "../types";
import { extractImageFiles } from "../utils/attachments";
import { getVoicePlaybackLabel, type VoicePlaybackStatus } from "../utils/voicePlayback";
import { getAudioAvailability } from "../utils/media";
import { ThinkingPanel } from "./ThinkingPanel";
import { SguiRenderer } from "../sgui/SguiRenderer";

type ChatPanelProps = {
	activeThread?: Thread;
	prompt: string;
	attachments: ChatAttachment[];
	attachmentError?: string;
	isStreaming: boolean;
	connected: boolean;
	loading: boolean;
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
	onOpenCommandDeck,
}) => {
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const autoScrollRef = useRef<boolean>(true);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const mediaStreamRef = useRef<MediaStream | null>(null);
	const recordChunksRef = useRef<Blob[]>([]);
	const recordTimerRef = useRef<number | null>(null);
	const recordStartRef = useRef<number>(0);
	const recordingCancelledRef = useRef(false);
	const audioContextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const analyserDataRef = useRef<Uint8Array | null>(null);
	const analyserRafRef = useRef<number | null>(null);
	const [previewAttachment, setPreviewAttachment] =
		useState<ChatAttachment | null>(null);
	const [recording, setRecording] = useState(false);
	const [recordingDuration, setRecordingDuration] = useState(0);
	const [recordingError, setRecordingError] = useState("");
	const [inputLevel, setInputLevel] = useState(0);
	const lastVoiceMessageIdRef = useRef<string | null>(null);

	useEffect(() => {
		if (voicePlayback.status === "idle") {
			lastVoiceMessageIdRef.current = null;
		} else if (voicePlayback.messageId) {
			lastVoiceMessageIdRef.current = voicePlayback.messageId;
		}
	}, [voicePlayback.messageId, voicePlayback.status]);
	const canSend =
		connected && !isStreaming && !recording && (prompt.trim() || attachments.length > 0);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;
		if (autoScrollRef.current) {
			el.scrollTop = el.scrollHeight;
		}
	}, []);

	useEffect(() => {
		autoScrollRef.current = true;
	}, []);

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

	useEffect(() => {
		return () => {
			recordingCancelledRef.current = true;
			if (recordTimerRef.current !== null) {
				window.clearInterval(recordTimerRef.current);
				recordTimerRef.current = null;
			}
			stopAudioMeter();
			if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
				mediaRecorderRef.current.stop();
			}
			if (mediaStreamRef.current) {
				for (const track of mediaStreamRef.current.getTracks()) {
					track.stop();
				}
				mediaStreamRef.current = null;
			}
		};
	}, []);

	const startAudioMeter = (stream: MediaStream) => {
		stopAudioMeter();
		const AudioContextCtor =
			window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!AudioContextCtor) return;
		const audioContext = new AudioContextCtor();
		const analyser = audioContext.createAnalyser();
		analyser.fftSize = 256;
		const source = audioContext.createMediaStreamSource(stream);
		source.connect(analyser);
		const data = new Uint8Array(analyser.fftSize);
		audioContextRef.current = audioContext;
		analyserRef.current = analyser;
		analyserDataRef.current = data;

		const tick = () => {
			if (!analyserRef.current || !analyserDataRef.current) return;
			analyserRef.current.getByteTimeDomainData(analyserDataRef.current);
			let sumSquares = 0;
			for (let i = 0; i < analyserDataRef.current.length; i += 1) {
				const normalized = (analyserDataRef.current[i] - 128) / 128;
				sumSquares += normalized * normalized;
			}
			const rms = Math.sqrt(sumSquares / analyserDataRef.current.length);
			setInputLevel(rms);
			analyserRafRef.current = window.requestAnimationFrame(tick);
		};

		analyserRafRef.current = window.requestAnimationFrame(tick);
	};

	const stopAudioMeter = () => {
		if (analyserRafRef.current !== null) {
			window.cancelAnimationFrame(analyserRafRef.current);
			analyserRafRef.current = null;
		}
		if (audioContextRef.current) {
			audioContextRef.current.close();
			audioContextRef.current = null;
		}
		analyserRef.current = null;
		analyserDataRef.current = null;
		setInputLevel(0);
	};

	const startRecording = async () => {
		if (recording || isStreaming) return;
		setRecordingError("");
		recordingCancelledRef.current = false;
		if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
			setRecordingError("Audio recording is not supported in this browser.");
			return;
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mimeType = pickSupportedAudioMimeType();
			const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
			mediaStreamRef.current = stream;
			mediaRecorderRef.current = recorder;
			recordChunksRef.current = [];
			startAudioMeter(stream);

			recorder.ondataavailable = (event) => {
				if (event.data && event.data.size > 0) {
					recordChunksRef.current.push(event.data);
				}
			};
			recorder.onerror = () => {
				setRecordingError("Recording failed.");
			};
			recorder.onstop = () => {
				if (recordingCancelledRef.current) {
					cleanupRecording();
					return;
				}
				const blob = new Blob(recordChunksRef.current, {
					type: recorder.mimeType || "audio/webm",
				});
				if (!blob || blob.size === 0) {
					setRecordingError("No audio captured.");
					cleanupRecording();
					return;
				}
				const extension = resolveAudioExtension(blob.type || recorder.mimeType);
				const filename = `voice-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`;
				const file = new File([blob], filename, {
					type: blob.type || recorder.mimeType || "audio/webm",
				});
				onAddAttachments([file]);
				cleanupRecording();
			};

			recorder.start();
			recordStartRef.current = Date.now();
			setRecording(true);
			setRecordingDuration(0);
			recordTimerRef.current = window.setInterval(() => {
				setRecordingDuration(Date.now() - recordStartRef.current);
			}, 250);
		} catch (error) {
			setRecordingError("Microphone access was denied.");
			cleanupRecording();
		}
	};

	const stopRecording = () => {
		if (recordTimerRef.current !== null) {
			window.clearInterval(recordTimerRef.current);
			recordTimerRef.current = null;
		}
		setRecording(false);
		stopAudioMeter();
		const recorder = mediaRecorderRef.current;
		if (recorder && recorder.state !== "inactive") {
			recorder.stop();
		}
	};

	const cleanupRecording = () => {
		if (recordTimerRef.current !== null) {
			window.clearInterval(recordTimerRef.current);
			recordTimerRef.current = null;
		}
		stopAudioMeter();
		if (mediaStreamRef.current) {
			for (const track of mediaStreamRef.current.getTracks()) {
				track.stop();
			}
			mediaStreamRef.current = null;
		}
		mediaRecorderRef.current = null;
		recordChunksRef.current = [];
		setRecording(false);
		setRecordingDuration(0);
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			if (recording) return;
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
	const audioLevel = Math.min(1, inputLevel * 4);
	const audioGlow = recording
		? `0 0 ${8 + audioLevel * 18}px rgba(248, 113, 113, ${0.25 + audioLevel * 0.45})`
		: undefined;
	const resolvedVoiceMessageId =
		voicePlayback.messageId || lastVoiceMessageIdRef.current;
	const canToggleVoice = Boolean(activeThread);

	return (
		<section className="panel-card animate-rise flex h-[calc(100vh-120px)] min-h-[1200px] flex-col gap-4 p-4 sm:gap-6 sm:p-6">
			<header className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h2 className="text-lg font-semibold">Mission Stream</h2>
					<p className="mt-1 text-sm text-slate-400">
						Thread:{" "}
						<span className="font-semibold text-slate-200">
							{activeThread?.name || "--"}
						</span>
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<button
						className={`button-secondary ${voiceAutoEnabled ? "border-sky-400/60 text-sky-200" : ""}`}
						onClick={onToggleVoiceAuto}
						type="button"
						disabled={!canToggleVoice}
					>
						{voiceAutoEnabled ? "Voice: Auto" : "Voice: Off"}
					</button>
					<button
						className="button-secondary"
						onClick={onClearChat}
						type="button"
					>
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
							<p className="text-base font-semibold text-slate-200">
								Launch a new mission.
							</p>
							<p className="mt-2 text-sm text-slate-400">
								Send a prompt to begin, or pick a quick prompt below to shape
								the session.
							</p>
						</div>
					</div>
				) : (
					activeThread.messages.map((msg) => {
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
						msg.role === "assistant" &&
						isStreaming &&
						msg.id === lastAssistantId;
					const uiBlocks = dynamicUiEnabled ? msg.uiBlocks : undefined;
					const displayText =
						msg.content || (!dynamicUiEnabled ? msg.uiTextFallback || "" : "");

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
									<div className="flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.18em] text-slate-400">
										<span>{msg.role === "user" ? "You" : "Wingman"}</span>
										<div className="flex items-center gap-2">
											<span className="whitespace-nowrap">
												{formatTime(msg.createdAt)}
											</span>
											{msg.role === "assistant" &&
											(msg.content || msg.uiTextFallback) ? (
												(() => {
													const playbackStatus =
														resolvedVoiceMessageId === msg.id
															? voicePlayback.status
															: "idle";
													const playbackLabel = getVoicePlaybackLabel(playbackStatus);
													const isBusy =
														playbackStatus === "pending" ||
														playbackStatus === "loading";
													const isPlaying = playbackStatus === "playing";
													const playbackText =
														msg.content || msg.uiTextFallback || "";
													return (
														<button
															type="button"
															onClick={() =>
																resolvedVoiceMessageId === msg.id &&
																voicePlayback.status !== "idle"
																	? onStopVoice()
																	: (() => {
																			lastVoiceMessageIdRef.current = msg.id;
																			onSpeakVoice(msg.id, playbackText);
																		})()
															}
															className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] transition hover:border-sky-400/60 hover:text-sky-100 ${
																isBusy
																	? "border-sky-400/40 text-sky-100"
																	: isPlaying
																		? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
																		: "border-white/10 text-slate-300"
															}`}
														>
															{isBusy ? (
																<FiLoader
																	className={`h-3 w-3 ${playbackStatus === "pending" ? "animate-pulse" : "animate-spin"}`}
																/>
															) : playbackStatus === "playing" ? (
																<FiStopCircle className="h-3 w-3 animate-pulse" />
															) : (
																<FiVolume2 className="h-3 w-3" />
															)}
															<span>{playbackLabel}</span>
															{isPlaying ? (
																<span className="flex items-end gap-0.5">
																	<span className="h-2 w-0.5 animate-pulse rounded-full bg-emerald-200/80" />
																	<span className="h-3 w-0.5 animate-pulse rounded-full bg-emerald-200/80 [animation-delay:120ms]" />
																	<span className="h-2 w-0.5 animate-pulse rounded-full bg-emerald-200/80 [animation-delay:240ms]" />
																</span>
															) : null}
														</button>
													);
												})()
											) : null}
										</div>
									</div>
									{msg.role === "assistant" &&
									!displayText &&
									(!uiBlocks || uiBlocks.length === 0) ? (
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
												code: ({
													node,
													inline,
													className,
													children,
													...props
												}) =>
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
													<ol
														{...props}
														className="ml-5 list-decimal space-y-1"
													/>
												),
												blockquote: ({ node, ...props }) => (
													<blockquote
														{...props}
														className="border-l-2 border-sky-400/60 pl-3 text-slate-300"
													/>
												),
											}}
										>
											{displayText}
										</ReactMarkdown>
									)}
									{uiBlocks && uiBlocks.length > 0 ? (
										<div className="mt-3 space-y-3">
											{uiBlocks.map((block) => (
												<div
													key={block.id}
													className="rounded-xl border border-white/10 bg-slate-950/60 p-3"
												>
													<SguiRenderer ui={block.spec} />
												</div>
											))}
										</div>
									) : null}
									{msg.attachments && msg.attachments.length > 0 ? (
										<div className="mt-3 grid gap-2 sm:grid-cols-2">
											{msg.attachments.map((attachment) => {
												const isAudio = isAudioAttachment(attachment);
												const audioAvailability = isAudio
													? getAudioAvailability(attachment)
													: null;
												return (
													<div
														key={attachment.id}
														className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/50"
													>
														{isAudio ? (
															<div className="p-4">
																{audioAvailability?.playable ? (
																	<audio
																		controls
																		src={attachment.dataUrl}
																		className="w-full min-w-[200px] max-w-[360px] sm:min-w-[240px]"
																	/>
																) : (
																	<div className="flex items-center gap-3 rounded-xl border border-dashed border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
																		<FiAlertTriangle className="h-4 w-4" />
																		<div>
																			<div className="font-semibold">Audio unavailable</div>
																			<div className="text-[11px] text-amber-200/80">
																				{audioAvailability?.reason ||
																					"Audio was not stored for this session."}
																			</div>
																		</div>
																	</div>
																)}
																{attachment.name ? (
																	<div className="mt-2 truncate text-[11px] text-slate-400">
																		{attachment.name}
																	</div>
																) : null}
															</div>
														) : (
															<>
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
															</>
														)}
													</div>
												);
											})}
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
					})
				)}
			</div>

			<div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 sm:p-4">
				{!connected ? (
					<div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs text-amber-200">
						<div>
							<span className="font-semibold">Gateway not connected.</span> Open
							the Command Deck to connect before sending prompts.
						</div>
						<button
							className="button-secondary px-3 py-1 text-xs"
							type="button"
							onClick={onOpenCommandDeck}
						>
							Open Command Deck
						</button>
					</div>
				) : null}
				<div className="flex items-center justify-between">
					<label
						htmlFor="prompt-textarea"
						className="text-[11px] uppercase tracking-[0.2em] text-slate-400"
					>
						Prompt
					</label>
					<div className="flex items-center gap-3 text-xs text-slate-400">
						<button
							type="button"
							className="button-secondary px-3 py-2 text-xs"
							onClick={handlePickFiles}
							disabled={isStreaming}
						>
							Add Media
						</button>
						<button
							type="button"
							aria-pressed={recording}
							aria-label={recording ? "Stop recording" : "Record audio"}
							className={`relative flex h-9 w-9 items-center justify-center rounded-full border text-xs transition ${recording
								? "border-rose-400/60 bg-rose-500/20 text-rose-100"
								: "border-white/10 bg-slate-900/70 text-slate-100"
								}`}
							style={audioGlow ? { boxShadow: audioGlow } : undefined}
							onClick={recording ? stopRecording : startRecording}
							disabled={isStreaming}
						>
							{recording ? <FiStopCircle size={16} /> : <FiMic size={16} />}
							{recording ? (
								<span className="pointer-events-none absolute inset-0 rounded-full border border-rose-400/40 animate-ping" />
							) : null}
							{recording ? (
								<span className="pointer-events-none absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-end gap-0.5">
									<span
										className="w-1 rounded-full bg-rose-300/80 transition-all"
										style={{ height: `${6 + audioLevel * 10}px` }}
									/>
									<span
										className="w-1 rounded-full bg-rose-200/80 transition-all"
										style={{ height: `${4 + audioLevel * 14}px` }}
									/>
									<span
										className="w-1 rounded-full bg-rose-300/80 transition-all"
										style={{ height: `${6 + audioLevel * 8}px` }}
									/>
								</span>
							) : null}
						</button>
						{recording ? (
							<span className="text-[11px] uppercase tracking-[0.2em] text-rose-200">
								{formatDuration(recordingDuration)}
							</span>
						) : null}
						<input
							ref={fileInputRef}
							type="file"
							accept="image/*,audio/*"
							multiple
							className="hidden"
							onChange={handleFileChange}
						/>
					</div>
				</div>
				{attachments.length > 0 ? (
					<div className="mt-3 flex flex-wrap gap-2">
						{attachments.map((attachment) => {
							const isAudio = isAudioAttachment(attachment);
							const audioAvailability = isAudio
								? getAudioAvailability(attachment)
								: null;
							return (
								<div
									key={attachment.id}
									className="group relative flex items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-slate-900/60 pr-2 text-xs"
								>
									{isAudio ? (
										<div className="flex items-center gap-2 px-2 py-1">
											{audioAvailability?.playable ? (
												<audio
													controls
													src={attachment.dataUrl}
													className="h-8 w-[200px] min-w-[180px]"
												/>
											) : (
												<div className="flex items-center gap-2 rounded-lg border border-dashed border-amber-400/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100">
													<FiAlertTriangle className="h-3 w-3" />
													<span>Audio unavailable</span>
												</div>
											)}
										</div>
									) : (
										<button
											type="button"
											className="h-12 w-12 cursor-zoom-in p-0"
											onClick={() => setPreviewAttachment(attachment)}
										>
											<img
												src={attachment.dataUrl}
												alt={attachment.name || "Attachment"}
												className="h-full w-full object-cover"
											/>
										</button>
									)}
									<span className="max-w-[160px] truncate text-slate-300">
										{attachment.name || (isAudio ? "Audio" : "Image")}
									</span>
									<button
										type="button"
										className="text-slate-400 transition hover:text-rose-500"
										onClick={() => onRemoveAttachment(attachment.id)}
									>
										×
									</button>
								</div>
							);
						})}
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
				{recordingError ? (
					<div className="mt-2 text-xs text-rose-500">{recordingError}</div>
				) : null}
				<textarea
					id="prompt-textarea"
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
				// biome-ignore lint/a11y/useSemanticElements: modal overlay backdrop requires grid layout for centering
				<div
					role="button"
					tabIndex={0}
					className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6"
					onClick={() => setPreviewAttachment(null)}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							setPreviewAttachment(null);
						}
					}}
				>
					<div
						role="dialog"
						aria-modal="true"
						className="max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl bg-slate-950 shadow-2xl"
						onClick={(event) => event.stopPropagation()}
						onKeyDown={(event) => event.stopPropagation()}
					>
						<img
							src={previewAttachment.dataUrl}
							alt={previewAttachment.name || "Attachment preview"}
							className="max-h-[85vh] max-w-[90vw] object-contain"
						/>
						<div className="flex items-center justify-between gap-4 border-t border-white/10 px-4 py-2 text-xs text-slate-400">
							<span className="truncate">
								{previewAttachment.name || "Image preview"}
							</span>
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

function formatDuration(durationMs: number): string {
	const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes > 0) {
		return `${minutes}:${String(seconds).padStart(2, "0")}`;
	}
	return `0:${String(seconds).padStart(2, "0")}`;
}

function isAudioAttachment(attachment: ChatAttachment): boolean {
	if (attachment.kind === "audio") return true;
	if (attachment.mimeType?.startsWith("audio/")) return true;
	if (attachment.dataUrl?.startsWith("data:audio/")) return true;
	return false;
}

function pickSupportedAudioMimeType(): string | undefined {
	if (typeof MediaRecorder === "undefined") return undefined;
	const candidates = [
		"audio/webm;codecs=opus",
		"audio/ogg;codecs=opus",
		"audio/webm",
		"audio/ogg",
		"audio/mp4",
	];
	for (const candidate of candidates) {
		if (MediaRecorder.isTypeSupported(candidate)) {
			return candidate;
		}
	}
	return undefined;
}

function resolveAudioExtension(mimeType?: string): string {
	if (!mimeType) return "webm";
	const normalized = mimeType.toLowerCase();
	if (normalized.includes("ogg")) return "ogg";
	if (normalized.includes("mp4") || normalized.includes("m4a")) return "m4a";
	if (normalized.includes("wav")) return "wav";
	if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
	if (normalized.includes("webm")) return "webm";
	return "webm";
}
