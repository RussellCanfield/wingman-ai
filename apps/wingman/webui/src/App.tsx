import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useLocation } from "react-router-dom";
import { FiMenu, FiX } from "react-icons/fi";
import type {
	ChatAttachment,
	ChatMessage,
	ControlUiConfig,
	GatewayHealth,
	GatewayMessage,
	GatewayStats,
	AgentSummary,
	AgentsResponse,
	AgentDetail,
	ProviderStatus,
	ProviderStatusResponse,
	AgentVoiceConfig,
	PromptTrainingConfig,
	VoiceConfig,
	ToolEvent,
	ThinkingEvent,
	Thread,
	Routine,
	Webhook,
} from "./types";
import { parseStreamEvents } from "./utils/streaming";
import type { VoicePlaybackStatus } from "./utils/voicePlayback";
import { Sidebar } from "./components/Sidebar";
import { HeroPanel } from "./components/HeroPanel";
import { ChatPage } from "./pages/ChatPage";
import { CommandDeckPage } from "./pages/CommandDeckPage";
import { AgentsPage } from "./pages/AgentsPage";
import { RoutinesPage } from "./pages/RoutinesPage";
import { WebhooksPage } from "./pages/WebhooksPage";
import { buildRoutineAgents } from "./utils/agentOptions";
import {
	FILE_INPUT_ACCEPT,
	isPdfUploadFile,
	isSupportedTextUploadFile,
	readUploadFileText,
} from "./utils/fileUpload";
import { resolveSpeechVoice, resolveVoiceConfig, sanitizeForSpeech } from "./utils/voice";
import { shouldAutoSpeak } from "./utils/voiceAuto";
import wingmanIcon from "./assets/wingman_icon.webp";
import wingmanLogo from "./assets/wingman_logo.webp";

const DEFAULT_VOICE_CONFIG: VoiceConfig = {
	provider: "web_speech",
	defaultPolicy: "off",
	webSpeech: {},
	elevenlabs: {},
};

const DEFAULT_CONFIG: ControlUiConfig = {
	gatewayHost: "127.0.0.1",
	gatewayPort: 18789,
	requireAuth: false,
	outputRoot: "",
	dynamicUiEnabled: true,
	voice: DEFAULT_VOICE_CONFIG,
	agents: [],
};

const TOKEN_KEY = "wingman_webui_token";
const PASSWORD_KEY = "wingman_webui_password";
const DEVICE_KEY = "wingman_webui_device";
const AUTO_CONNECT_KEY = "wingman_webui_autoconnect";
const DEFAULT_THREAD_NAME = "New Thread";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_PDF_BYTES = 12 * 1024 * 1024;
const MAX_FILE_TEXT_CHARS = 40_000;
const MAX_ATTACHMENTS = 6;

type AgentEditorSubAgentPayload = {
	id: string;
	description?: string;
	model?: string;
	tools: string[];
	prompt: string;
	promptTraining?: PromptTrainingConfig | boolean | null;
};

