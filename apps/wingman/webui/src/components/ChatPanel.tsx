import type React from "react";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import {
	FiAlertTriangle,
	FiFileText,
	FiLoader,
	FiMic,
	FiPaperclip,
	FiSend,
	FiStopCircle,
	FiVolume2,
} from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { SguiRenderer } from "../sgui/SguiRenderer";
import type { ChatAttachment, Thread } from "../types";
import { extractImageFiles } from "../utils/attachments";
import { getAudioAvailability } from "../utils/media";
import { shouldAutoScroll } from "../utils/scroll";
import {
	getVoicePlaybackLabel,
	type VoicePlaybackStatus,
} from "../utils/voicePlayback";
import { ThinkingPanel } from "./ThinkingPanel";

const COMPOSER_MAX_LINES = 4;
const RETURN_SYMBOL_LINE_BREAK_PATTERN =
	/[\u0085\u2028\u2029\u21B5\u23CE\u240A\u2424]/g;
const AUDIO_FILE_EXTENSION_PATTERN =
	/\.(mp3|wav|ogg|m4a|aac|flac|opus|weba|webm)(?:$|[?#])/i;
const AUDIO_REFERENCE_TOKEN_PATTERN = /[^\s"'`<>]+/g;

type MarkdownCodeBlockProps = {
	className?: string;
	children: React.ReactNode;
};

const MarkdownCodeBlock: React.FC<MarkdownCodeBlockProps> = ({
	className,
	children,
}) => {
	const [copied, setCopied] = useState(false);
	const codeRef = useRef<HTMLElement | null>(null);
	const copiedTimerRef = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (copiedTimerRef.current !== null) {
				window.clearTimeout(copiedTimerRef.current);
				copiedTimerRef.current = null;
			}
		};
	}, []);

	const handleCopy = useCallback(async () => {
		const text = codeRef.current?.innerText?.trim();
		if (!text) return;
		const didCopy = await copyTextToClipboard(text);
		if (!didCopy) return;
		setCopied(true);
		if (copiedTimerRef.current !== null) {
			window.clearTimeout(copiedTimerRef.current);
		}
		copiedTimerRef.current = window.setTimeout(() => {
			setCopied(false);
		}, 1500);
	}, []);

	return (
		<pre className="relative mt-3 overflow-auto rounded-lg border border-white/10 bg-slate-900/60 p-3 pt-9 text-xs">
			<button
				type="button"
				className="absolute right-2 top-2 rounded-md border border-white/10 bg-slate-950/80 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-300 transition hover:border-sky-400/60 hover:text-sky-100"
				aria-label="Copy code block"
				onClick={handleCopy}
			>
				{copied ? "Copied" : "Copy"}
			</button>
			<code ref={codeRef} className={className || "hljs"}>
				{children}
			</code>
		</pre>
	);
};

type ChatPanelProps = {
	activeThread?: Thread;
	defaultOutputDir?: string | null;
	prompt: string;
	attachments: ChatAttachment[];
	initialPreviewAttachment?: ChatAttachment | null;
	fileAccept: string;
	attachmentError?: string;
	isStreaming: boolean;
	queuedPromptCount: number;
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
	onStopPrompt: () => void;
	onAddAttachments: (files: FileList | File[] | null) => void;
	onRemoveAttachment: (id: string) => void;
	onClearAttachments: () => void;
	onClearChat: () => void;
	onOpenCommandDeck: () => void;
};

