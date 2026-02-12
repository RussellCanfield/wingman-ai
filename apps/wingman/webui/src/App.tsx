import { useStream } from "@langchain/langgraph-sdk/react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiMenu, FiX } from "react-icons/fi";
import {
	Navigate,
	Route,
	Routes,
	useLocation,
	useNavigate,
} from "react-router-dom";
import wingmanIcon from "./assets/wingman_icon.webp";
import wingmanLogo from "./assets/wingman_logo.webp";
import { HeroPanel } from "./components/HeroPanel";
import { Sidebar } from "./components/Sidebar";
import { AgentsPage } from "./pages/AgentsPage";
import { ChatPage } from "./pages/ChatPage";
import { CommandDeckPage } from "./pages/CommandDeckPage";
import { RoutinesPage } from "./pages/RoutinesPage";
import { WebhooksPage } from "./pages/WebhooksPage";
import type {
	AgentDetail,
	AgentSummary,
	AgentsResponse,
	AgentVoiceConfig,
	ChatAttachment,
	ChatMessage,
	ControlUiConfig,
	GatewayHealth,
	GatewayMessage,
	GatewayStats,
	PromptTrainingConfig,
	ProviderStatus,
	ProviderStatusResponse,
	ReasoningEffort,
	Routine,
	ThinkingEvent,
	Thread,
	ToolEvent,
	VoiceConfig,
	Webhook,
} from "./types";
import {
	type KnownSubagentLookup,
	matchKnownSubagentLabel,
	resolveToolActorLabel,
} from "./utils/agentAttribution";
import { buildRoutineAgents } from "./utils/agentOptions";
import { appendAssistantErrorFeedback } from "./utils/assistantError";
import { mergeAssistantStreamText } from "./utils/assistantStream";
import {
	drainAssistantContentUpdates,
	queueAssistantContentUpdate,
	type QueuedAssistantUpdate,
} from "./utils/assistantUpdateQueue";
import {
	FILE_INPUT_ACCEPT,
	isPdfUploadFile,
	isSupportedTextUploadFile,
	readUploadFileText,
} from "./utils/fileUpload";
import { sanitizeAssistantDisplayText } from "./utils/internalToolEnvelope";
import { createGatewayLangGraphTransport } from "./utils/langgraphTransport";
import {
	isLocallyTrackedRequest,
	resolveTerminalRequestId,
} from "./utils/requestTracking";
import { shouldMarkRequestActive } from "./utils/requestLifecycle";
import {
	buildCancelGatewayMessage,
	resolveStoppableRequestId,
} from "./utils/stopPrompt";
import { parseStreamEvents } from "./utils/streaming";
import {
	clearStreamMessageTargets,
	resolveToolMessageTargetId,
} from "./utils/streamMessageRouter";
import { isAssistantTextStreamChunk } from "./utils/streamChunkKind";
import { appendLocalPromptMessagesToThread } from "./utils/threadState";
import {
	resolveSpeechVoice,
	resolveVoiceConfig,
	sanitizeForSpeech,
} from "./utils/voice";
import { shouldAutoSpeak } from "./utils/voiceAuto";
import type { VoicePlaybackStatus } from "./utils/voicePlayback";

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
	reasoningEffort?: ReasoningEffort;
	tools: string[];
	prompt: string;
	promptTraining?: PromptTrainingConfig | boolean | null;
};