export const App: React.FC = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [config, setConfig] = useState<ControlUiConfig>(DEFAULT_CONFIG);
	const [agentId, setAgentId] = useState<string>("main");
	const [wsUrl, setWsUrl] = useState<string>("");
	const [token, setToken] = useState<string>("");
	const [password, setPassword] = useState<string>("");
	const [autoConnect, setAutoConnect] = useState<boolean>(true);
	const [deviceId, setDeviceId] = useState<string>("");
	const [connected, setConnected] = useState<boolean>(false);
	const [connecting, setConnecting] = useState<boolean>(false);
	const [prompt, setPrompt] = useState<string>("");
	const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
	const [attachmentError, setAttachmentError] = useState<string>("");
	const [eventLog, setEventLog] = useState<string[]>([]);
	const [health, setHealth] = useState<GatewayHealth>({});
	const [stats, setStats] = useState<GatewayStats>({});
	const [isStreaming, setIsStreaming] = useState<boolean>(false);
	const [threads, setThreads] = useState<Thread[]>([]);
	const [activeThreadId, setActiveThreadId] = useState<string>("");
	const [loadingThreads, setLoadingThreads] = useState<boolean>(false);
	const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null);
	const [providers, setProviders] = useState<ProviderStatus[]>([]);
	const [providersLoading, setProvidersLoading] = useState<boolean>(false);
	const [providersUpdatedAt, setProvidersUpdatedAt] = useState<string | undefined>();
	const [credentialsPath, setCredentialsPath] = useState<string | undefined>();
	const [agentCatalog, setAgentCatalog] = useState<AgentSummary[]>([]);
	const [availableTools, setAvailableTools] = useState<string[]>([]);
	const [builtInTools, setBuiltInTools] = useState<string[]>([]);
	const [agentsLoading, setAgentsLoading] = useState<boolean>(false);
	const [routines, setRoutines] = useState<Routine[]>([]);
	const [routinesLoading, setRoutinesLoading] = useState<boolean>(false);
	const [autoConnectStatus, setAutoConnectStatus] = useState<string>("");
	const [webhooks, setWebhooks] = useState<Webhook[]>([]);
	const [webhooksLoading, setWebhooksLoading] = useState<boolean>(false);
	const [voiceSessions, setVoiceSessions] = useState<Record<string, boolean>>({});
	const [voicePlayback, setVoicePlayback] = useState<{
		status: VoicePlaybackStatus;
		messageId?: string;
	}>({ status: "idle" });
	const dynamicUiEnabled = config.dynamicUiEnabled !== false;

	const wsRef = useRef<WebSocket | null>(null);
	const connectRequestIdRef = useRef<string | null>(null);
	const buffersRef = useRef<Map<string, string>>(new Map());
	const thinkingBuffersRef = useRef<Map<string, Map<string, string>>>(new Map());
	const requestThreadRef = useRef<Map<string, string>>(new Map());
	const requestAgentRef = useRef<Map<string, string>>(new Map());
	const uiOnlyRequestsRef = useRef<Set<string>>(new Set());
	const uiFallbackRef = useRef<Map<string, string>>(new Map());
	const subscribedSessionsRef = useRef<Set<string>>(new Set());
	const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
	const voiceUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
	const voiceAbortRef = useRef<AbortController | null>(null);
	const voiceRequestIdRef = useRef<string | null>(null);
	const spokenMessagesRef = useRef<Map<string, Set<string>>>(new Map());
	const autoConnectAttemptsRef = useRef<number>(0);
	const autoConnectTimerRef = useRef<number | null>(null);
	const autoConnectFailureRef = useRef<boolean>(false);

	const agentOptions = useMemo(
		() =>
			buildRoutineAgents({
				catalog: agentCatalog,
				configAgents: config.agents,
			}),
		[agentCatalog, config.agents],
	);

	const subagentMap = useMemo(() => {
		const map = new Map<string, Set<string>>();
		for (const agent of agentCatalog) {
			const set = new Set<string>();
			for (const subagent of agent.subAgents || []) {
				if (subagent.id) set.add(normalizeName(subagent.id));
				if (subagent.displayName) set.add(normalizeName(subagent.displayName));
			}
			map.set(agent.id, set);
		}
		return map;
	}, [agentCatalog]);

	const agentVoiceMap = useMemo(() => {
		const map = new Map<string, AgentVoiceConfig | undefined>();
		for (const agent of agentCatalog) {
			map.set(agent.id, agent.voice);
		}
		return map;
	}, [agentCatalog]);

	const activeThread = useMemo(() => {
		return threads.find((thread) => thread.id === activeThreadId) || threads[0];
	}, [activeThreadId, threads]);

	const currentAgentId = activeThread?.agentId || agentId;

	useEffect(() => {
		setAttachments([]);
		setAttachmentError("");
	}, [activeThreadId]);

	const logEvent = useCallback((message: string) => {
		setEventLog((prev) => {
			const next = [message, ...prev];
			return next.slice(0, 25);
		});
	}, []);

	const formatDuration = (ms?: number) => {
		if (!ms && ms !== 0) return "--";
		const totalSeconds = Math.floor(ms / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		if (hours > 0) return `${hours}h ${minutes}m`;
		if (minutes > 0) return `${minutes}m ${seconds}s`;
		return `${seconds}s`;
	};

	const refreshStats = useCallback(async () => {
		try {
			const [healthRes, statsRes] = await Promise.all([
				fetch("/api/health"),
				fetch("/api/stats"),
			]);
			if (healthRes.ok) {
				setHealth((await healthRes.json()) as GatewayHealth);
			}
			if (statsRes.ok) {
				setStats((await statsRes.json()) as GatewayStats);
			}
		} catch {
			logEvent("Failed to refresh gateway stats");
		}
	}, [logEvent]);

	const refreshProviders = useCallback(async () => {
		setProvidersLoading(true);
		try {
			const res = await fetch("/api/providers");
			if (!res.ok) {
				logEvent("Failed to load providers");
				return;
			}
			const data = (await res.json()) as ProviderStatusResponse;
			setProviders(data.providers || []);
			setProvidersUpdatedAt(data.updatedAt);
			setCredentialsPath(data.credentialsPath);
		} catch {
			logEvent("Failed to load providers");
		} finally {
			setProvidersLoading(false);
		}
	}, [logEvent]);

	const fetchThreads = useCallback(async () => {
		setLoadingThreads(true);
		try {
			const res = await fetch("/api/sessions?limit=100");
			if (!res.ok) {
				logEvent("Failed to load sessions");
				return;
			}
			const data = (await res.json()) as Array<{
				id: string;
				name: string;
				agentId: string;
				createdAt: number;
				updatedAt?: number;
				messageCount?: number;
				lastMessagePreview?: string;
				workdir?: string | null;
			}>;
			setThreads((prev) => {
				const mapped = data.map((session) => mapSessionToThread(session));
				return mapped.map((thread) => {
					const existing = prev.find((item) => item.id === thread.id);
					if (existing?.messagesLoaded) {
						return {
							...thread,
							messages: existing.messages,
							messagesLoaded: true,
							toolEvents: existing.toolEvents || [],
							thinkingEvents: existing.thinkingEvents || [],
						};
					}
					return thread;
				});
			});
			if (data.length > 0) {
				setActiveThreadId((prev) =>
					data.find((t) => t.id === prev) ? prev : data[0].id,
				);
			}
		} catch {
			logEvent("Failed to load sessions");
		} finally {
			setLoadingThreads(false);
		}
	}, [logEvent]);

	const loadThreadMessages = useCallback(
		async (thread: Thread) => {
			if (thread.messagesLoaded) return;
			setLoadingThreadId(thread.id);
			try {
				const params = new URLSearchParams({
					agentId: thread.agentId,
				});
				const res = await fetch(`/api/sessions/${encodeURIComponent(thread.id)}/messages?${params.toString()}`);
				if (!res.ok) {
					logEvent("Failed to load session messages");
					return;
				}
				const data = (await res.json()) as ChatMessage[];
				setThreads((prev) =>
					prev.map((item) =>
						item.id === thread.id
							? {
								...item,
								messages: data,
								messagesLoaded: true,
								messageCount: data.length,
							}
							: item,
						),
				);
			} catch {
				logEvent("Failed to load session messages");
			} finally {
				setLoadingThreadId(null);
			}
		},
		[logEvent],
	);

	const addAttachments = useCallback(async (files: FileList | File[] | null) => {
		setAttachmentError("");
		if (!files || files.length === 0) return;
		const selected = Array.from(files);
		const next: ChatAttachment[] = [];
		let warningMessage = "";

		for (const file of selected) {
			const isImage = file.type.startsWith("image/");
			const isAudio = file.type.startsWith("audio/");
			const isPdf = isPdfUploadFile(file);
			const isTextFile = isSupportedTextUploadFile(file);

			if (!isImage && !isAudio && !isPdf && !isTextFile) {
				setAttachmentError(
					"Unsupported file type. Allowed: images, audio, PDF, text, markdown, JSON, YAML, XML, logs, and common code files.",
				);
				continue;
			}

			if (isImage || isAudio) {
				const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;
				if (file.size > maxBytes) {
					setAttachmentError(
						isImage
							? "Image is too large. Max size is 8MB."
							: "Audio is too large. Max size is 20MB.",
					);
					continue;
				}
				const dataUrl = await readFileAsDataUrl(file);
				next.push({
					id: createAttachmentId(),
					kind: isAudio ? "audio" : "image",
					dataUrl,
					name: file.name,
					mimeType: file.type,
					size: file.size,
				});
				continue;
			}

			const maxBytes = isPdf ? MAX_PDF_BYTES : MAX_FILE_BYTES;
			if (file.size > maxBytes) {
				setAttachmentError(
					isPdf
						? "PDF is too large. Max size is 12MB."
						: "Text/code file is too large. Max size is 2MB.",
				);
				continue;
			}

			const { textContent, truncated, usedPdfFallback } = await readUploadFileText(
				file,
				MAX_FILE_TEXT_CHARS,
			);
			if (!textContent.trim()) {
				setAttachmentError("Unable to read file contents.");
				continue;
			}

			if (truncated) {
				warningMessage =
					"One or more files were truncated before upload to keep prompts manageable.";
			}
			if (usedPdfFallback) {
				warningMessage =
					"One or more PDFs could not be text-extracted locally. Wingman will use native PDF support when available and a fallback note otherwise.";
			}

			const fileDataUrl = isPdf ? await readFileAsDataUrl(file) : "";

			next.push({
				id: createAttachmentId(),
				kind: "file",
				dataUrl: fileDataUrl,
				textContent,
				name: file.name,
				mimeType: file.type || (isPdf ? "application/pdf" : "text/plain"),
				size: file.size,
			});
		}

		setAttachments((prev) => {
			const combined = [...prev, ...next];
			if (combined.length > MAX_ATTACHMENTS) {
				setAttachmentError(`Limit is ${MAX_ATTACHMENTS} attachments per message.`);
				return combined.slice(0, MAX_ATTACHMENTS);
			}
			if (warningMessage) {
				setAttachmentError(warningMessage);
			}
			return combined;
		});
	}, []);

	const removeAttachment = useCallback((id: string) => {
		setAttachments((prev) => prev.filter((item) => item.id !== id));
	}, []);

	const clearAttachments = useCallback(() => {
		setAttachments([]);
		setAttachmentError("");
	}, []);

	const isVoiceAutoEnabled = useCallback(
		(threadId: string) => {
			const stored = voiceSessions[threadId];
			if (stored !== undefined) return stored;
			return (config.voice?.defaultPolicy || "off") === "auto";
		},
		[config.voice?.defaultPolicy, voiceSessions],
	);
	const isVoiceAutoEnabledRef = useRef(isVoiceAutoEnabled);
	useEffect(() => {
		isVoiceAutoEnabledRef.current = isVoiceAutoEnabled;
	}, [isVoiceAutoEnabled]);

	const toggleVoiceAuto = useCallback(
		(threadId: string) => {
			setVoiceSessions((prev) => {
				const current =
					prev[threadId] ??
					((config.voice?.defaultPolicy || "off") === "auto");
				return { ...prev, [threadId]: !current };
			});
		},
		[config.voice?.defaultPolicy],
	);

	const stopVoicePlayback = useCallback(() => {
		voiceRequestIdRef.current = null;
		if (voiceAbortRef.current) {
			voiceAbortRef.current.abort();
			voiceAbortRef.current = null;
		}
		if (voiceAudioRef.current) {
			if (voiceAudioRef.current.src.startsWith("blob:")) {
				URL.revokeObjectURL(voiceAudioRef.current.src);
			}
			voiceAudioRef.current.pause();
			voiceAudioRef.current.src = "";
			voiceAudioRef.current = null;
		}
		if (voiceUtteranceRef.current) {
			if ("speechSynthesis" in window) {
				window.speechSynthesis.cancel();
			}
			voiceUtteranceRef.current = null;
		}
		setVoicePlayback({ status: "idle" });
	}, []);

	const speakVoice = useCallback(
		async (input: {
			messageId: string;
			text: string;
			agentId?: string;
		}) => {
			const { messageId, text, agentId } = input;
			const cleaned = sanitizeForSpeech(text);
			if (!cleaned) return;
			const resolved = resolveVoiceConfig(config.voice, agentId ? agentVoiceMap.get(agentId) : undefined);

			stopVoicePlayback();
			const requestId = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			voiceRequestIdRef.current = requestId;
			setVoicePlayback({ status: "pending", messageId });

			const isStale = () => voiceRequestIdRef.current !== requestId;

			if (resolved.provider === "web_speech") {
				if (!("speechSynthesis" in window)) {
					logEvent("Speech synthesis is not supported in this browser.");
					if (!isStale()) {
						setVoicePlayback({ status: "idle" });
					}
					return;
				}
				const utterance = new SpeechSynthesisUtterance(cleaned);
				const voice = resolveSpeechVoice(resolved.webSpeech.voiceName, resolved.webSpeech.lang);
				if (voice) {
					utterance.voice = voice;
				}
				if (resolved.webSpeech.lang) {
					utterance.lang = resolved.webSpeech.lang;
				}
				if (typeof resolved.webSpeech.rate === "number") {
					utterance.rate = resolved.webSpeech.rate;
				}
				if (typeof resolved.webSpeech.pitch === "number") {
					utterance.pitch = resolved.webSpeech.pitch;
				}
				if (typeof resolved.webSpeech.volume === "number") {
					utterance.volume = resolved.webSpeech.volume;
				}
				utterance.onend = () => {
					if (!isStale()) {
						setVoicePlayback({ status: "idle" });
					}
				};
				utterance.onerror = () => {
					logEvent("Voice playback failed.");
					if (!isStale()) {
						setVoicePlayback({ status: "idle" });
					}
				};
				voiceUtteranceRef.current = utterance;
				if (!isStale()) {
					setVoicePlayback({ status: "playing", messageId });
				}
				window.speechSynthesis.speak(utterance);
				return;
			}

			if (resolved.provider === "elevenlabs") {
				if (!resolved.elevenlabs.voiceId) {
					logEvent("ElevenLabs voiceId is not configured.");
					if (!isStale()) {
						setVoicePlayback({ status: "idle" });
					}
					return;
				}
				if (isStale()) return;
				const controller = new AbortController();
				voiceAbortRef.current = controller;
				setVoicePlayback({ status: "loading", messageId });
				try {
					const res = await fetch("/api/voice/speak", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							text: cleaned,
							agentId,
						}),
						signal: controller.signal,
					});
					if (!res.ok) {
						const errorText = await res.text();
						logEvent(`Voice request failed: ${errorText || res.statusText}`);
						if (!isStale()) {
							setVoicePlayback({ status: "idle" });
						}
						return;
					}
					const blob = await res.blob();
					if (isStale()) {
						return;
					}
					const url = URL.createObjectURL(blob);
					const audio = new Audio(url);
					voiceAudioRef.current = audio;
					audio.onended = () => {
						URL.revokeObjectURL(url);
						if (!isStale()) {
							setVoicePlayback({ status: "idle" });
						}
					};
					audio.onerror = () => {
						URL.revokeObjectURL(url);
						logEvent("Voice playback failed.");
						if (!isStale()) {
							setVoicePlayback({ status: "idle" });
						}
					};
					const playPromise = audio.play();
					if (playPromise) {
						await playPromise;
					}
					if (!isStale()) {
						setVoicePlayback({ status: "playing", messageId });
					}
				} catch (error) {
					if ((error as Error)?.name !== "AbortError") {
						logEvent("Voice playback failed.");
					}
					if (!isStale()) {
						setVoicePlayback({ status: "idle" });
					}
				} finally {
					if (voiceAbortRef.current === controller) {
						voiceAbortRef.current = null;
					}
				}
			}

			logEvent("Voice provider is not supported.");
			if (!isStale()) {
				setVoicePlayback({ status: "idle" });
			}
		},
		[agentVoiceMap, config.voice, logEvent, stopVoicePlayback],
	);
	const speakVoiceRef = useRef(speakVoice);
	useEffect(() => {
		speakVoiceRef.current = speakVoice;
	}, [speakVoice]);

	const activeVoiceAutoEnabled = activeThread
		? isVoiceAutoEnabled(activeThread.id)
		: false;

	const handleToggleVoiceAuto = useCallback(() => {
		if (!activeThread) return;
		const next = !isVoiceAutoEnabled(activeThread.id);
		toggleVoiceAuto(activeThread.id);
		if (!next) {
			stopVoicePlayback();
		}
	}, [activeThread, isVoiceAutoEnabled, stopVoicePlayback, toggleVoiceAuto]);

	const handleSpeakVoice = useCallback(
		(messageId: string, text: string) => {
			if (!activeThread) return;
			void speakVoice({
				messageId,
				text,
				agentId: activeThread.agentId,
			});
		},
		[activeThread, speakVoice],
	);

	const handleStopVoice = useCallback(() => {
		stopVoicePlayback();
	}, [stopVoicePlayback]);

	useEffect(() => {
		stopVoicePlayback();
	}, [activeThreadId, stopVoicePlayback]);