export const ChatPanel: React.FC<ChatPanelProps> = ({
	activeThread,
	defaultOutputDir,
	prompt,
	attachments,
	initialPreviewAttachment,
	fileAccept,
	attachmentError,
	isStreaming,
	queuedPromptCount,
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
	onStopPrompt,
	onAddAttachments,
	onRemoveAttachment,
	onClearAttachments,
	onClearChat,
	onOpenCommandDeck,
}) => {
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
	const previousStreamingRef = useRef(isStreaming);
	const autoScrollRef = useRef<boolean>(true);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const mediaStreamRef = useRef<MediaStream | null>(null);
	const recordChunksRef = useRef<Blob[]>([]);
	const recordTimerRef = useRef<number | null>(null);
	const recordStartRef = useRef<number>(0);
	const recordingCancelledRef = useRef(false);
	const audioContextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const analyserDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
	const analyserRafRef = useRef<number | null>(null);
	const [previewAttachment, setPreviewAttachment] =
		useState<ChatAttachment | null>(initialPreviewAttachment ?? null);
	const [recording, setRecording] = useState(false);
	const [recordingDuration, setRecordingDuration] = useState(0);
	const [recordingError, setRecordingError] = useState("");
	const [inputLevel, setInputLevel] = useState(0);
	const lastVoiceMessageIdRef = useRef<string | null>(null);
	const messageCount = activeThread?.messages.length ?? 0;
	const lastMessage =
		messageCount > 0 && activeThread
			? activeThread.messages[messageCount - 1]
			: undefined;

	useEffect(() => {
		if (voicePlayback.status === "idle") {
			lastVoiceMessageIdRef.current = null;
		} else if (voicePlayback.messageId) {
			lastVoiceMessageIdRef.current = voicePlayback.messageId;
		}
	}, [voicePlayback.messageId, voicePlayback.status]);
	const hasDraft = Boolean(prompt.trim() || attachments.length > 0);
	const canSend = connected && !recording && hasDraft;
	const canStop = isStreaming && !recording && !hasDraft;
	const showStreamingGlow = isStreaming;

	useEffect(() => {
		autoScrollRef.current = true;
	}, [activeThread?.id]);

	useLayoutEffect(() => {
		const el = scrollRef.current;
		if (!el || !autoScrollRef.current) return;
		const frame = window.requestAnimationFrame(() => {
			el.scrollTop = el.scrollHeight;
		});
		return () => window.cancelAnimationFrame(frame);
	}, [
		activeThread?.id,
		messageCount,
		lastMessage?.id,
		lastMessage?.content,
		lastMessage?.uiTextFallback,
		lastMessage?.toolEvents?.length,
		lastMessage?.thinkingEvents?.length,
		lastMessage?.uiBlocks?.length,
		lastMessage?.attachments?.length,
		loading,
	]);

	useLayoutEffect(() => {
		const textarea = composerTextareaRef.current;
		if (!textarea) return;
		textarea.style.height = "auto";
		const styles = window.getComputedStyle(textarea);
		const lineHeight = Number.parseFloat(styles.lineHeight) || 24;
		const paddingTop = Number.parseFloat(styles.paddingTop) || 10;
		const paddingBottom = Number.parseFloat(styles.paddingBottom) || 10;
		const { heightPx, overflowY } = computeComposerTextareaLayout({
			scrollHeight: textarea.scrollHeight,
			lineHeight,
			paddingTop,
			paddingBottom,
			maxLines: COMPOSER_MAX_LINES,
		});
		textarea.style.height = `${heightPx}px`;
		textarea.style.overflowY = overflowY;
	}, [prompt]);

	useEffect(() => {
		const wasStreaming = previousStreamingRef.current;
		previousStreamingRef.current = isStreaming;
		if (!shouldRefocusComposer({ wasStreaming, isStreaming })) return;
		const frame = window.requestAnimationFrame(() => {
			const textarea = composerTextareaRef.current;
			if (!textarea || textarea.disabled) return;
			textarea.focus();
			const cursorPosition = textarea.value.length;
			textarea.setSelectionRange(cursorPosition, cursorPosition);
		});
		return () => window.cancelAnimationFrame(frame);
	}, [isStreaming]);

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
			if (
				mediaRecorderRef.current &&
				mediaRecorderRef.current.state !== "inactive"
			) {
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
			window.AudioContext ||
			(window as unknown as { webkitAudioContext?: typeof AudioContext })
				.webkitAudioContext;
		if (!AudioContextCtor) return;
		const audioContext = new AudioContextCtor();
		const analyser = audioContext.createAnalyser();
		analyser.fftSize = 256;
		const source = audioContext.createMediaStreamSource(stream);
		source.connect(analyser);
		const data = new Uint8Array(new ArrayBuffer(analyser.fftSize));
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
		if (
			!navigator.mediaDevices?.getUserMedia ||
			typeof MediaRecorder === "undefined"
		) {
			setRecordingError("Audio recording is not supported in this browser.");
			return;
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mimeType = pickSupportedAudioMimeType();
			const recorder = new MediaRecorder(
				stream,
				mimeType ? { mimeType } : undefined,
			);
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
		autoScrollRef.current = shouldAutoScroll({
			scrollHeight: el.scrollHeight,
			scrollTop: el.scrollTop,
			clientHeight: el.clientHeight,
		});
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
	const transcriptContent = useMemo(() => {
		const isEmptyThread = !activeThread || activeThread.messages.length === 0;
		if (loading && isEmptyThread) {
			return (
				<div className="grid h-full place-items-center text-sm text-slate-400">
					Loading messages...
				</div>
			);
		}
		if (isEmptyThread) {
			return (
				<div className="grid h-full place-items-center text-sm text-slate-400">
					<div className="max-w-sm text-center">
						<p className="text-base font-semibold text-slate-200">
							Launch a new mission.
						</p>
						<p className="mt-2 text-sm text-slate-400">
							Send a prompt to begin the session.
						</p>
					</div>
				</div>
			);
		}
		let hasSpeakableAssistantInTurn = false;
		return activeThread.messages.map((msg, index) => {
			const isUserMessage = msg.role === "user";
			if (msg.role !== "assistant") {
				hasSpeakableAssistantInTurn = false;
			}
			const previousMessage =
				index > 0 ? activeThread.messages[index - 1] : null;
			const previousRole = previousMessage?.role;
			const messageSpacingClass =
				index === 0
					? "mt-0"
					: msg.role === "assistant" && previousRole === "assistant"
						? "mt-0"
						: "mt-4";
			const isAssistantTurnStart =
				msg.role === "assistant" &&
				(!previousMessage || previousMessage.role !== "assistant");
			const showTimestamp = isUserMessage || isAssistantTurnStart;
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
			const uiBlocks = dynamicUiEnabled ? msg.uiBlocks : undefined;
			const normalizedText = normalizeMessageLineBreaks(
				msg.content || (!dynamicUiEnabled ? msg.uiTextFallback || "" : ""),
			);
			const displayText = normalizedText;
			const previewWorkingDirectory =
				activeThread?.workdir || defaultOutputDir || null;
			const assistantAudioPreviews =
				msg.role === "assistant"
					? extractAssistantAudioPreviews(displayText, previewWorkingDirectory)
					: [];
			const hasSpeakableText = Boolean(msg.content || msg.uiTextFallback);
			const showVoiceButton =
				msg.role === "assistant" &&
				hasSpeakableText &&
				!hasSpeakableAssistantInTurn;
			if (showVoiceButton) {
				hasSpeakableAssistantInTurn = true;
			}
			const showMetaRow = isUserMessage || showTimestamp || showVoiceButton;

			return (
				<div
					key={msg.id}
					className={`flex ${isUserMessage ? "justify-end" : "justify-start"} ${messageSpacingClass}`}
				>
					<div
						className={`min-w-0 text-sm leading-relaxed ${isUserMessage
							? "w-fit max-w-[90%] rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-slate-100 shadow-[0_10px_18px_rgba(18,14,12,0.08)] sm:max-w-[78%]"
							: "w-full max-w-full px-1 py-1 text-slate-100"
							}`}
					>
						{showMetaRow ? (
							<div
								className={`flex items-center gap-4 text-[10px] uppercase tracking-[0.18em] text-slate-400 ${isUserMessage ? "justify-between" : "mb-1 justify-end"
									}`}
							>
								{isUserMessage ? <span>You</span> : null}
								<div className="flex items-center gap-2">
									{showTimestamp ? (
										<span className="whitespace-nowrap">
											{formatTime(msg.createdAt)}
										</span>
									) : null}
									{showVoiceButton
										? (() => {
											const playbackStatus =
												resolvedVoiceMessageId === msg.id
													? voicePlayback.status
													: "idle";
											const playbackLabel =
												getVoicePlaybackLabel(playbackStatus);
											const isBusy =
												playbackStatus === "pending" ||
												playbackStatus === "loading";
											const isPlaying = playbackStatus === "playing";
											const playbackText = normalizeMessageLineBreaks(
												msg.content || msg.uiTextFallback || "",
											);
											return (
												<button
													type="button"
													title={playbackLabel}
													aria-label={
														isPlaying || isBusy
															? "Stop voice playback"
															: "Play assistant response"
													}
													onClick={() =>
														resolvedVoiceMessageId === msg.id &&
															voicePlayback.status !== "idle"
															? onStopVoice()
															: (() => {
																lastVoiceMessageIdRef.current = msg.id;
																onSpeakVoice(msg.id, playbackText);
															})()
													}
													className={`inline-flex h-6 w-6 items-center justify-center rounded-full border transition hover:border-sky-400/60 hover:text-sky-100 ${isBusy
														? "border-sky-400/50 bg-sky-500/12 text-sky-100"
														: isPlaying
															? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
															: "border-white/10 text-slate-300"
														}`}
												>
													{isBusy ? (
														<FiLoader
															className={`h-3.5 w-3.5 ${playbackStatus === "pending" ? "animate-pulse" : "animate-spin"}`}
														/>
													) : playbackStatus === "playing" ? (
														<FiStopCircle className="h-3.5 w-3.5 animate-pulse" />
													) : (
														<FiVolume2 className="h-3.5 w-3.5" />
													)}
													<span className="sr-only">{playbackLabel}</span>
												</button>
											);
										})()
										: null}
								</div>
							</div>
						) : null}
						{msg.role === "assistant" &&
							isActiveMessage &&
							!hasNestedActivity &&
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
								rehypePlugins={[
									[rehypeHighlight, { detect: true, ignoreMissing: true }],
								]}
								className={`markdown-content text-sm leading-relaxed ${isUserMessage ? "mt-2" : showMetaRow ? "mt-1" : "mt-0"
									}`}
								components={{
									a: ({ node, ...props }) => {
										const href =
											typeof props.href === "string" ? props.href : "";
										if (!isUserMessage && isLikelyAudioUrl(href)) {
											return (
												<span className="my-2 block max-w-[420px]">
													<audio
														controls
														preload="metadata"
														src={href}
														className="w-full min-w-[220px]"
													/>
													<a
														href={href}
														className="mt-1 inline-block text-xs text-sky-300 underline decoration-sky-400/40 underline-offset-4"
														target="_blank"
														rel="noreferrer"
													>
														Open audio in new tab
													</a>
												</span>
											);
										}
										return (
											<a
												{...props}
												className="text-sky-300 underline decoration-sky-400/40 underline-offset-4"
												target="_blank"
												rel="noreferrer"
											/>
										);
									},
									code: ({ node, className, children, ...props }) => {
										const isBlock =
											Boolean(className?.includes("language-")) ||
											(node?.position
												? node.position.start.line !== node.position.end.line
												: false);
										return isBlock ? (
											<MarkdownCodeBlock className={className}>
												{children}
											</MarkdownCodeBlock>
										) : (
											<code
												{...props}
												className="rounded bg-white/10 px-1 py-0.5 text-[0.85em]"
											>
												{children}
											</code>
										);
									},
									ul: ({ node, ...props }) => (
										<ul {...props} className="ml-5 list-disc space-y-1 mb-1" />
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
								{displayText}
							</ReactMarkdown>
						)}
						{assistantAudioPreviews.length > 0 ? (
							<div className="mt-3 space-y-2">
								{assistantAudioPreviews.map((preview) => (
									<div
										key={preview.src}
										className="max-w-[420px] rounded-xl border border-white/10 bg-slate-950/40 p-3"
									>
										<audio
											controls
											preload="metadata"
											src={preview.src}
											className="w-full min-w-[220px]"
										/>
										{preview.label ? (
											<div className="mt-1 truncate text-[11px] text-slate-400">
												{preview.label}
											</div>
										) : null}
									</div>
								))}
							</div>
						) : null}
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
									const isFile = isFileAttachment(attachment);
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
																<div className="font-semibold">
																	Audio unavailable
																</div>
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
											) : isFile ? (
												<div className="p-4">
													<div className="flex items-center gap-2 text-slate-200">
														<FiFileText className="h-4 w-4 text-sky-300" />
														<span className="truncate text-sm font-medium">
															{attachment.name || "File attachment"}
														</span>
													</div>
													<div className="mt-1 text-[11px] text-slate-400">
														{formatFileMeta(attachment)}
													</div>
													{attachment.textContent ? (
														<details className="mt-2 rounded-lg border border-white/10 bg-slate-900/60 p-2">
															<summary className="cursor-pointer text-[11px] uppercase tracking-[0.14em] text-slate-400">
																Preview text
															</summary>
															<pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-slate-300">
																{clipFilePreview(attachment.textContent)}
															</pre>
														</details>
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
		});
	}, [
		activeThread,
		dynamicUiEnabled,
		isStreaming,
		lastAssistantId,
		legacyThinkingEvents,
		legacyToolEvents,
		loading,
		onSpeakVoice,
		onStopVoice,
		resolvedVoiceMessageId,
		voicePlayback.status,
	]);

	return (
		<section className="panel-card animate-rise flex h-[calc(100vh-120px)] min-h-[1200px] flex-col gap-4 p-4 sm:gap-4 sm:p-4">
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
				className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-950/80 to-slate-900/80"
			>
				<div className="min-h-full p-3 sm:p-4">
					{transcriptContent}
					{showStreamingGlow ? (
						<div
							aria-hidden="true"
							className="pointer-events-none mt-3 flex justify-center pb-1"
						>
							<div
								data-testid="streaming-indicator"
								className="flex h-6 items-center justify-center gap-1.5 rounded-full border border-sky-400/35 bg-slate-950/80 px-2.5 shadow-[0_0_18px_rgba(56,189,248,0.2)] backdrop-blur-sm"
							>
								<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-300" />
								<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-300 [animation-delay:160ms]" />
								<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-300 [animation-delay:320ms]" />
							</div>
						</div>
					) : null}
				</div>
			</div>

			<>
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
				{attachments.length > 0 ? (
					<div className="mt-3 flex flex-wrap gap-2">
						{attachments.map((attachment) => {
							const isAudio = isAudioAttachment(attachment);
							const isFile = isFileAttachment(attachment);
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
									) : isFile ? (
										<div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-800/80 text-sky-200">
											<FiFileText className="h-5 w-5" />
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
										{attachment.name ||
											(isAudio ? "Audio" : isFile ? "File" : "Image")}
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
				<label htmlFor="prompt-textarea" className="sr-only">
					Message
				</label>
				<div className="mt-2 rounded-2xl border border-white/10 bg-slate-950/70 p-2 shadow-[0_12px_26px_rgba(3,9,28,0.35)]">
					<div className="flex items-center justify-between gap-2 px-1 pb-2">
						<div className="flex items-center gap-2">
							<button
								type="button"
								className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-3 text-xs text-slate-200 transition hover:border-sky-400/50 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
								onClick={handlePickFiles}
								aria-label="Add files"
							>
								<FiPaperclip className="h-4 w-4" />
								<span className="hidden sm:inline">Files</span>
							</button>
							<button
								type="button"
								aria-pressed={recording}
								aria-label={recording ? "Stop recording" : "Record audio"}
								className={`relative flex h-10 w-10 items-center justify-center rounded-xl border text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${recording
									? "border-rose-400/60 bg-rose-500/20 text-rose-100"
									: "border-white/10 bg-slate-900/70 text-slate-100 hover:border-sky-400/50 hover:text-sky-100"
									}`}
								style={audioGlow ? { boxShadow: audioGlow } : undefined}
								onClick={recording ? stopRecording : startRecording}
								disabled={isStreaming}
							>
								{recording ? <FiStopCircle size={16} /> : <FiMic size={16} />}
								{recording ? (
									<span className="pointer-events-none absolute inset-0 rounded-xl border border-rose-400/40 animate-ping" />
								) : null}
							</button>
						</div>
						<span className="px-1 text-[11px] text-slate-400">
							{recording
								? `Recording ${formatDuration(recordingDuration)}`
								: isStreaming
									? queuedPromptCount > 0
										? `Streaming response... ${queuedPromptCount} queued`
										: "Streaming response... Enter to queue follow-up"
									: "Enter to send, Shift+Enter for newline"}
						</span>
					</div>
					<div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/55 pl-2 pr-1.5">
						<textarea
							ref={composerTextareaRef}
							id="prompt-textarea"
							className="min-h-[44px] max-h-40 min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-[10px] text-sm leading-6 text-slate-100 placeholder:text-slate-400 focus:outline-none"
							rows={1}
							value={prompt}
							onChange={(event) => onPromptChange(event.target.value)}
							onKeyDown={handleKeyDown}
							onPaste={handlePaste}
							placeholder="Ask Wingman to do something..."
							style={{ overflowY: "hidden" }}
						/>
						<button
							className={`my-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-40 ${canStop
								? "border-rose-400/60 bg-rose-500/20 text-rose-100 hover:border-rose-300/80"
								: "border-sky-400/60 bg-gradient-to-br from-cyan-400 to-blue-500 text-white hover:from-cyan-300 hover:to-blue-400"
								}`}
							onClick={canStop ? onStopPrompt : onSendPrompt}
							type="button"
							aria-label={canStop ? "Stop response" : "Send prompt"}
							title={canStop ? "Stop response" : "Send prompt"}
							disabled={canStop ? false : !canSend}
						>
							{canStop ? (
								<FiStopCircle className="h-5 w-5" />
							) : (
								<FiSend className="h-4 w-4" />
							)}
						</button>
					</div>
					<input
						ref={fileInputRef}
						type="file"
						accept={fileAccept}
						multiple
						className="hidden"
						onChange={handleFileChange}
					/>
				</div>
			</>
			{previewAttachment
				? (() => {
					const previewModal = (
						// biome-ignore lint/a11y/useSemanticElements: modal overlay backdrop requires grid layout for centering
						<div
							role="button"
							tabIndex={0}
							className="fixed inset-0 z-[120] grid place-items-center bg-black/70 p-6"
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
					);

					if (typeof document !== "undefined") {
						return createPortal(previewModal, document.body);
					}
					return previewModal;
				})()
				: null}
		</section>
	);
};

export function computeComposerTextareaLayout({
	scrollHeight,
	lineHeight,
	paddingTop,
	paddingBottom,
	maxLines,
}: {
	scrollHeight: number;
	lineHeight: number;
	paddingTop: number;
	paddingBottom: number;
	maxLines: number;
}): { heightPx: number; overflowY: "hidden" | "auto" } {
	const minHeight = lineHeight + paddingTop + paddingBottom;
	const maxHeight = lineHeight * maxLines + paddingTop + paddingBottom;
	const heightPx = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
	return {
		heightPx,
		overflowY: scrollHeight > maxHeight ? "auto" : "hidden",
	};
}

export function shouldRefocusComposer({
	wasStreaming,
	isStreaming,
}: {
	wasStreaming: boolean;
	isStreaming: boolean;
}): boolean {
	return wasStreaming && !isStreaming;
}

function normalizeMessageLineBreaks(value: string): string {
	if (!value) return value;
	return value
		.replace(/\r\n?/g, "\n")
		.replace(RETURN_SYMBOL_LINE_BREAK_PATTERN, "\n");
}

async function copyTextToClipboard(text: string): Promise<boolean> {
	if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			// fall through to legacy copy behavior
		}
	}

	if (typeof document === "undefined") {
		return false;
	}
	try {
		const textarea = document.createElement("textarea");
		textarea.value = text;
		textarea.setAttribute("readonly", "true");
		textarea.style.position = "absolute";
		textarea.style.left = "-9999px";
		document.body.appendChild(textarea);
		textarea.select();
		const didCopy = document.execCommand("copy");
		document.body.removeChild(textarea);
		return didCopy;
	} catch {
		return false;
	}
}

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

function isFileAttachment(attachment: ChatAttachment): boolean {
	if (attachment.kind === "file") return true;
	return typeof attachment.textContent === "string";
}

function formatFileMeta(attachment: ChatAttachment): string {
	const meta: string[] = [];
	if (attachment.mimeType) meta.push(attachment.mimeType);
	if (typeof attachment.size === "number")
		meta.push(formatBytes(attachment.size));
	return meta.length > 0 ? meta.join(" • ") : "Text extracted for model input";
}

function clipFilePreview(text: string): string {
	const trimmed = text.trim();
	if (trimmed.length <= 800) return trimmed;
	return `${trimmed.slice(0, 800)}\n…`;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function isLikelyAudioUrl(value: string): boolean {
	const url = value.trim();
	if (!url) return false;
	if (url.startsWith("data:audio/")) return true;

	let parsed: URL;
	try {
		parsed = new URL(url, "https://wingman.local");
	} catch {
		return false;
	}

	if (hasAudioFileExtension(parsed.pathname)) return true;

	for (const key of ["path", "file", "filename", "url"]) {
		const candidate = parsed.searchParams.get(key);
		if (candidate && hasAudioFileExtension(candidate)) {
			return true;
		}
	}

	for (const key of [
		"mime",
		"mimeType",
		"contentType",
		"type",
		"format",
		"modality",
		"mediaType",
	]) {
		const candidate = parsed.searchParams.get(key);
		if (!candidate) continue;
		const normalized = candidate.toLowerCase();
		if (normalized.includes("audio")) return true;
	}

	return false;
}

function hasAudioFileExtension(value: string): boolean {
	const normalized = value.toLowerCase();
	try {
		return AUDIO_FILE_EXTENSION_PATTERN.test(decodeURIComponent(normalized));
	} catch {
		return AUDIO_FILE_EXTENSION_PATTERN.test(normalized);
	}
}

function extractAssistantAudioPreviews(
	text: string,
	workingDirectory: string | null = null,
	maxItems = 3,
): Array<{ src: string; label?: string }> {
	if (!text.trim()) return [];

	const previews: Array<{ src: string; label?: string }> = [];
	const seen = new Set<string>();
	const matches = text.matchAll(AUDIO_REFERENCE_TOKEN_PATTERN);

	for (const match of matches) {
		const token = match[0];
		const candidate = normalizeAudioReferenceToken(token);
		if (!candidate) continue;
		if (!isLikelyAudioUrl(candidate)) continue;

		const src = resolveAssistantAudioPreviewSrc(candidate, workingDirectory);
		if (!src || seen.has(src)) continue;
		seen.add(src);
		previews.push({
			src,
			label: deriveAudioPreviewLabel(candidate),
		});
		if (previews.length >= maxItems) break;
	}

	return previews;
}

function normalizeAudioReferenceToken(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	const stripped = trimmed
		.replace(/^[([{<"']+/, "")
		.replace(/[)\]}>",;:!?]+$/, "");
	if (!stripped) return null;
	return stripped;
}

function resolveAssistantAudioPreviewSrc(
	value: string,
	workingDirectory: string | null = null,
): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (
		trimmed.startsWith("http://") ||
		trimmed.startsWith("https://") ||
		trimmed.startsWith("data:audio/") ||
		trimmed.startsWith("/api/fs/file?")
	) {
		return trimmed;
	}

	const resolvedPath =
		workingDirectory && isRelativeFilesystemPath(trimmed)
			? joinWorkingDirectoryPath(workingDirectory, trimmed)
			: trimmed;
	return `/api/fs/file?path=${encodeURIComponent(resolvedPath)}`;
}

function deriveAudioPreviewLabel(value: string): string | undefined {
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	const parts = trimmed.split(/[\\/]/);
	return parts.length > 0 ? parts[parts.length - 1] : undefined;
}

function isRelativeFilesystemPath(value: string): boolean {
	if (!value) return false;
	if (value.startsWith("/")) return false;
	if (value.startsWith("~/")) return false;
	if (/^[a-zA-Z]:[\\/]/.test(value)) return false;
	return true;
}

function joinWorkingDirectoryPath(basePath: string, relativePath: string): string {
	const base = basePath.trim();
	const relative = relativePath
		.trim()
		.replace(/^(\.\/|\.\\)+/, "")
		.replace(/^[/\\]+/, "");
	if (!base) return relativePath.trim();
	if (!relative) return base;

	const useBackslash = base.includes("\\") && !base.includes("/");
	if (useBackslash) {
		const normalizedBase = base.replace(/[\\]+$/, "");
		const normalizedRelative = relative.replace(/[\\/]+/g, "\\");
		return `${normalizedBase}\\${normalizedRelative}`;
	}

	const normalizedBase = base.replace(/[\\/]+$/, "");
	const normalizedRelative = relative.replace(/[\\]+/g, "/");
	return `${normalizedBase}/${normalizedRelative}`;
}