type TaskDelegationContext = {
	taskEventId: string;
	subagentType?: string;
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
	const [queuedPromptCount, setQueuedPromptCount] = useState<number>(0);
	const [threads, setThreads] = useState<Thread[]>([]);
	const [activeThreadId, setActiveThreadId] = useState<string>("");
	const [loadingThreads, setLoadingThreads] = useState<boolean>(false);
	const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null);
	const [providers, setProviders] = useState<ProviderStatus[]>([]);
	const [providersLoading, setProvidersLoading] = useState<boolean>(false);
	const [providersUpdatedAt, setProvidersUpdatedAt] = useState<
		string | undefined
	>();
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
	const [voiceSessions, setVoiceSessions] = useState<Record<string, boolean>>(
		{},
	);
	const [voicePlayback, setVoicePlayback] = useState<{
		status: VoicePlaybackStatus;
		messageId?: string;
	}>({ status: "idle" });
	const dynamicUiEnabled = config.dynamicUiEnabled !== false;

	const wsRef = useRef<WebSocket | null>(null);
	const agentEventSubscribersRef = useRef<
		Set<(message: GatewayMessage) => void>
	>(new Set());
	const connectRequestIdRef = useRef<string | null>(null);
	const buffersRef = useRef<Map<string, string>>(new Map());
	const requestStreamMessageRef = useRef<Map<string, Map<string, string>>>(
		new Map(),
	);
	const thinkingBuffersRef = useRef<Map<string, Map<string, string>>>(
		new Map(),
	);
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
	const activeRequestIdRef = useRef<string | null>(null);
	const pendingRequestIdsRef = useRef<Set<string>>(new Set());
	const queuedAssistantUpdatesRef = useRef<Map<string, QueuedAssistantUpdate>>(
		new Map(),
	);
	const assistantFlushFrameRef = useRef<number | null>(null);
	const taskDelegationRef = useRef<
		Map<string, Map<string, TaskDelegationContext>>
	>(new Map());

	const agentOptions = useMemo(
		() =>
			buildRoutineAgents({
				catalog: agentCatalog,
			}),
		[agentCatalog],
	);

	const subagentMap = useMemo(() => {
		const map = new Map<string, KnownSubagentLookup>();
		for (const agent of agentCatalog) {
			const lookup = new Map<string, string>();
			for (const subagent of agent.subAgents || []) {
				const label = (subagent.displayName || subagent.id || "").trim();
				if (!label) continue;
				if (subagent.id) {
					lookup.set(normalizeName(subagent.id), label);
				}
				if (subagent.displayName) {
					lookup.set(normalizeName(subagent.displayName), label);
				}
			}
			map.set(agent.id, lookup);
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

	const subscribeToAgentEvents = useCallback(
		(handler: (message: GatewayMessage) => void) => {
			agentEventSubscribersRef.current.add(handler);
			return () => {
				agentEventSubscribersRef.current.delete(handler);
			};
		},
		[],
	);

	const sendGatewayMessage = useCallback((message: GatewayMessage) => {
		const ws = wsRef.current;
		if (!ws || ws.readyState !== WebSocket.OPEN) {
			throw new Error("Gateway is not connected.");
		}
		ws.send(JSON.stringify(message));
	}, []);

	const syncRequestStreamingState = useCallback(() => {
		const pendingSize = pendingRequestIdsRef.current.size;
		const hasActiveRequest = Boolean(activeRequestIdRef.current);
		setIsStreaming(pendingSize > 0 || hasActiveRequest);
		setQueuedPromptCount(Math.max(pendingSize - (hasActiveRequest ? 1 : 0), 0));
	}, []);

	const registerPendingRequest = useCallback(
		(requestId: string) => {
			pendingRequestIdsRef.current.add(requestId);
			if (!activeRequestIdRef.current) {
				activeRequestIdRef.current = requestId;
			}
			syncRequestStreamingState();
		},
		[syncRequestStreamingState],
	);

	const markPendingRequestActive = useCallback(
		(requestId: string) => {
			if (!pendingRequestIdsRef.current.has(requestId)) return;
			if (activeRequestIdRef.current === requestId) return;
			activeRequestIdRef.current = requestId;
			syncRequestStreamingState();
		},
		[syncRequestStreamingState],
	);

	const finalizePendingRequest = useCallback(
		(requestId: string) => {
			const removed = pendingRequestIdsRef.current.delete(requestId);
			if (!removed && activeRequestIdRef.current !== requestId) return;
			if (activeRequestIdRef.current === requestId) {
				const nextActive = pendingRequestIdsRef.current.values().next().value;
				activeRequestIdRef.current = nextActive ?? null;
			}
			syncRequestStreamingState();
		},
		[syncRequestStreamingState],
	);

	const resetPendingRequests = useCallback(() => {
		pendingRequestIdsRef.current.clear();
		activeRequestIdRef.current = null;
		queuedAssistantUpdatesRef.current.clear();
		if (assistantFlushFrameRef.current !== null) {
			window.cancelAnimationFrame(assistantFlushFrameRef.current);
			assistantFlushFrameRef.current = null;
		}
		syncRequestStreamingState();
	}, [syncRequestStreamingState]);

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
		async (
			thread: Thread,
			options?: {
				force?: boolean;
			},
		) => {
			if (thread.messagesLoaded && !options?.force) return;
			setLoadingThreadId(thread.id);
			try {
				const params = new URLSearchParams({
					agentId: thread.agentId,
				});
				const res = await fetch(
					`/api/sessions/${encodeURIComponent(thread.id)}/messages?${params.toString()}`,
				);
				if (!res.ok) {
					logEvent("Failed to load session messages");
					return;
				}
				const data = (await res.json()) as ChatMessage[];
				const sanitizedMessages = data.map(normalizeSessionMessage);
				setThreads((prev) =>
					prev.map((item) =>
						item.id === thread.id
							? {
									...item,
									messages: sanitizedMessages,
									messagesLoaded: true,
									messageCount: sanitizedMessages.length,
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

	const addAttachments = useCallback(
		async (files: FileList | File[] | null) => {
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

				const { textContent, truncated, usedPdfFallback } =
					await readUploadFileText(file, MAX_FILE_TEXT_CHARS);
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
					setAttachmentError(
						`Limit is ${MAX_ATTACHMENTS} attachments per message.`,
					);
					return combined.slice(0, MAX_ATTACHMENTS);
				}
				if (warningMessage) {
					setAttachmentError(warningMessage);
				}
				return combined;
			});
		},
		[],
	);

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
					prev[threadId] ?? (config.voice?.defaultPolicy || "off") === "auto";
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
		async (input: { messageId: string; text: string; agentId?: string }) => {
			const { messageId, text, agentId } = input;
			const cleaned = sanitizeForSpeech(text);
			if (!cleaned) return;
			const resolved = resolveVoiceConfig(
				config.voice,
				agentId ? agentVoiceMap.get(agentId) : undefined,
			);

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
				const voice = resolveSpeechVoice(
					resolved.webSpeech.voiceName,
					resolved.webSpeech.lang,
				);
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

	const getRequestMessageIds = useCallback((requestId: string): string[] => {
		const ids = new Set<string>([requestId]);
		const requestTargets = requestStreamMessageRef.current.get(requestId);
		if (requestTargets) {
			for (const targetId of requestTargets.values()) {
				ids.add(targetId);
			}
		}
		return [...ids];
	}, []);

	const resolveRequestMessageId = useCallback(
		(requestId: string): string => {
			const candidates = getRequestMessageIds(requestId);
			for (let index = candidates.length - 1; index >= 0; index -= 1) {
				const candidate = candidates[index];
				if (
					(buffersRef.current.get(candidate) || "").trim().length > 0 ||
					uiFallbackRef.current.has(candidate) ||
					uiOnlyRequestsRef.current.has(candidate)
				) {
					return candidate;
				}
			}
			return candidates[candidates.length - 1] || requestId;
		},
		[getRequestMessageIds],
	);

	const applyQueuedAssistantUpdates = useCallback(
		(queuedUpdates: QueuedAssistantUpdate[]) => {
			if (queuedUpdates.length === 0) return;
			const updatesByThread = new Map<string, QueuedAssistantUpdate[]>();
			for (const update of queuedUpdates) {
				const existing = updatesByThread.get(update.threadId) || [];
				existing.push(update);
				updatesByThread.set(update.threadId, existing);
			}

			setThreads((prev) =>
				prev.map((thread) => {
					const threadUpdates = updatesByThread.get(thread.id);
					if (!threadUpdates || threadUpdates.length === 0) {
						return thread;
					}
					let nextThread = thread;
					for (const update of threadUpdates) {
						nextThread = upsertAssistantMessage(
							nextThread,
							update.messageId,
							(message) =>
								message.content === update.content
									? message
									: { ...message, content: update.content },
							update.requestId,
						);
					}
					return nextThread;
				}),
			);
		},
		[],
	);

	const flushQueuedAssistantUpdates = useCallback(() => {
		if (assistantFlushFrameRef.current !== null) {
			window.cancelAnimationFrame(assistantFlushFrameRef.current);
			assistantFlushFrameRef.current = null;
		}
		const queuedUpdates = drainAssistantContentUpdates(
			queuedAssistantUpdatesRef.current,
		);
		applyQueuedAssistantUpdates(queuedUpdates);
	}, [applyQueuedAssistantUpdates]);

	const scheduleQueuedAssistantUpdateFlush = useCallback(() => {
		if (assistantFlushFrameRef.current !== null) return;
		assistantFlushFrameRef.current = window.requestAnimationFrame(() => {
			assistantFlushFrameRef.current = null;
			const queuedUpdates = drainAssistantContentUpdates(
				queuedAssistantUpdatesRef.current,
			);
			applyQueuedAssistantUpdates(queuedUpdates);
		});
	}, [applyQueuedAssistantUpdates]);

	const queueAssistantUpdate = useCallback(
		(input: { requestId: string; messageId: string; text: string }) => {
			const { requestId, messageId, text } = input;
			if (!text) return;
			const threadId = requestThreadRef.current.get(requestId);
			if (!threadId) return;
			if (uiOnlyRequestsRef.current.has(messageId)) {
				return;
			}
			const existingRaw = buffersRef.current.get(messageId) ?? "";
			const mergedRaw = mergeAssistantStreamText(existingRaw, text);
			buffersRef.current.set(messageId, mergedRaw);
			const previousCleaned =
				sanitizeAssistantDisplayText(existingRaw, {
					preserveTrailingWhitespace: true,
				}) ?? "";
			const cleaned =
				sanitizeAssistantDisplayText(mergedRaw, {
					preserveTrailingWhitespace: true,
				}) ?? previousCleaned;

			queueAssistantContentUpdate(queuedAssistantUpdatesRef.current, {
				threadId,
				requestId,
				messageId,
				content: cleaned,
			});
			scheduleQueuedAssistantUpdateFlush();
		},
		[scheduleQueuedAssistantUpdateFlush],
	);

	useEffect(() => {
		return () => {
			if (assistantFlushFrameRef.current !== null) {
				window.cancelAnimationFrame(assistantFlushFrameRef.current);
				assistantFlushFrameRef.current = null;
			}
			queuedAssistantUpdatesRef.current.clear();
		};
	}, []);

	const updateToolEvents = useCallback(
		(requestId: string, messageId: string, events: ToolEvent[]) => {
			const threadId = requestThreadRef.current.get(requestId);
			if (!threadId || events.length === 0) return;

			setThreads((prev) =>
				prev.map((thread) => {
					if (thread.id !== threadId) return thread;
					return upsertAssistantMessage(
						thread,
						messageId,
						(msg) => {
							const existing = msg.toolEvents ? [...msg.toolEvents] : [];
							const uiBlocks = msg.uiBlocks ? [...msg.uiBlocks] : [];
							let clearContent = false;
							for (const event of events) {
								if (event.uiOnly && dynamicUiEnabled) {
									uiOnlyRequestsRef.current.add(messageId);
									clearContent = true;
								}
								if (event.textFallback) {
									uiFallbackRef.current.set(messageId, event.textFallback);
								}
								const index = existing.findIndex(
									(item) => item.id === event.id,
								);
								if (index >= 0) {
									const resolvedName =
										event.name && event.name !== "tool"
											? event.name
											: existing[index].name;
									existing[index] = {
										...existing[index],
										...event,
										name: resolvedName,
										node: event.node || existing[index].node,
										actor: event.actor || existing[index].actor,
										runId: event.runId || existing[index].runId,
										parentRunIds:
											event.parentRunIds || existing[index].parentRunIds,
										delegatedByTaskId:
											event.delegatedByTaskId ||
											existing[index].delegatedByTaskId,
										delegatedSubagentType:
											event.delegatedSubagentType ||
											existing[index].delegatedSubagentType,
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
										node: event.node,
										actor: event.actor,
										runId: event.runId,
										parentRunIds: event.parentRunIds,
										delegatedByTaskId: event.delegatedByTaskId,
										delegatedSubagentType: event.delegatedSubagentType,
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
									const existingBlock = uiBlocks.find(
										(block) => block.id === event.id,
									);
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
									uiFallbackRef.current.get(messageId) ?? msg.uiTextFallback,
							};
						},
						requestId,
					);
				}),
			);
		},
		[dynamicUiEnabled],
	);

	const updateThinkingEvents = useCallback(
		(requestId: string, messageId: string, events: ThinkingEvent[]) => {
			const threadId = requestThreadRef.current.get(requestId);
			if (!threadId || events.length === 0) return;

			setThreads((prev) =>
				prev.map((thread) => {
					if (thread.id !== threadId) return thread;
					return upsertAssistantMessage(
						thread,
						messageId,
						(msg) => {
							const existing = msg.thinkingEvents
								? [...msg.thinkingEvents]
								: [];
							for (const event of events) {
								const index = existing.findIndex(
									(item) => item.id === event.id,
								);
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
						},
						requestId,
					);
				}),
			);
		},
		[],
	);

	const cleanupRequestState = useCallback(
		(requestId: string) => {
			for (const [key, update] of queuedAssistantUpdatesRef.current) {
				if (update.requestId !== requestId) continue;
				queuedAssistantUpdatesRef.current.delete(key);
			}
			for (const messageId of getRequestMessageIds(requestId)) {
				buffersRef.current.delete(messageId);
				uiOnlyRequestsRef.current.delete(messageId);
				uiFallbackRef.current.delete(messageId);
			}
			thinkingBuffersRef.current.delete(requestId);
			requestThreadRef.current.delete(requestId);
			requestAgentRef.current.delete(requestId);
			clearStreamMessageTargets(requestStreamMessageRef.current, requestId);
			taskDelegationRef.current.delete(requestId);
		},
		[getRequestMessageIds],
	);

	const finalizeAssistant = useCallback(
		(
			requestId: string,
			options?: {
				fallback?: string;
				forceText?: boolean;
				appendFallbackToExisting?: boolean;
			},
		) => {
			const threadId = requestThreadRef.current.get(requestId);
			if (!threadId) {
				cleanupRequestState(requestId);
				finalizePendingRequest(requestId);
				return;
			}
			const messageId = resolveRequestMessageId(requestId);
			const uiFallback = uiFallbackRef.current.get(messageId);
			const resolvedFallback = options?.fallback || uiFallback || "";
			const bufferedRaw = buffersRef.current.get(messageId) || "";
			const bufferedText = sanitizeAssistantDisplayText(bufferedRaw) || "";
			const finalText = bufferedText || resolvedFallback || "";
			const spoken =
				spokenMessagesRef.current.get(threadId) || new Set<string>();
			if (
				shouldAutoSpeak({
					text: finalText,
					enabled: isVoiceAutoEnabledRef.current(threadId),
					spokenMessages: spoken,
					requestId: messageId,
				})
			) {
				spoken.add(messageId);
				spokenMessagesRef.current.set(threadId, spoken);
				const agentForRequest = requestAgentRef.current.get(requestId);
				void speakVoiceRef.current({
					messageId,
					text: finalText,
					agentId: agentForRequest,
				});
			}
			setThreads((prev) =>
				prev.map((thread) => {
					if (thread.id !== threadId) return thread;
					return upsertAssistantMessage(
						thread,
						messageId,
						(msg) => {
							let nextMessage = msg;
							if (bufferedText && bufferedText !== msg.content) {
								nextMessage = {
									...nextMessage,
									content: bufferedText,
								};
							}
							const canRenderFallbackText =
								options?.forceText ||
								!uiOnlyRequestsRef.current.has(messageId) ||
								!dynamicUiEnabled;
							if (!canRenderFallbackText || !resolvedFallback) {
								return nextMessage;
							}
							if (!nextMessage.content.trim()) {
								return { ...nextMessage, content: resolvedFallback };
							}
							if (options?.appendFallbackToExisting) {
								const withFeedback = appendAssistantErrorFeedback(
									nextMessage.content,
									resolvedFallback,
								);
								if (withFeedback !== nextMessage.content) {
									return { ...nextMessage, content: withFeedback };
								}
							}
							return nextMessage;
						},
						requestId,
					);
				}),
			);
			cleanupRequestState(requestId);
			finalizePendingRequest(requestId);
		},
		[
			cleanupRequestState,
			dynamicUiEnabled,
			finalizePendingRequest,
			resolveRequestMessageId,
		],
	);

	const gatewayStreamTransport = useMemo(
		() =>
			createGatewayLangGraphTransport({
				socket: {
					send: sendGatewayMessage,
					subscribe: subscribeToAgentEvents,
				},
				agentId: currentAgentId,
			}),
		[currentAgentId, sendGatewayMessage, subscribeToAgentEvents],
	);

	const gatewayStream = useStream<Record<string, unknown>>({
		assistantId: currentAgentId || "main",
		transport: gatewayStreamTransport,
		threadId: null,
		throttle: false,
		onError: (error) => {
			const errorText =
				error instanceof Error
					? error.message
					: String(error || "Stream error");
			logEvent(`Stream transport error: ${errorText}`);
			const requestId = activeRequestIdRef.current;
			if (!requestId) {
				resetPendingRequests();
				return;
			}
			flushQueuedAssistantUpdates();
			finalizeAssistant(requestId, {
				fallback: `Stream transport error: ${errorText}`,
				forceText: true,
				appendFallbackToExisting: true,
			});
		},
	});

	const handleAgentEvent = useCallback(
		(requestId: string, payload: any) => {
			if (!payload) return;
			const trackedRequest = isLocallyTrackedRequest({
				requestId,
				pendingRequestIds: pendingRequestIdsRef.current,
				activeRequestId: activeRequestIdRef.current,
			});
			if (trackedRequest && shouldMarkRequestActive(payload?.type)) {
				markPendingRequestActive(requestId);
			}
			if (payload.type === "request-queued") {
				const position =
					typeof payload.position === "number" ? payload.position : undefined;
				logEvent(
					position && position > 0
						? `Prompt queued (${position} waiting).`
						: "Prompt queued.",
				);
				return;
			}
			const sessionId =
				typeof payload?.sessionId === "string" ? payload.sessionId : undefined;
			if (payload.type === "session-message" && payload.role === "user") {
				if (!sessionId) return;
				const now = Date.now();
				const rawAttachments = Array.isArray(payload.attachments)
					? payload.attachments
					: [];
				const mappedAttachments = rawAttachments
					.map((attachment: any) => normalizeIncomingAttachment(attachment))
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
								typeof payload?.agentId === "string"
									? payload.agentId
									: agentId,
							messages: [userMessage],
							toolEvents: [],
							thinkingEvents: [],
							createdAt: now,
							updatedAt: now,
							messageCount: 1,
							lastMessagePreview: (
								userMessage.content || attachmentPreview
							).slice(0, 200),
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
							lastMessagePreview: (
								userMessage.content || attachmentPreview
							).slice(0, 200),
							updatedAt: now,
						};
					});
				});
				return;
			}
			if (
				sessionId &&
				payload.type !== "session-message" &&
				!requestThreadRef.current.has(requestId)
			) {
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
								typeof payload?.agentId === "string"
									? payload.agentId
									: agentId,
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
				const shouldHandleDeltaTextStream = isAssistantTextStreamChunk(
					payload.chunk,
				);
				const agentForRequest = requestAgentRef.current.get(requestId);
				const subagents = agentForRequest
					? subagentMap.get(agentForRequest)
					: undefined;
				const thinkingUpdates: ThinkingEvent[] = [];

				for (const event of textEvents) {
					if (!shouldHandleDeltaTextStream) {
						continue;
					}
					if (!event.isDelta) {
						continue;
					}
					const nodeLabel = event.node?.trim();
					const matchedSubagent = matchKnownSubagentLabel(nodeLabel, subagents);
					const normalizedNode = matchedSubagent
						? normalizeName(matchedSubagent)
						: nodeLabel
							? normalizeName(nodeLabel)
							: "";

					if (matchedSubagent) {
						const buffer =
							thinkingBuffersRef.current.get(requestId) ||
							new Map<string, string>();
						const previous = buffer.get(normalizedNode) || "";
						const next = mergeStreamText(previous, event.text);
						const cleaned =
							sanitizeAssistantDisplayText(next) ??
							(previous.trim().length > 0 ? previous : "");
						buffer.set(normalizedNode, cleaned);
						thinkingBuffersRef.current.set(requestId, buffer);
						thinkingUpdates.push({
							id: `think-${requestId}-${normalizedNode}`,
							node: matchedSubagent,
							content: cleaned,
							updatedAt: Date.now(),
						});
					} else {
						queueAssistantUpdate({
							requestId,
							messageId: requestId,
							text: event.text,
						});
					}
				}

				if (thinkingUpdates.length > 0) {
					updateThinkingEvents(
						requestId,
						resolveRequestMessageId(requestId),
						thinkingUpdates,
					);
				}

				if (toolEvents.length > 0) {
					const taskMap = taskDelegationRef.current.get(requestId) || new Map();
					const enrichedToolEvents = toolEvents.map((event) => {
						const runId = event.runId || event.id;
						const parentRunIds = Array.isArray(event.parentRunIds)
							? event.parentRunIds
							: [];
						let delegatedByTaskId: string | undefined;
						let delegatedSubagentType: string | undefined;

						for (let index = parentRunIds.length - 1; index >= 0; index -= 1) {
							const parentId = parentRunIds[index];
							if (!parentId) continue;
							const parentTask = taskMap.get(parentId);
							if (!parentTask) continue;
							delegatedByTaskId = parentTask.taskEventId;
							delegatedSubagentType = parentTask.subagentType;
							break;
						}

						const taskTarget =
							extractTaskSubagentType(event.args) ||
							extractTaskSubagentType(event.output);
						const toolName =
							typeof event.name === "string"
								? event.name.trim().toLowerCase()
								: "";
						if (toolName === "task" && runId) {
							const existingTask = taskMap.get(runId);
							const resolvedTaskTarget =
								taskTarget ||
								existingTask?.subagentType ||
								delegatedSubagentType;
							taskMap.set(runId, {
								taskEventId: event.id,
								subagentType: resolvedTaskTarget,
							});
							delegatedSubagentType = resolvedTaskTarget;
						}

						let actor = resolveToolActorLabel(
							event.node,
							event.args,
							event.output,
							subagents,
						);
						if (
							actor === "orchestrator" &&
							typeof delegatedSubagentType === "string" &&
							delegatedSubagentType.trim()
						) {
							const known = matchKnownSubagentLabel(
								delegatedSubagentType,
								subagents,
							);
							actor = known || delegatedSubagentType;
						}

						return {
							...event,
							actor,
							delegatedByTaskId,
							delegatedSubagentType,
						};
					});
					taskDelegationRef.current.set(requestId, taskMap);
					const toolEventsByMessageId = new Map<string, ToolEvent[]>();
					for (const event of enrichedToolEvents) {
						const targetMessageId = resolveToolMessageTargetId({
							state: requestStreamMessageRef.current,
							requestId,
							fallbackMessageId: requestId,
							runId: event.runId || event.id,
							parentRunIds: event.parentRunIds,
						});
						const bucket = toolEventsByMessageId.get(targetMessageId) || [];
						bucket.push(event);
						toolEventsByMessageId.set(targetMessageId, bucket);
					}
					for (const [messageId, groupedEvents] of toolEventsByMessageId) {
						updateToolEvents(requestId, messageId, groupedEvents);
					}
				}
				return;
			}
			if (payload.type === "agent-complete") {
				flushQueuedAssistantUpdates();
				const terminalRequestId = resolveTerminalRequestId({
					requestId,
					pendingRequestIds: pendingRequestIdsRef.current,
					activeRequestId: activeRequestIdRef.current,
				});
				logEvent("Agent complete");
				const fallback = buildAgentFallback(
					payload.result,
					resolveRequestMessageId(terminalRequestId),
					uiOnlyRequestsRef.current,
				);
				finalizeAssistant(terminalRequestId, { fallback });
				return;
			}
			if (payload.type === "agent-error") {
				flushQueuedAssistantUpdates();
				const terminalRequestId = resolveTerminalRequestId({
					requestId,
					pendingRequestIds: pendingRequestIdsRef.current,
					activeRequestId: activeRequestIdRef.current,
				});
				const errorText =
					typeof payload.error === "string" ? payload.error : "Agent error";
				const isCancel = /cancel/i.test(errorText);
				if (isCancel) {
					logEvent("Request stopped.");
				} else {
					logEvent(`Agent error: ${errorText || "unknown"}`);
				}
				finalizeAssistant(terminalRequestId, {
					fallback: errorText || "Agent error",
					forceText: true,
					appendFallbackToExisting: !isCancel,
				});
			}
		},
		[
			agentId,
			finalizeAssistant,
			flushQueuedAssistantUpdates,
			logEvent,
			markPendingRequestActive,
			queueAssistantUpdate,
			resolveRequestMessageId,
			subagentMap,
			updateThinkingEvents,
			updateToolEvents,
		],
	);

	const disconnect = useCallback(() => {
		if (autoConnectTimerRef.current) {
			window.clearTimeout(autoConnectTimerRef.current);
			autoConnectTimerRef.current = null;
		}
		void gatewayStream.stop();
		resetPendingRequests();
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
	}, [gatewayStream, resetPendingRequests]);

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

			if (
				msg.type === "res" &&
				msg.id &&
				msg.id === connectRequestIdRef.current
			) {
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
					setAutoConnectStatus(
						"Auto-connect paused due to auth failure. Update credentials and connect manually.",
					);
				}
				return;
			}

			if (msg.type === "event:agent" && msg.id) {
				for (const subscriber of agentEventSubscribersRef.current) {
					try {
						subscriber(msg);
					} catch (error) {
						const errorText =
							error instanceof Error
								? error.message
								: String(error || "Unknown subscriber error");
						logEvent(`Agent stream subscriber error: ${errorText}`);
					}
				}
				try {
					handleAgentEvent(msg.id, msg.payload);
				} catch (error) {
					const errorText =
						error instanceof Error
							? error.message
							: String(error || "Unknown error");
					logEvent(`Agent event processing error: ${errorText}`);
					flushQueuedAssistantUpdates();
					if (
						activeRequestIdRef.current === msg.id ||
						pendingRequestIdsRef.current.has(msg.id)
					) {
						finalizeAssistant(msg.id, {
							fallback: `Agent event processing error: ${errorText}`,
							forceText: true,
						});
					}
				}
				return;
			}

			if (msg.type === "error") {
				logEvent(`Gateway error: ${msg.payload?.message || "unknown"}`);
			}
		};

		ws.onerror = () => {
			void gatewayStream.stop();
			resetPendingRequests();
			setConnected(false);
			setConnecting(false);
			logEvent("WebSocket error");
			autoConnectFailureRef.current = true;
		};

		ws.onclose = () => {
			void gatewayStream.stop();
			resetPendingRequests();
			setConnected(false);
			setConnecting(false);
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
	}, [
		autoConnect,
		deviceId,
		disconnect,
		finalizeAssistant,
		flushQueuedAssistantUpdates,
		gatewayStream,
		handleAgentEvent,
		logEvent,
		password,
		refreshStats,
		token,
		wsUrl,
		connected,
		connecting,
		resetPendingRequests,
	]);

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
				appendLocalPromptMessagesToThread({
					thread,
					targetThreadId: targetThread!.id,
					userMessage,
					assistantMessage,
					attachmentPreview,
					now,
					defaultThreadName: DEFAULT_THREAD_NAME,
				}),
			),
		);
		setPrompt("");
		setAttachments([]);
		setAttachmentError("");
		requestThreadRef.current.set(requestId, targetThread.id);
		requestAgentRef.current.set(requestId, targetThread.agentId);
		registerPendingRequest(requestId);
		if (pendingRequestIdsRef.current.size > 1) {
			logEvent(
				`Queued prompt (${pendingRequestIdsRef.current.size - 1} waiting).`,
			);
		}
		void gatewayStream.submit(
			{
				requestId,
				agentId: targetThread.agentId,
				content: userMessage.content,
				attachments: attachments.length > 0 ? attachments : undefined,
			},
			{
				config: {
					configurable: {
						thread_id: targetThread.id,
					},
				},
			},
		);
	}, [
		activeThread,
		agentId,
		attachments,
		createThread,
		gatewayStream,
		loadThreadMessages,
		logEvent,
		prompt,
		registerPendingRequest,
	]);

	const stopPrompt = useCallback(() => {
		const requestId = resolveStoppableRequestId({
			activeRequestId: activeRequestIdRef.current,
			pendingRequestIds: pendingRequestIdsRef.current,
		});
		if (!requestId) return;

		try {
			sendGatewayMessage(buildCancelGatewayMessage(requestId, Date.now()));
		} catch {
			logEvent("Cancel signal could not be delivered; stopping local stream.");
		}

		const messageId = resolveRequestMessageId(requestId);
		const threadId = requestThreadRef.current.get(requestId);
		if (threadId) {
			setThreads((prev) =>
				prev.map((thread) => {
					if (thread.id !== threadId) return thread;
					return {
						...thread,
						messages: thread.messages.map((msg) => {
							if (msg.id !== messageId) return msg;
							if (!msg.content.trim()) {
								return { ...msg, content: "Request stopped." };
							}
							return msg;
						}),
					};
				}),
			);
		}
		logEvent("Stopping current response...");
		void gatewayStream.stop();
	}, [gatewayStream, logEvent, resolveRequestMessageId, sendGatewayMessage]);

	const uiStreaming = isStreaming;

	const clearChat = useCallback(async () => {
		if (!activeThread) return;
		if (uiStreaming) {
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
	}, [activeThread, uiStreaming, logEvent, stopVoicePlayback]);

	const deleteThread = useCallback(
		async (threadId: string) => {
			if (uiStreaming && activeThread?.id === threadId) {
				logEvent("Wait for the current response to finish");
				return;
			}
			const target = threads.find((thread) => thread.id === threadId);
			if (!target) return;
			try {
				const params = new URLSearchParams({ agentId: target.agentId });
				await fetch(
					`/api/sessions/${encodeURIComponent(threadId)}?${params.toString()}`,
					{
						method: "DELETE",
					},
				);
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
		[
			activeThread?.id,
			activeThreadId,
			uiStreaming,
			logEvent,
			stopVoicePlayback,
			threads,
		],
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
		setAutoConnect(
			storedAutoConnect !== null ? storedAutoConnect === "true" : true,
		);

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
					logEvent(
						`Failed to update voice config: ${message || "unknown error"}`,
					);
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
		const validAgentIds = new Set(agentOptions.map((agent) => agent.id));
		const preferredConfigAgent =
			config.defaultAgentId ||
			config.agents.find((agent) => agent.default)?.id ||
			config.agents[0]?.id;
		const defaultAgent =
			(preferredConfigAgent && validAgentIds.has(preferredConfigAgent)
				? preferredConfigAgent
				: undefined) ||
			agentOptions[0]?.id ||
			"main";
		setAgentId(defaultAgent);
	}, [config, agentOptions]);

	useEffect(() => {
		if (agentOptions.some((agent) => agent.id === agentId)) {
			return;
		}
		setAgentId(agentOptions[0]?.id || "main");
	}, [agentId, agentOptions]);

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

	const statusLabel = connected
		? "Connected"
		: connecting
			? "Connecting"
			: "Disconnected";
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
			reasoningEffort?: ReasoningEffort | null;
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
				reasoningEffort?: ReasoningEffort | null;
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
				const res = await fetch(
					`/api/webhooks/${encodeURIComponent(webhookId)}`,
					{
						method: "PUT",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(payload),
					},
				);
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
				const res = await fetch(
					`/api/webhooks/${encodeURIComponent(webhookId)}`,
					{
						method: "DELETE",
					},
				);
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
				const res = await fetch(
					`/api/providers/${encodeURIComponent(providerName)}`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({ token: tokenValue }),
					},
				);
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
				const res = await fetch(
					`/api/providers/${encodeURIComponent(providerName)}`,
					{
						method: "DELETE",
					},
				);
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
										isStreaming={uiStreaming}
										queuedPromptCount={queuedPromptCount}
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
										onStopPrompt={stopPrompt}
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

function extractTaskSubagentType(value: unknown): string | undefined {
	if (!value || typeof value !== "object") return undefined;
	const record = value as Record<string, unknown>;
	const direct =
		record.subagent_type ??
		record.subagentType ??
		record.subagent ??
		record.subAgent;
	if (typeof direct === "string" && direct.trim()) {
		return direct.trim();
	}
	return undefined;
}

function isAssistantPlaceholder(message: ChatMessage): boolean {
	return (
		message.role === "assistant" &&
		!message.content.trim() &&
		!message.uiTextFallback &&
		(!message.attachments || message.attachments.length === 0) &&
		(!message.toolEvents || message.toolEvents.length === 0) &&
		(!message.thinkingEvents || message.thinkingEvents.length === 0) &&
		(!message.uiBlocks || message.uiBlocks.length === 0)
	);
}

function upsertAssistantMessage(
	thread: Thread,
	messageId: string,
	update: (message: ChatMessage) => ChatMessage,
	placeholderId?: string,
): Thread {
	let found = false;
	const nextMessages = thread.messages.map((message) => {
		if (message.id !== messageId) return message;
		found = true;
		return update(message);
	});

	if (!found) {
		const seeded = update({
			id: messageId,
			role: "assistant",
			content: "",
			createdAt: Date.now(),
		});

		if (placeholderId && placeholderId !== messageId) {
			const placeholderIndex = nextMessages.findIndex(
				(message) =>
					message.id === placeholderId && isAssistantPlaceholder(message),
			);
			if (placeholderIndex >= 0) {
				nextMessages[placeholderIndex] = seeded;
			} else {
				nextMessages.push(seeded);
			}
		} else {
			nextMessages.push(seeded);
		}
	}

	return {
		...thread,
		messages: nextMessages,
		messageCount: Math.max(thread.messageCount ?? 0, nextMessages.length),
		updatedAt: Date.now(),
		messagesLoaded: true,
	};
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
	if (
		typeof window !== "undefined" &&
		typeof window.crypto?.randomUUID === "function"
	) {
		return window.crypto.randomUUID();
	}
	return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSessionMessage(message: ChatMessage): ChatMessage {
	const rawAttachments = Array.isArray((message as any)?.attachments)
		? ((message as any).attachments as any[])
		: [];
	const attachments = rawAttachments
		.map((attachment) => normalizeIncomingAttachment(attachment))
		.filter(Boolean) as ChatAttachment[];

	if (message.role !== "assistant") {
		return {
			...message,
			attachments: attachments.length > 0 ? attachments : undefined,
		};
	}

	return {
		...message,
		content: sanitizeAssistantDisplayText(message.content) ?? "",
		attachments: attachments.length > 0 ? attachments : undefined,
	};
}

function normalizeIncomingAttachment(raw: any): ChatAttachment | null {
	if (!raw || typeof raw !== "object") return null;

	const dataUrl = typeof raw.dataUrl === "string" ? raw.dataUrl : "";
	const textContent =
		typeof raw.textContent === "string" ? raw.textContent : undefined;
	const mimeType = typeof raw.mimeType === "string" ? raw.mimeType : undefined;
	const name = typeof raw.name === "string" ? raw.name : undefined;
	const size = typeof raw.size === "number" ? raw.size : undefined;

	const isAudio =
		raw.kind === "audio" ||
		mimeType?.startsWith("audio/") ||
		dataUrl.startsWith("data:audio/");
	const isFile =
		raw.kind === "file" ||
		(typeof textContent === "string" &&
			!isAudio &&
			!dataUrl.startsWith("data:image/"));

	if (isFile) {
		return {
			id:
				typeof raw.id === "string" && raw.id.trim().length > 0
					? raw.id
					: createAttachmentId(),
			kind: "file",
			dataUrl,
			textContent: textContent || "",
			mimeType,
			name,
			size,
		};
	}

	if (!dataUrl) return null;

	return {
		id:
			typeof raw.id === "string" && raw.id.trim().length > 0
				? raw.id
				: createAttachmentId(),
		kind: isAudio ? "audio" : "image",
		dataUrl,
		mimeType,
		name,
		size,
	};
}

function buildAgentFallback(
	result: unknown,
	requestId: string,
	uiOnlyRequests: Set<string>,
): string | undefined {
	if (!result) return undefined;
	if (uiOnlyRequests.has(requestId)) return undefined;
	if (typeof result === "object" && result !== null) {
		const record = result as Record<string, unknown>;
		if (
			typeof record.fallbackText === "string" &&
			record.fallbackText.trim().length > 0
		) {
			return sanitizeAssistantDisplayText(record.fallbackText);
		}
		const keys = Object.keys(result as Record<string, unknown>);
		if (keys.length === 1 && keys[0] === "streaming") {
			return undefined;
		}
	}
	try {
		return sanitizeAssistantDisplayText(JSON.stringify(result, null, 2));
	} catch {
		return sanitizeAssistantDisplayText(String(result));
	}
}

function readFileAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result || ""));
		reader.onerror = () =>
			reject(reader.error || new Error("Failed to read file"));
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
		return count > 1
			? "File and media attachments"
			: "File and media attachment";
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