const updateAssistant = useCallback((requestId: string, text: string) => {
		const threadId = requestThreadRef.current.get(requestId);
		if (!threadId) return;
		if (uiOnlyRequestsRef.current.has(requestId)) {
			return;
		}
		setThreads((prev) =>
			prev.map((thread) =>
				thread.id === threadId
					? {
						...thread,
						messages: thread.messages.map((msg) =>
							msg.id === requestId ? { ...msg, content: text } : msg,
						),
					}
					: thread,
			),
		);
	}, []);

	const updateToolEvents = useCallback((requestId: string, events: ToolEvent[]) => {
		const threadId = requestThreadRef.current.get(requestId);
		if (!threadId || events.length === 0) return;

		setThreads((prev) =>
			prev.map((thread) => {
				if (thread.id !== threadId) return thread;
				const messages = thread.messages.map((msg) => {
					if (msg.id !== requestId) return msg;
					const existing = msg.toolEvents ? [...msg.toolEvents] : [];
					const uiBlocks = msg.uiBlocks ? [...msg.uiBlocks] : [];
					let clearContent = false;
					for (const event of events) {
						if (event.uiOnly && dynamicUiEnabled) {
							uiOnlyRequestsRef.current.add(requestId);
							clearContent = true;
						}
						if (event.textFallback) {
							uiFallbackRef.current.set(requestId, event.textFallback);
						}
						const index = existing.findIndex((item) => item.id === event.id);
						if (index >= 0) {
							const resolvedName =
								event.name && event.name !== "tool"
									? event.name
									: existing[index].name;
							existing[index] = {
								...existing[index],
								...event,
								name: resolvedName,
								startedAt: existing[index].startedAt || event.timestamp,
								completedAt:
									event.status === "completed" || event.status === "error"
										? event.timestamp
										: existing[index].completedAt,
							};
						} else {
							existing.push({
								id: event.id,
								name: event.name,
								args: event.args,
								status: event.status,
								output: event.output,
								ui: event.ui,
								uiOnly: event.uiOnly,
								textFallback: event.textFallback,
								error: event.error,
								startedAt: event.timestamp,
								completedAt:
									event.status === "completed" || event.status === "error"
										? event.timestamp
										: undefined,
							});
						}
						if (event.ui && dynamicUiEnabled) {
							const existingBlock = uiBlocks.find((block) => block.id === event.id);
							if (!existingBlock) {
								uiBlocks.push({
									id: event.id,
									spec: event.ui,
									uiOnly: event.uiOnly,
									textFallback: event.textFallback,
								});
							} else {
								existingBlock.spec = event.ui;
								existingBlock.uiOnly = event.uiOnly;
								existingBlock.textFallback = event.textFallback;
							}
						}
					}
					return {
						...msg,
						content: clearContent ? "" : msg.content,
						toolEvents: existing,
						uiBlocks: dynamicUiEnabled ? uiBlocks : msg.uiBlocks,
						uiTextFallback:
							uiFallbackRef.current.get(requestId) ?? msg.uiTextFallback,
					};
				});
				return {
					...thread,
					messages,
				};
			}),
		);
	}, [dynamicUiEnabled]);

	const updateThinkingEvents = useCallback(
		(requestId: string, events: ThinkingEvent[]) => {
			const threadId = requestThreadRef.current.get(requestId);
			if (!threadId || events.length === 0) return;

			setThreads((prev) =>
				prev.map((thread) => {
					if (thread.id !== threadId) return thread;
					const messages = thread.messages.map((msg) => {
						if (msg.id !== requestId) return msg;
						const existing = msg.thinkingEvents ? [...msg.thinkingEvents] : [];
						for (const event of events) {
							const index = existing.findIndex((item) => item.id === event.id);
							if (index >= 0) {
								existing[index] = {
									...existing[index],
									...event,
								};
							} else {
								existing.push(event);
							}
						}
						return { ...msg, thinkingEvents: existing };
					});
					return {
						...thread,
						messages,
					};
				}),
			);
		},
		[],
	);

	const finalizeAssistant = useCallback((requestId: string, fallback?: string) => {
		const threadId = requestThreadRef.current.get(requestId);
		if (!threadId) return;
		const uiFallback = uiFallbackRef.current.get(requestId);
		const resolvedFallback = uiFallback || fallback || "";
		const finalText = buffersRef.current.get(requestId) || resolvedFallback || "";
		const spoken = spokenMessagesRef.current.get(threadId) || new Set<string>();
		if (
			shouldAutoSpeak({
				text: finalText,
				enabled: isVoiceAutoEnabledRef.current(threadId),
				spokenMessages: spoken,
				requestId,
			})
		) {
			spoken.add(requestId);
			spokenMessagesRef.current.set(threadId, spoken);
			const agentForRequest = requestAgentRef.current.get(requestId);
			void speakVoiceRef.current({
				messageId: requestId,
				text: finalText,
				agentId: agentForRequest,
			});
		}
		setThreads((prev) =>
			prev.map((thread) => {
				if (thread.id !== threadId) return thread;
				return {
					...thread,
					messages: thread.messages.map((msg) => {
						if (msg.id !== requestId) return msg;
						if (
							!msg.content &&
							resolvedFallback &&
							(!uiOnlyRequestsRef.current.has(requestId) || !dynamicUiEnabled)
						) {
							return { ...msg, content: resolvedFallback };
						}
						return msg;
					}),
				};
			}),
		);
		buffersRef.current.delete(requestId);
		thinkingBuffersRef.current.delete(requestId);
		requestThreadRef.current.delete(requestId);
		requestAgentRef.current.delete(requestId);
		uiOnlyRequestsRef.current.delete(requestId);
		uiFallbackRef.current.delete(requestId);
		setIsStreaming(false);
	}, [dynamicUiEnabled]);

	const handleAgentEvent = useCallback(
		(requestId: string, payload: any) => {
			if (!payload) return;
			const sessionId =
				typeof payload?.sessionId === "string" ? payload.sessionId : undefined;
			if (payload.type === "session-message" && payload.role === "user") {
				if (!sessionId) return;
				const now = Date.now();
				const rawAttachments = Array.isArray(payload.attachments)
					? payload.attachments
					: [];
				const mappedAttachments = rawAttachments
					.map((attachment: any) => {
						if (!attachment || typeof attachment !== "object") return null;
						const dataUrl =
							typeof attachment.dataUrl === "string" ? attachment.dataUrl : "";
						const textContent =
							typeof attachment.textContent === "string"
								? attachment.textContent
								: undefined;
						const mimeType =
							typeof attachment.mimeType === "string"
								? attachment.mimeType
								: undefined;
						const name =
							typeof attachment.name === "string" ? attachment.name : undefined;
						const size =
							typeof attachment.size === "number" ? attachment.size : undefined;
						const isAudio =
							attachment.kind === "audio" ||
							mimeType?.startsWith("audio/") ||
							dataUrl.startsWith("data:audio/");
						const isFile =
							attachment.kind === "file" ||
							(typeof textContent === "string" &&
								!isAudio &&
								!dataUrl.startsWith("data:image/"));
						if (isFile) {
							return {
								id: createAttachmentId(),
								kind: "file" as const,
								dataUrl,
								textContent: textContent || "",
								mimeType,
								name,
								size,
							};
						}
						if (!dataUrl) return null;
						return {
							id: createAttachmentId(),
							kind: isAudio ? "audio" : "image",
							dataUrl,
							mimeType,
							name,
							size,
						};
					})
					.filter(Boolean) as ChatAttachment[];
				const userMessage: ChatMessage = {
					id: `user-${requestId || now}`,
					role: "user",
					content: typeof payload.content === "string" ? payload.content : "",
					attachments:
						mappedAttachments.length > 0 ? mappedAttachments : undefined,
					createdAt: now,
				};
				const attachmentPreview =
					mappedAttachments.length > 0
						? buildAttachmentPreviewText(mappedAttachments)
						: "";
				setThreads((prev) => {
					const existing = prev.find((thread) => thread.id === sessionId);
					if (!existing) {
						const newThread: Thread = {
							id: sessionId,
							name: sessionId,
							agentId:
								typeof payload?.agentId === "string" ? payload.agentId : agentId,
							messages: [userMessage],
							toolEvents: [],
							thinkingEvents: [],
							createdAt: now,
							updatedAt: now,
							messageCount: 1,
							lastMessagePreview: (userMessage.content || attachmentPreview).slice(
								0,
								200,
							),
							messagesLoaded: false,
						};
						return [newThread, ...prev];
					}

					const hasMessage = existing.messages.some(
						(message) => message.id === userMessage.id,
					);
					if (hasMessage) {
						return prev;
					}

					return prev.map((thread) => {
						if (thread.id !== sessionId) return thread;
						return {
							...thread,
							messages: [...thread.messages, userMessage],
							messageCount: (thread.messageCount ?? thread.messages.length) + 1,
							lastMessagePreview: (userMessage.content || attachmentPreview).slice(
								0,
								200,
							),
							updatedAt: now,
						};
					});
				});
				return;
			}
			if (sessionId && !requestThreadRef.current.has(requestId)) {
				requestThreadRef.current.set(requestId, sessionId);
				if (typeof payload?.agentId === "string") {
					requestAgentRef.current.set(requestId, payload.agentId);
				}
				const now = Date.now();
				setThreads((prev) => {
					const existing = prev.find((thread) => thread.id === sessionId);
					const assistantMessage: ChatMessage = {
						id: requestId,
						role: "assistant",
						content: "",
						createdAt: now,
					};

					if (!existing) {
						const newThread: Thread = {
							id: sessionId,
							name: sessionId,
							agentId:
								typeof payload?.agentId === "string" ? payload.agentId : agentId,
							messages: [assistantMessage],
							toolEvents: [],
							thinkingEvents: [],
							createdAt: now,
							updatedAt: now,
							messageCount: 1,
							lastMessagePreview: "",
							messagesLoaded: false,
						};
						return [newThread, ...prev];
					}

					const hasMessage = existing.messages.some(
						(message) => message.id === requestId,
					);
					if (hasMessage) {
						return prev;
					}

					return prev.map((thread) => {
						if (thread.id !== sessionId) return thread;
						return {
							...thread,
							messages: [...thread.messages, assistantMessage],
							messageCount: (thread.messageCount ?? thread.messages.length) + 1,
							updatedAt: now,
						};
					});
				});
			}
			if (payload.type === "agent-start") {
				logEvent(`Agent started: ${payload.agent || "unknown"}`);
				return;
			}
			if (payload.type === "agent-stream") {
				const { textEvents, toolEvents } = parseStreamEvents(payload.chunk);
				const agentForRequest = requestAgentRef.current.get(requestId);
				const subagents =
					agentForRequest ? subagentMap.get(agentForRequest) : undefined;
				const assistantTexts: string[] = [];
				const thinkingUpdates: ThinkingEvent[] = [];

				for (const event of textEvents) {
					const nodeLabel = event.node?.trim();
					const normalizedNode = nodeLabel ? normalizeName(nodeLabel) : "";
					const isKnownSubagent =
						nodeLabel && subagents ? subagents.has(normalizedNode) : false;

					if (isKnownSubagent) {
						const buffer =
							thinkingBuffersRef.current.get(requestId) || new Map<string, string>();
						const previous = buffer.get(normalizedNode) || "";
						const next = mergeStreamText(previous, event.text);
						buffer.set(normalizedNode, next);
						thinkingBuffersRef.current.set(requestId, buffer);
						thinkingUpdates.push({
							id: `think-${requestId}-${normalizedNode}`,
							node: nodeLabel || "Subagent",
							content: next,
							updatedAt: Date.now(),
						});
					} else {
						assistantTexts.push(event.text);
					}
				}

				if (assistantTexts.length > 0) {
					const existing = buffersRef.current.get(requestId) || "";
					const next = assistantTexts.reduce(
						(acc, text) => mergeStreamText(acc, text),
						existing,
					);
					buffersRef.current.set(requestId, next);
					updateAssistant(requestId, next);
					setIsStreaming(true);
				}

				if (thinkingUpdates.length > 0) {
					updateThinkingEvents(requestId, thinkingUpdates);
					setIsStreaming(true);
				}

				if (toolEvents.length > 0) {
					updateToolEvents(requestId, toolEvents);
					if (toolEvents.some((event) => event.status === "running")) {
						setIsStreaming(true);
					}
				}
				return;
			}
			if (payload.type === "agent-complete") {
				logEvent("Agent complete");
				const fallback = buildAgentFallback(
					payload.result,
					requestId,
					uiOnlyRequestsRef.current,
				);
				finalizeAssistant(requestId, fallback);
				return;
			}
			if (payload.type === "agent-error") {
				logEvent(`Agent error: ${payload.error || "unknown"}`);
				finalizeAssistant(requestId, payload.error || "Agent error");
			}
		},
		[
			agentId,
			finalizeAssistant,
			logEvent,
			subagentMap,
			updateAssistant,
			updateThinkingEvents,
			updateToolEvents,
		],
	);

	const disconnect = useCallback(() => {
		if (autoConnectTimerRef.current) {
			window.clearTimeout(autoConnectTimerRef.current);
			autoConnectTimerRef.current = null;
		}
		autoConnectAttemptsRef.current = 0;
		autoConnectFailureRef.current = false;
		setAutoConnectStatus("");
		subscribedSessionsRef.current.clear();
		if (wsRef.current) {
			wsRef.current.close();
			wsRef.current = null;
		}
		setConnected(false);
		setConnecting(false);
		setIsStreaming(false);
	}, []);

	const connect = useCallback(() => {
		if (!wsUrl) {
			logEvent("Missing WebSocket URL");
			return;
		}
		if (autoConnectTimerRef.current) {
			window.clearTimeout(autoConnectTimerRef.current);
			autoConnectTimerRef.current = null;
		}
		autoConnectFailureRef.current = false;
		disconnect();
		setConnecting(true);

		localStorage.setItem(TOKEN_KEY, token);
		localStorage.setItem(PASSWORD_KEY, password);
		localStorage.setItem(AUTO_CONNECT_KEY, autoConnect ? "true" : "false");

		const ws = new WebSocket(wsUrl);
		wsRef.current = ws;

		ws.onopen = () => {
			const connectId = `connect-${Date.now()}`;
			connectRequestIdRef.current = connectId;
			const message: GatewayMessage = {
				type: "connect",
				id: connectId,
				client: {
					instanceId: `webui-${deviceId}`,
					clientType: "webui",
					version: "0.1",
				},
				auth: {
					token: token || undefined,
					password: password || undefined,
				},
				timestamp: Date.now(),
			};
			ws.send(JSON.stringify(message));
		};

		ws.onmessage = (event) => {
			let msg: GatewayMessage;
			try {
				msg = JSON.parse(event.data as string) as GatewayMessage;
			} catch {
				logEvent("Received invalid message");
				return;
			}

			if (msg.type === "res" && msg.id && msg.id === connectRequestIdRef.current) {
				if (msg.ok) {
					setConnected(true);
					setConnecting(false);
					autoConnectAttemptsRef.current = 0;
					setAutoConnectStatus("");
					logEvent("Gateway connected");
					refreshStats();
				} else {
					setConnected(false);
					setConnecting(false);
					logEvent("Gateway auth failed");
					setAutoConnect(false);
					setAutoConnectStatus("Auto-connect paused due to auth failure. Update credentials and connect manually.");
				}
				return;
			}

			if (msg.type === "event:agent" && msg.id) {
				handleAgentEvent(msg.id, msg.payload);
				return;
			}

			if (msg.type === "error") {
				logEvent(`Gateway error: ${msg.payload?.message || "unknown"}`);
			}
		};

		ws.onerror = () => {
			setConnected(false);
			setConnecting(false);
			setIsStreaming(false);
			logEvent("WebSocket error");
			autoConnectFailureRef.current = true;
		};

		ws.onclose = () => {
			setConnected(false);
			setConnecting(false);
			setIsStreaming(false);
			logEvent("Gateway disconnected");
			if (!autoConnect) return;
			if (!autoConnectFailureRef.current) return;
			autoConnectFailureRef.current = false;
			const maxRetries = 3;
			autoConnectAttemptsRef.current += 1;
			if (autoConnectAttemptsRef.current > maxRetries) {
				setAutoConnectStatus(
					"Auto-connect failed after 3 attempts. Please connect manually.",
				);
				return;
			}
			const attempt = autoConnectAttemptsRef.current;
			const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
			setAutoConnectStatus(
				`Retrying auto-connect in ${Math.round(delay / 1000)}s (attempt ${attempt} of ${maxRetries}).`,
			);
			autoConnectTimerRef.current = window.setTimeout(() => {
				if (autoConnect && !connected && !connecting) {
					connect();
				}
			}, delay);
		};
	}, [autoConnect, deviceId, disconnect, handleAgentEvent, logEvent, password, refreshStats, token, wsUrl]);

	const createThread = useCallback(
		async (targetAgentId: string, name?: string): Promise<Thread | null> => {
			const shortId =
				window.crypto?.randomUUID?.() ||
				`thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			const sessionId = `agent:${targetAgentId}:webui:thread:${shortId}`;
			try {
				const res = await fetch("/api/sessions", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						agentId: targetAgentId,
						sessionId,
						name,
					}),
				});
				if (!res.ok) {
					logEvent("Failed to create session");
					return null;
				}
				const session = (await res.json()) as {
					id: string;
					name: string;
					agentId: string;
					createdAt: number;
					updatedAt?: number;
					messageCount?: number;
					lastMessagePreview?: string;
					workdir?: string | null;
				};
				const thread = mapSessionToThread(session);
				setThreads((prev) => [thread, ...prev]);
				setActiveThreadId(thread.id);
				return thread;
			} catch {
				logEvent("Failed to create session");
				return null;
			}
		},
		[logEvent],
	);

	const sendPrompt = useCallback(async () => {
		if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
			logEvent("Connect to the gateway before sending prompts");
			return;
		}
		if (!prompt.trim() && attachments.length === 0) return;
		if (isStreaming) {
			logEvent("Wait for the current response to finish");
			return;
		}
		let targetThread: Thread | null | undefined = activeThread;
		if (!targetThread) {
			targetThread = await createThread(agentId, DEFAULT_THREAD_NAME);
			if (!targetThread) {
				logEvent("Unable to create a new thread");
				return;
			}
		}

		if (!targetThread.messagesLoaded && targetThread.messageCount) {
			await loadThreadMessages(targetThread);
		}

		const requestId = `req-${Date.now()}`;
		const now = Date.now();
		const userMessageText = prompt.trim();
		const attachmentPreview = buildAttachmentPreviewText(attachments);
		const userMessage: ChatMessage = {
			id: `user-${now}`,
			role: "user",
			content: userMessageText,
			attachments: attachments.length > 0 ? attachments : undefined,
			createdAt: now,
		};
		const assistantMessage: ChatMessage = {
			id: requestId,
			role: "assistant",
			content: "",
			createdAt: now,
		};
		setThreads((prev) =>
			prev.map((thread) =>
				thread.id === targetThread!.id
					? {
						...thread,
						name:
							thread.name === DEFAULT_THREAD_NAME
								? (userMessage.content || attachmentPreview).slice(0, 32)
								: thread.name,
						messages: [...thread.messages, userMessage, assistantMessage],
						messageCount: (thread.messageCount ?? thread.messages.length) + 1,
						lastMessagePreview: (userMessage.content || attachmentPreview).slice(0, 200),
						updatedAt: now,
						thinkingEvents: [],
					}
					: thread,
			),
		);
		setPrompt("");
		setAttachments([]);
		setAttachmentError("");
		setIsStreaming(true);
		requestThreadRef.current.set(requestId, targetThread.id);
		requestAgentRef.current.set(requestId, targetThread.agentId);

		const payload = {
			agentId: targetThread.agentId,
			content: userMessage.content,
			attachments: attachments.length > 0 ? attachments : undefined,
			routing: {
				channel: "webui",
				peer: { kind: "channel", id: deviceId },
			},
			sessionKey: targetThread.id,
		};

		const message: GatewayMessage = {
			type: "req:agent",
			id: requestId,
			payload,
			timestamp: Date.now(),
		};

		wsRef.current.send(JSON.stringify(message));
	}, [
		activeThread,
		agentId,
		attachments,
		createThread,
		deviceId,
		isStreaming,
		loadThreadMessages,
		logEvent,
		prompt,
	]);

	const clearChat = useCallback(async () => {
		if (!activeThread) return;
		if (isStreaming) {
			logEvent("Wait for the current response to finish");
			return;
		}
		stopVoicePlayback();
		try {
			const params = new URLSearchParams({ agentId: activeThread.agentId });
			const res = await fetch(
				`/api/sessions/${encodeURIComponent(activeThread.id)}/messages?${params.toString()}`,
				{ method: "DELETE" },
			);
			if (!res.ok) {
				logEvent("Failed to clear session messages");
				return;
			}
		} catch {
			logEvent("Failed to clear session messages");
			return;
		}

		setThreads((prev) =>
			prev.map((thread) =>
				thread.id === activeThread.id
					? {
						...thread,
						messages: [],
						messageCount: 0,
						lastMessagePreview: undefined,
						messagesLoaded: true,
						thinkingEvents: [],
					}
					: thread,
			),
		);
	}, [activeThread, isStreaming, logEvent, stopVoicePlayback]);

	const deleteThread = useCallback(
		async (threadId: string) => {
			if (isStreaming && activeThread?.id === threadId) {
				logEvent("Wait for the current response to finish");
				return;
			}
			const target = threads.find((thread) => thread.id === threadId);
			if (!target) return;
			try {
				const params = new URLSearchParams({ agentId: target.agentId });
				await fetch(`/api/sessions/${encodeURIComponent(threadId)}?${params.toString()}`, {
					method: "DELETE",
				});
			} catch {
				logEvent("Failed to delete session");
			}
			setThreads((prev) => prev.filter((thread) => thread.id !== threadId));
			setVoiceSessions((prev) => {
				if (!prev[threadId]) return prev;
				const next = { ...prev };
				delete next[threadId];
				return next;
			});
			spokenMessagesRef.current.delete(threadId);
			if (activeThreadId === threadId) {
				const remaining = threads.filter((thread) => thread.id !== threadId);
				setActiveThreadId(remaining[0]?.id || "");
				stopVoicePlayback();
			}
		},
		[activeThread?.id, activeThreadId, isStreaming, logEvent, stopVoicePlayback, threads],
	);

	const renameThread = useCallback(
		async (threadId: string) => {
			const target = threads.find((thread) => thread.id === threadId);
			if (!target) return;
			const nextName = window.prompt("Rename session", target.name);
			if (!nextName || !nextName.trim()) {
				return;
			}
			try {
				const params = new URLSearchParams({ agentId: target.agentId });
				const res = await fetch(
					`/api/sessions/${encodeURIComponent(threadId)}?${params.toString()}`,
					{
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ name: nextName.trim() }),
					},
				);
				if (!res.ok) {
					logEvent("Failed to rename session");
					return;
				}
				const updated = (await res.json()) as {
					name?: string;
					updatedAt?: number;
				};
				setThreads((prev) =>
					prev.map((thread) =>
						thread.id === threadId
							? {
								...thread,
								name: updated.name || nextName.trim(),
								updatedAt: updated.updatedAt ?? thread.updatedAt,
							}
							: thread,
					),
				);
			} catch {
				logEvent("Failed to rename session");
			}
		},
		[logEvent, threads],
	);

	const setThreadWorkdir = useCallback(
		async (threadId: string, workdir: string | null) => {
			const target = threads.find((thread) => thread.id === threadId);
			if (!target) return false;
			try {
				const params = new URLSearchParams({ agentId: target.agentId });
				const res = await fetch(
					`/api/sessions/${encodeURIComponent(threadId)}/workdir?${params.toString()}`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ workdir }),
					},
				);
				if (!res.ok) {
					logEvent("Failed to update working folder");
					return false;
				}
				const payload = (await res.json()) as { workdir?: string | null };
				setThreads((prev) =>
					prev.map((thread) =>
						thread.id === threadId
							? { ...thread, workdir: payload.workdir ?? null }
							: thread,
					),
				);
				return true;
			} catch {
				logEvent("Failed to update working folder");
				return false;
			}
		},
		[logEvent, threads],
	);

	const resetDevice = useCallback(() => {
		localStorage.removeItem(DEVICE_KEY);
		window.location.reload();
	}, []);

	const handleSelectThread = useCallback(
		(threadId: string) => {
			setActiveThreadId(threadId);
			const thread = threads.find((item) => item.id === threadId);
			if (thread && !thread.messagesLoaded && thread.messageCount) {
				void loadThreadMessages(thread);
			}
			if (thread) {
				setAgentId(thread.agentId);
			}
			navigate("/chat");
		},
		[loadThreadMessages, navigate, threads],
	);

	const handleCreateThread = useCallback(
		async (targetAgentId: string, name?: string) => {
			const thread = await createThread(targetAgentId, name);
			if (thread) {
				navigate("/chat");
			}
			return thread;
		},
		[createThread, navigate],
	);

	useEffect(() => {
		const storedToken = localStorage.getItem(TOKEN_KEY) || "";
		const storedPassword = localStorage.getItem(PASSWORD_KEY) || "";
		const storedAutoConnect = localStorage.getItem(AUTO_CONNECT_KEY);
		setToken(storedToken);
		setPassword(storedPassword);
		setAutoConnect(storedAutoConnect !== null ? storedAutoConnect === "true" : true);

		let existingDevice = localStorage.getItem(DEVICE_KEY) || "";
		if (!existingDevice) {
			existingDevice = `device-${
				window.crypto?.randomUUID?.().slice(0, 8) ||
				Math.random().toString(36).slice(2, 10)
			}`;
			localStorage.setItem(DEVICE_KEY, existingDevice);
		}
		setDeviceId(existingDevice);
	}, []);

	const refreshConfig = useCallback(async () => {
		try {
			const res = await fetch("/api/config");
			if (!res.ok) return;
			const data = (await res.json()) as ControlUiConfig;
			setConfig({
				...data,
				voice: data.voice || DEFAULT_VOICE_CONFIG,
			});
		} catch {
			logEvent("Failed to load gateway config");
		}
	}, [logEvent]);

	const updateVoiceConfig = useCallback(
		async (voice: Partial<VoiceConfig>) => {
			try {
				const res = await fetch("/api/voice", {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(voice),
				});
				if (!res.ok) {
					const message = await res.text();
					logEvent(`Failed to update voice config: ${message || "unknown error"}`);
					return false;
				}
				const data = (await res.json()) as { voice?: VoiceConfig };
				setConfig((prev) => ({
					...prev,
					voice: data.voice || prev.voice || DEFAULT_VOICE_CONFIG,
				}));
				logEvent("Updated voice configuration");
				return true;
			} catch {
				logEvent("Failed to update voice config");
				return false;
			}
		},
		[logEvent],
	);

	useEffect(() => {
		refreshConfig();
	}, [refreshConfig]);

	const refreshAgents = useCallback(async () => {
		setAgentsLoading(true);
		try {
			const res = await fetch("/api/agents");
			if (!res.ok) {
				logEvent("Failed to load agents");
				return;
			}
			const data = (await res.json()) as AgentsResponse;
			setAgentCatalog(data.agents || []);
			setAvailableTools(data.tools || []);
			setBuiltInTools(data.builtInTools || []);
		} catch {
			logEvent("Failed to load agents");
		} finally {
			setAgentsLoading(false);
		}
	}, [logEvent]);

	const refreshWebhooks = useCallback(async () => {
		setWebhooksLoading(true);
		try {
			const res = await fetch("/api/webhooks");
			if (!res.ok) {
				logEvent("Failed to load webhooks");
				return;
			}
			const data = (await res.json()) as Webhook[];
			setWebhooks(data || []);
		} catch {
			logEvent("Failed to load webhooks");
		} finally {
			setWebhooksLoading(false);
		}
	}, [logEvent]);

	const refreshRoutines = useCallback(async () => {
		setRoutinesLoading(true);
		try {
			const res = await fetch("/api/routines");
			if (!res.ok) {
				logEvent("Failed to load routines");
				return;
			}
			const data = (await res.json()) as Routine[];
			setRoutines(data || []);
		} catch {
			logEvent("Failed to load routines");
		} finally {
			setRoutinesLoading(false);
		}
	}, [logEvent]);

	const loadAgentDetail = useCallback(
		async (agentId: string): Promise<AgentDetail | null> => {
			try {
				const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}`);
				if (!res.ok) {
					logEvent(`Failed to load ${agentId} details`);
					return null;
				}
				return (await res.json()) as AgentDetail;
			} catch {
				logEvent(`Failed to load ${agentId} details`);
				return null;
			}
		},
		[logEvent],
	);

	useEffect(() => {
		const protocol = window.location.protocol === "https:" ? "wss" : "ws";
		const host = window.location.hostname || config.gatewayHost || "localhost";
		const resolved = `${protocol}://${host}:${config.gatewayPort}/ws`;
		setWsUrl(resolved);
	}, [config.gatewayHost, config.gatewayPort]);

	useEffect(() => {
		const defaultAgent =
			config.defaultAgentId ||
			config.agents.find((agent) => agent.default)?.id ||
			config.agents[0]?.id ||
			"main";
		setAgentId(defaultAgent);
	}, [config]);

	useEffect(() => {
		if (!autoConnect) return;
		if (connected || connecting) return;
		if (!wsUrl || !deviceId) return;
		connect();
	}, [autoConnect, connected, connecting, connect, deviceId, wsUrl]);

	useEffect(() => {
		localStorage.setItem(AUTO_CONNECT_KEY, autoConnect ? "true" : "false");
	}, [autoConnect]);

	useEffect(() => {
		if (autoConnect) return;
		if (autoConnectTimerRef.current) {
			window.clearTimeout(autoConnectTimerRef.current);
			autoConnectTimerRef.current = null;
		}
		autoConnectAttemptsRef.current = 0;
		autoConnectFailureRef.current = false;
		setAutoConnectStatus("");
	}, [autoConnect]);

	useEffect(() => {
		if (!connected) return;
		const ws = wsRef.current;
		if (!ws || ws.readyState !== WebSocket.OPEN) return;

		const nextSessions = new Set(threads.map((thread) => thread.id));

		for (const sessionId of nextSessions) {
			if (subscribedSessionsRef.current.has(sessionId)) continue;
			const message: GatewayMessage = {
				type: "session_subscribe",
				payload: { sessionId },
				timestamp: Date.now(),
			};
			ws.send(JSON.stringify(message));
			subscribedSessionsRef.current.add(sessionId);
		}

		for (const sessionId of Array.from(subscribedSessionsRef.current)) {
			if (nextSessions.has(sessionId)) continue;
			const message: GatewayMessage = {
				type: "session_unsubscribe",
				payload: { sessionId },
				timestamp: Date.now(),
			};
			ws.send(JSON.stringify(message));
			subscribedSessionsRef.current.delete(sessionId);
		}
	}, [connected, threads]);

	useEffect(() => {
		refreshStats();
		fetchThreads();
		refreshProviders();
		refreshAgents();
		refreshWebhooks();
		refreshRoutines();
	}, [
		fetchThreads,
		refreshAgents,
		refreshProviders,
		refreshStats,
		refreshWebhooks,
		refreshRoutines,
	]);

	useEffect(() => {
		if (threads.length === 0) return;
		if (!threads.find((thread) => thread.id === activeThreadId)) {
			setActiveThreadId(threads[0].id);
		}
	}, [activeThreadId, threads]);

	useEffect(() => {
		if (!activeThread) return;
		if (activeThread.messagesLoaded) return;
		void loadThreadMessages(activeThread);
	}, [activeThread, loadThreadMessages]);

	// Auto-close mobile drawer on route change
	useEffect(() => {
		setMobileMenuOpen(false);
	}, [location.pathname]);

	// Lock body scroll when drawer open
	useEffect(() => {
		if (mobileMenuOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => {
			document.body.style.overflow = "";
		};
	}, [mobileMenuOpen]);

	// Close drawer on escape key
	useEffect(() => {
		if (!mobileMenuOpen) return;

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setMobileMenuOpen(false);
			}
		};

		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [mobileMenuOpen]);

	// Close drawer when crossing desktop breakpoint
	useEffect(() => {
		const handleResize = () => {
			if (window.innerWidth >= 1024) {
				setMobileMenuOpen(false);
			}
		};
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	const statusLabel = connected ? "Connected" : connecting ? "Connecting" : "Disconnected";
	const authHint = config.requireAuth
		? "Auth required by gateway. Provide a token or password."
		: "Auth is not required for this gateway.";
	const hostLabel = `${config.gatewayHost}:${config.gatewayPort}`;

	const createAgent = useCallback(
		async (payload: {
			id: string;
			displayName?: string;
			description?: string;
			model?: string;
			tools: string[];
			prompt?: string;
			voice?: AgentVoiceConfig | null;
			promptTraining?: PromptTrainingConfig | boolean | null;
			subAgents?: AgentEditorSubAgentPayload[];
		}) => {
			try {
				const res = await fetch("/api/agents", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});
				if (!res.ok) {
					const message = await res.text();
					logEvent(`Failed to create agent: ${message || "unknown error"}`);
					return false;
				}
				await refreshAgents();
				await refreshConfig();
				logEvent(`Created agent: ${payload.id}`);
				return true;
			} catch {
				logEvent("Failed to create agent");
				return false;
			}
		},
		[logEvent, refreshAgents, refreshConfig],
	);

	const updateAgent = useCallback(
		async (
			agentId: string,
			payload: {
				displayName?: string;
				description?: string;
				model?: string;
				tools: string[];
				prompt?: string;
				voice?: AgentVoiceConfig | null;
				promptTraining?: PromptTrainingConfig | boolean | null;
				subAgents?: AgentEditorSubAgentPayload[];
			},
		) => {
			try {
				const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}`, {
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(payload),
				});
				if (!res.ok) {
					const message = await res.text();
					logEvent(`Failed to update agent: ${message || "unknown error"}`);
					return false;
				}
				await refreshAgents();
				await refreshConfig();
				logEvent(`Updated agent: ${agentId}`);
				return true;
			} catch {
				logEvent("Failed to update agent");
				return false;
			}
		},
		[logEvent, refreshAgents, refreshConfig],
	);

	const createRoutine = useCallback(
		async (routine: Omit<Routine, "id" | "createdAt">) => {
			try {
				const res = await fetch("/api/routines", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(routine),
				});
				if (!res.ok) {
					const message = await res.text();
					logEvent(`Failed to create routine: ${message || "unknown error"}`);
					return false;
				}
				await refreshRoutines();
				logEvent(`Created routine: ${routine.name}`);
				return true;
			} catch {
				logEvent("Failed to create routine");
				return false;
			}
		},
		[logEvent, refreshRoutines],
	);

	const deleteRoutine = useCallback(
		async (id: string) => {
			try {
				const res = await fetch(`/api/routines/${encodeURIComponent(id)}`, {
					method: "DELETE",
				});
				if (!res.ok) {
					const message = await res.text();
					logEvent(`Failed to delete routine: ${message || "unknown error"}`);
					return false;
				}
				await refreshRoutines();
				logEvent(`Deleted routine: ${id}`);
				return true;
			} catch {
				logEvent("Failed to delete routine");
				return false;
			}
		},
		[logEvent, refreshRoutines],
	);

	const createWebhook = useCallback(
		async (payload: Omit<Webhook, "createdAt" | "lastTriggeredAt">) => {
			try {
				const res = await fetch("/api/webhooks", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});
				if (!res.ok) {
					const message = await res.text();
					logEvent(`Failed to create webhook: ${message || "unknown error"}`);
					return false;
				}
				await refreshWebhooks();
				logEvent(`Created webhook: ${payload.id}`);
				return true;
			} catch {
				logEvent("Failed to create webhook");
				return false;
			}
		},
		[logEvent, refreshWebhooks],
	);

	const updateWebhook = useCallback(
		async (
			webhookId: string,
			payload: Partial<Omit<Webhook, "id" | "createdAt">>,
		) => {
			try {
				const res = await fetch(`/api/webhooks/${encodeURIComponent(webhookId)}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});
				if (!res.ok) {
					const message = await res.text();
					logEvent(`Failed to update webhook: ${message || "unknown error"}`);
					return false;
				}
				await refreshWebhooks();
				logEvent(`Updated webhook: ${webhookId}`);
				return true;
			} catch {
				logEvent("Failed to update webhook");
				return false;
			}
		},
		[logEvent, refreshWebhooks],
	);

	const deleteWebhook = useCallback(
		async (webhookId: string) => {
			try {
				const res = await fetch(`/api/webhooks/${encodeURIComponent(webhookId)}`, {
					method: "DELETE",
				});
				if (!res.ok) {
					const message = await res.text();
					logEvent(`Failed to delete webhook: ${message || "unknown error"}`);
					return false;
				}
				await refreshWebhooks();
				logEvent(`Deleted webhook: ${webhookId}`);
				return true;
			} catch {
				logEvent("Failed to delete webhook");
				return false;
			}
		},
		[logEvent, refreshWebhooks],
	);

	const testWebhook = useCallback(
		async (webhookId: string) => {
			const webhook = webhooks.find((item) => item.id === webhookId);
			if (!webhook) {
				return { ok: false, message: "Webhook not found" };
			}
			const testPayload =
				webhook.preset === "gog-gmail"
					? {
							event: "gmail.received",
							messages: [
								{
									id: "demo-message-id",
									from: "alerts@example.com",
									subject: "Test Gmail webhook",
									snippet: "Gog sent a Gmail event payload.",
									body: "This is a sample message body from gog gmail watch.",
								},
							],
						}
					: {
							event: "test",
							prompt: "Test webhook from Control UI.",
						};
			try {
				const res = await fetch(`/webhooks/${encodeURIComponent(webhookId)}`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-wingman-secret": webhook.secret,
					},
					body: JSON.stringify(testPayload),
				});
				if (!res.ok) {
					const message = await res.text();
					return { ok: false, message: message || "Test failed" };
				}
				return { ok: true };
			} catch {
				return { ok: false, message: "Test failed" };
			}
		},
		[webhooks],
	);

	const saveProviderToken = useCallback(
		async (providerName: string, tokenValue: string) => {
			try {
				const res = await fetch(`/api/providers/${encodeURIComponent(providerName)}`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ token: tokenValue }),
				});
				if (!res.ok) {
					logEvent(`Failed to save ${providerName} credentials`);
					return false;
				}
				logEvent(`Updated ${providerName} credentials`);
				await refreshProviders();
				return true;
			} catch {
				logEvent(`Failed to save ${providerName} credentials`);
				return false;
			}
		},
		[logEvent, refreshProviders],
	);

	const clearProviderToken = useCallback(
		async (providerName: string) => {
			try {
				const res = await fetch(`/api/providers/${encodeURIComponent(providerName)}`, {
					method: "DELETE",
				});
				if (!res.ok) {
					logEvent(`Failed to clear ${providerName} credentials`);
					return false;
				}
				logEvent(`Cleared ${providerName} credentials`);
				await refreshProviders();
				return true;
			} catch {
				logEvent(`Failed to clear ${providerName} credentials`);
				return false;
			}
		},
		[logEvent, refreshProviders],
	);

	return (
		<div className="relative min-h-screen">
			<div className="pointer-events-none fixed inset-0 z-0">
				<div className="aurora" />
				<div className="orb orb-a animate-drift" />
				<div className="orb orb-b animate-drift" />
				<div className="orb orb-c animate-drift" />
				<div className="gridlines" />
			</div>
			<div className="noise z-[1]" />
			<main className="relative z-10 mx-auto max-w-screen-2xl px-6 pb-16 pt-8">
				<div className="grid gap-6 lg:grid-cols-[280px_1fr]">
					{/* Desktop Sidebar - Hidden on mobile */}
					<div className="hidden lg:block">
						<Sidebar
							variant="default"
							currentRoute={location.pathname}
							activeAgents={agentOptions}
							selectedAgentId={agentId}
							threads={threads}
							activeThreadId={activeThread?.id || ""}
							loadingThreads={loadingThreads}
							onSelectAgent={setAgentId}
							onSelectThread={handleSelectThread}
							onCreateThread={handleCreateThread}
							onDeleteThread={deleteThread}
							onRenameThread={renameThread}
							hostLabel={hostLabel}
							deviceId={deviceId}
							getAgentLabel={(id) =>
								agentOptions.find((agent) => agent.id === id)?.name || id
							}
						/>
					</div>

					{/* Mobile Hamburger Button - Visible only on mobile */}
					<button
						type="button"
						onClick={() => setMobileMenuOpen(true)}
						className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-[0_14px_30px_rgba(37,99,235,0.45)] transition hover:shadow-[0_18px_36px_rgba(37,99,235,0.55)] active:scale-95 lg:hidden"
						aria-label="Open navigation menu"
					>
						<FiMenu className="h-6 w-6" />
					</button>

					{/* Mobile Drawer */}
					{mobileMenuOpen && (
						<>
							{/* Backdrop */}
							<div
								className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
								onClick={() => setMobileMenuOpen(false)}
								aria-label="Close menu"
							/>

							{/* Drawer Panel */}
							<aside
								className="fixed inset-y-0 left-0 z-[70] w-[280px] overflow-y-auto border-r border-white/10 bg-slate-900/95 backdrop-blur-2xl shadow-[0_25px_80px_rgba(10,25,60,0.5)] animate-slideInFromLeft lg:hidden"
								role="dialog"
								aria-modal="true"
								aria-label="Navigation menu"
							>
								{/* Header with Logo and Close Button */}
								<div className="sticky top-0 z-10 border-b border-white/10 bg-slate-900/95 px-5 py-4 backdrop-blur-xl">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<img
												src={wingmanIcon}
												alt="Wingman"
												className="h-12 rounded-xl border border-white/10 bg-slate-950/60 p-1.5"
											/>
											<div>
												<p className="text-xs uppercase tracking-[0.3em] text-slate-400">
													Menu
												</p>
												<h2 className="text-base font-semibold text-slate-100">
													Navigation
												</h2>
											</div>
										</div>
										<button
											type="button"
											onClick={() => setMobileMenuOpen(false)}
											className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-slate-900/70 text-slate-300 transition hover:border-sky-400/50 hover:text-sky-300 active:scale-95"
											aria-label="Close menu"
										>
											<FiX className="h-5 w-5" />
										</button>
									</div>
								</div>

								{/* Sidebar Content */}
								<div className="p-5">
									<Sidebar
										variant="mobile-drawer"
										currentRoute={location.pathname}
										activeAgents={agentOptions}
										selectedAgentId={agentId}
										threads={threads}
										activeThreadId={activeThread?.id || ""}
										loadingThreads={loadingThreads}
										onSelectAgent={setAgentId}
										onSelectThread={handleSelectThread}
										onCreateThread={handleCreateThread}
										onDeleteThread={deleteThread}
										onRenameThread={renameThread}
										hostLabel={hostLabel}
										deviceId={deviceId}
										getAgentLabel={(id) =>
											agentOptions.find((agent) => agent.id === id)?.name || id
										}
									/>
								</div>

								{/* Footer */}
								<div className="sticky bottom-0 border-t border-white/10 bg-slate-900/95 px-5 py-4 backdrop-blur-xl">
									<div className="space-y-2 text-xs text-slate-400">
										<div className="pill">host: {hostLabel}</div>
										<div className="pill">device: {deviceId || "--"}</div>
									</div>
									<div className="mt-3 flex items-center justify-center rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
										<img
											src={wingmanLogo}
											alt="Wingman logo"
											className="h-16 w-auto opacity-95"
										/>
									</div>
								</div>
							</aside>
						</>
					)}

					<section className="space-y-6">
						<HeroPanel
							agentId={currentAgentId}
							activeThreadName={activeThread?.name}
							statusLabel={statusLabel}
							connected={connected}
							health={health}
							stats={stats}
							formatDuration={formatDuration}
						/>
						<Routes>
							<Route path="/" element={<Navigate to="/chat" replace />} />
							<Route
								path="/chat"
								element={
										<ChatPage
											agentId={currentAgentId}
											activeThread={activeThread}
											prompt={prompt}
											attachments={attachments}
											fileAccept={FILE_INPUT_ACCEPT}
											attachmentError={attachmentError}
										isStreaming={isStreaming}
										connected={connected}
										loadingThread={loadingThreadId === activeThread?.id}
										outputRoot={config.outputRoot}
										voiceAutoEnabled={activeVoiceAutoEnabled}
										voicePlayback={voicePlayback}
										dynamicUiEnabled={dynamicUiEnabled}
										onToggleVoiceAuto={handleToggleVoiceAuto}
										onSpeakVoice={handleSpeakVoice}
										onStopVoice={handleStopVoice}
										onPromptChange={setPrompt}
										onSendPrompt={sendPrompt}
										onAddAttachments={addAttachments}
										onRemoveAttachment={removeAttachment}
										onClearAttachments={clearAttachments}
										onClearChat={clearChat}
										onDeleteThread={deleteThread}
										onOpenCommandDeck={() => navigate("/command")}
										onSetWorkdir={setThreadWorkdir}
									/>
								}
							/>
							<Route
								path="/command"
								element={
									<CommandDeckPage
										wsUrl={wsUrl}
										token={token}
										password={password}
										connecting={connecting}
										connected={connected}
										authHint={authHint}
										autoConnectStatus={autoConnectStatus}
										deviceId={deviceId}
										eventLog={eventLog}
										providers={providers}
										providersLoading={providersLoading}
										providersUpdatedAt={providersUpdatedAt}
										credentialsPath={credentialsPath}
										voiceConfig={config.voice}
										autoConnect={autoConnect}
										onAutoConnectChange={setAutoConnect}
										onWsUrlChange={setWsUrl}
										onTokenChange={setToken}
										onPasswordChange={setPassword}
										onConnect={connect}
										onDisconnect={disconnect}
										onRefresh={() => {
											refreshStats();
											fetchThreads();
											refreshProviders();
										}}
										onResetDevice={resetDevice}
										onRefreshProviders={refreshProviders}
										onSaveProviderToken={saveProviderToken}
										onClearProviderToken={clearProviderToken}
										onSaveVoiceConfig={updateVoiceConfig}
									/>
								}
							/>
							<Route
								path="/agents"
								element={
									<AgentsPage
										agents={agentCatalog}
										availableTools={availableTools}
										builtInTools={builtInTools}
										providers={providers}
										loading={agentsLoading}
										onCreateAgent={createAgent}
										onUpdateAgent={updateAgent}
										onLoadAgent={loadAgentDetail}
										onRefresh={refreshAgents}
									/>
								}
							/>
								<Route
									path="/routines"
									element={
										<RoutinesPage
											agents={agentOptions}
											routines={routines}
											threads={threads}
											loading={routinesLoading}
											onCreateRoutine={createRoutine}
											onDeleteRoutine={deleteRoutine}
										/>
									}
								/>
							<Route
								path="/webhooks"
								element={
									<WebhooksPage
										agents={agentOptions}
										webhooks={webhooks}
										threads={threads}
										loading={webhooksLoading}
										baseUrl={window.location.origin}
										onCreateWebhook={createWebhook}
										onUpdateWebhook={updateWebhook}
										onDeleteWebhook={deleteWebhook}
										onTestWebhook={testWebhook}
										onRefresh={refreshWebhooks}
									/>
								}
							/>
						</Routes>
					</section>
				</div>
			</main>
		</div>
	);
};

function normalizeName(value: string): string {
	return value.trim().toLowerCase();
}

function mergeStreamText(existing: string, next: string): string {
	if (!next) return existing;
	if (next.startsWith(existing)) return next;
	return existing + next;
}

function mapSessionToThread(session: {
	id: string;
	name: string;
	agentId: string;
	createdAt: number;
	updatedAt?: number;
	messageCount?: number;
	lastMessagePreview?: string;
	workdir?: string | null;
}): Thread {
	return {
		id: session.id,
		name: session.name || DEFAULT_THREAD_NAME,
		agentId: session.agentId,
		messages: [],
		toolEvents: [],
		thinkingEvents: [],
		createdAt: session.createdAt || Date.now(),
		updatedAt: session.updatedAt,
		messageCount: session.messageCount ?? 0,
		lastMessagePreview: session.lastMessagePreview,
		messagesLoaded: false,
		workdir: session.workdir ?? null,
	};
}

function createAttachmentId(): string {
	if (typeof window !== "undefined" && typeof window.crypto?.randomUUID === "function") {
		return window.crypto.randomUUID();
	}
	return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildAgentFallback(
	result: unknown,
	requestId: string,
	uiOnlyRequests: Set<string>,
): string | undefined {
	if (!result) return undefined;
	if (uiOnlyRequests.has(requestId)) return undefined;
	if (typeof result === "object" && result !== null) {
		const keys = Object.keys(result as Record<string, unknown>);
		if (keys.length === 1 && keys[0] === "streaming") {
			return undefined;
		}
	}
	try {
		return JSON.stringify(result, null, 2);
	} catch {
		return String(result);
	}
}

function readFileAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result || ""));
		reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
		reader.readAsDataURL(file);
	});
}

function buildAttachmentPreviewText(attachments: ChatAttachment[]): string {
	if (!attachments || attachments.length === 0) return "";
	let hasFile = false;
	let hasAudio = false;
	let hasImage = false;
	for (const attachment of attachments) {
		if (isFileAttachment(attachment)) {
			hasFile = true;
			continue;
		}
		if (isAudioAttachment(attachment)) {
			hasAudio = true;
		} else {
			hasImage = true;
		}
	}
	const count = attachments.length;
	if (hasFile && (hasAudio || hasImage)) {
		return count > 1 ? "File and media attachments" : "File and media attachment";
	}
	if (hasFile) {
		return count > 1 ? "File attachments" : "File attachment";
	}
	if (hasAudio && hasImage) {
		return count > 1 ? "Media attachments" : "Media attachment";
	}
	if (hasAudio) {
		return count > 1 ? "Audio attachments" : "Audio attachment";
	}
	return count > 1 ? "Image attachments" : "Image attachment";
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
