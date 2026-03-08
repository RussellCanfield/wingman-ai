import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type ChangeEvent,
	type ClipboardEvent,
} from "react";
import {
	Navigate,
	Route,
	Routes,
	useLocation,
	useNavigate,
} from "react-router-dom";
import {
	checkGatewayConnection,
	clearProviderToken,
	clearSessionMessages,
	createAgent,
	createSession,
	deleteSession,
	fetchAgentDetail,
	fetchAgents,
	fetchProviders,
	fetchSessionMessages,
	fetchSessions,
	fetchVoiceConfig,
	getGatewayHttpBase,
	mapSessionToThread,
	renameSession,
	setNodeEnabled,
	saveProviderToken,
	speakVoice,
	submitSmsInboundMessage,
	updateAgent,
	updateVoiceConfig,
} from "./lib/gatewayApi.js";
import {
	isGatewayConfigValid,
	normalizeGatewaySettings,
	resolveGatewayUiUrl,
	type GatewaySettings,
} from "./lib/gatewayConfig.js";
import type {
	AgentDetail,
	AgentRequestPayload,
	AgentSummary,
	ChatAttachment,
	ChatMessage,
	ConnectionStatus,
	GatewayConfig,
	GatewayHealth,
	GatewayStats,
	ProviderStatus,
	PromptTrainingConfig,
	SessionThread,
	ThinkingEvent,
	ToolEvent,
	VoiceConfig,
} from "./lib/gatewayModels.js";
import { GatewaySocketClient } from "./lib/gatewaySocket.js";
import {
	DEFAULT_PERMISSIONS,
	DEFAULT_PROFILE,
	normalizePermissionSnapshot,
	normalizePlatformProfile,
	statusLabel,
	type PermissionSnapshot,
	type PlatformProfile,
} from "./lib/platform.js";
import { shouldShowTranscriptionFire } from "./lib/overlayEffects.js";
import { parseStreamEvents } from "../../../shared/chat/streaming";
import { buildSyncSignature } from "./lib/syncSignature.js";
import { isTauriRuntime, invokeTauri } from "./lib/tauriBridge.js";
import { mergeGatewaySettingsFromNative } from "./lib/runtimeSettings.js";
import { summarizeGatewayConnectionFailure } from "./lib/connectionStatus.js";
import { shouldRouteToGatewayOnFailure } from "./lib/connectionRouting.js";
import { findThreadNeedingHydration } from "./lib/threadHydration.js";
import {
	buildDesktopChatRoute,
	getDisplayedThreadId,
	resolveRouteThreadSelection,
} from "./lib/threadRoute.js";
import { resolveTalkStopTranscript } from "./lib/talkToChat.js";
import {
	FILE_INPUT_ACCEPT,
	isPdfUploadFile,
	isSupportedTextUploadFile,
	readUploadFileText,
} from "./lib/fileUpload.js";
import {
	MAX_ATTACHMENTS,
	MAX_AUDIO_BYTES,
	MAX_FILE_BYTES,
	MAX_FILE_TEXT_CHARS,
	MAX_IMAGE_BYTES,
	MAX_PDF_BYTES,
	buildAttachmentPreviewText,
	clipFilePreview,
	createAttachmentId,
	extractImageFiles,
	formatAttachmentMeta,
	isAudioAttachment,
	isFileAttachment,
	isPdfAttachment,
	isVideoAttachment,
	readFileAsDataUrl,
	resolveGatewayMediaUrl,
} from "./lib/chatAttachments.js";
import { mergeUniqueAttachments } from "./lib/attachmentDedupe.js";
import { buildAgentCompletionNotice } from "./lib/notifications.js";
import {
	loadDesktopPreferences,
	saveDesktopPreferences,
} from "./lib/desktopPrefs.js";
import {
	formatSmsAllowlist,
	normalizeSmsAllowlistEntry,
	parseSmsAllowlistInput,
	resolveSmsBridgeTestHandle,
} from "./lib/smsBridgePreferences.js";
import {
	loadNodeNamePreference,
	saveNodeNamePreference,
} from "./nodeNamePrefs.js";
import {
	resolveSpeechVoice,
	resolveVoiceConfig,
	sanitizeForSpeech,
} from "./lib/voice.js";
import { shouldAutoSpeak } from "./lib/voiceAuto.js";
import {
	getVoicePlaybackLabel,
	type VoicePlaybackStatus,
} from "./lib/voicePlayback.js";
import {
	appendAgentEventText,
	buildSmsTargetForHandle,
	extractAgentTerminalText,
	getMacosMessagesLatestRowId,
	pollMacosMessages,
	sendMacosMessage,
	splitSmsBridgeReply,
} from "./lib/macosSmsBridge.js";
import {
	consumeSmsBridgeLoopback,
	isSmsBridgeSelfEcho,
	rememberSmsBridgeOutbound,
	normalizeSmsBridgeComparableText,
	type SmsBridgeLoopbackRecord,
} from "./lib/smsBridgeLoopback.js";
import { SguiRenderer } from "./sgui/SguiRenderer.js";
import {
	buildSubAgentCandidates,
	buildSubAgentPayloads,
	mapAgentDetailToDraftSeed,
	parseToolsCsv,
} from "./lib/agentsForm.js";
import {
	ensureSessionAssistantMessage,
	getSessionIdFromEventPayload,
	isSessionUserMessagePayload,
	upsertSessionUserMessage,
	type SessionMirrorEventPayload,
} from "./lib/sessionMirror.js";
import {
	clearStreamMessageTargets,
	resolveTextMessageTargetId,
	resolveToolMessageTargetId,
} from "./streamMessageRouter.js";
import { mergeAssistantStreamText } from "./lib/assistantStream.js";
import {
	collectWorkspaceLoadingTasks,
	formatSlowLoadEvent,
} from "./loadingState.js";
import { runWithInFlightGuard } from "./inFlight.js";
import {
	computeComposerTextareaLayout,
	resolveComposerStatusHint,
	shouldRefocusComposer,
} from "./composer.js";
import { DesktopBrandBadge } from "./components/DesktopBrandBadge.js";
import { TodoProgressPanel } from "./components/TodoProgressPanel.js";
import { ToolActivityRollup } from "./components/ToolActivityRollup.js";
import {
	AgentsIcon,
	AttachmentIcon,
	ChevronDownIcon,
	DocsIcon,
	EventsIcon,
	MicIcon,
	RuntimeIcon,
	SendIcon,
	SettingsIcon,
	SpeakerIcon,
	TrashIcon,
} from "./components/DesktopIcons.js";
import { DesktopShell } from "./components/DesktopShell.js";
import {
	type DesktopUtilityItem,
	DesktopSidebar,
} from "./components/DesktopSidebar.js";
import {
	resolveLastAssistantMessageId,
	shouldShowAssistantTypingIndicator,
} from "./chatStreamingIndicators.js";
import { extractLatestTodoSnapshotFromMessages } from "../../../shared/chat/todos";
import {
	groupTimelineBlocksForDisplay,
	groupToolEventsForDisplay,
} from "./lib/toolActivityRollup.js";
import {
	upsertTimelineTextBlock,
	upsertTimelineToolBlock,
} from "./lib/streamTimeline.js";
import {
	collapseToolOnlyAssistantMessages,
	type RenderableChatMessage,
} from "./lib/transcriptMessages.js";

type NativeState = {
	connected?: boolean;
	recording?: boolean;
	overlayVisible?: boolean;
	transcript?: string;
	speechStatus?: string;
	recordHotkey?: string;
	overlayHotkey?: string;
	quickSendOnRecordHotkey?: boolean;
	quickSendNonce?: number;
	gateway?: Partial<GatewaySettings>;
};

type RuntimeState = {
	connected: boolean;
	recording: boolean;
	overlayVisible: boolean;
	transcript: string;
	nativeRuntime: boolean;
	statusMessage: string;
	statusIsError: boolean;
	settings: GatewaySettings;
	platform: PlatformProfile;
	permissions: PermissionSnapshot;
	recognitionMessage: string;
	recognitionActive: boolean;
	settingsSavedAt: number;
	recordHotkey: string;
	overlayHotkey: string;
	quickSendOnRecordHotkey: boolean;
	quickSendNonce: number;
	autoConnectOnLaunch: boolean;
	notifyOnAgentFinish: boolean;
	enableNodeMode: boolean;
	nodeName: string;
	smsBridgeEnabled: boolean;
	smsBridgeAllowlist: string[];
};

type SmsBridgeHealth = {
	mode: "disabled" | "idle" | "running" | "error";
	lastPollAt: number | null;
	lastInboundAt: number | null;
	lastOutboundAt: number | null;
	lastError: string | null;
	processedInboundCount: number;
	skippedInboundCount: number;
	commandReplyCount: number;
	agentReplyCount: number;
	pendingReplyCount: number;
	logLines: string[];
};

type SpeechRecognitionLike = {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	onresult: ((event: Event) => void) | null;
	onerror: ((event: Event & { error?: string }) => void) | null;
	onend: (() => void) | null;
	start: () => void;
	stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;
type ToggleRecordingResult = {
	wasRecording: boolean;
	isRecording: boolean;
	transcriptBeforeToggle: string;
};

type ParsedToolStreamEvent = ToolEvent & {
	runId?: string;
	parentRunIds?: string[];
};

type ParsedStreamAttachmentEvent = {
	kind: "image" | "audio" | "file";
	dataUrl: string;
	textContent?: string;
	name?: string;
	mimeType?: string;
	size?: number;
	messageId?: string;
	isDelta?: boolean;
};

type WorkspaceState = {
	connectionStatus: ConnectionStatus;
	connectionMessage: string;
	checkingConnection: boolean;
	gatewayConfig?: GatewayConfig;
	gatewayHealth?: GatewayHealth;
	gatewayStats?: GatewayStats;
	providers: ProviderStatus[];
	providersLoading: boolean;
	providersUpdatedAt?: string;
	credentialsPath?: string;
	voiceConfig?: VoiceConfig;
	voiceConfigLoading: boolean;
	agentCatalog: AgentSummary[];
	agentDetail?: AgentDetail;
	availableTools: string[];
	agentsLoading: boolean;
	threads: SessionThread[];
	sessionsLoading: boolean;
	loadingMessagesThreadId: string | null;
	activeThreadId: string;
	selectedAgentId: string;
	prompt: string;
	attachments: ChatAttachment[];
	attachmentError: string;
	isStreaming: boolean;
	queuedPromptCount: number;
	nodeModeState: "disabled" | "enabling" | "enabled" | "error";
	nodeModeMessage: string;
	eventLog: string[];
	createAgentDraft: CreateAgentDraft;
	creatingAgent: boolean;
	agentFormMode: "create" | "edit";
	editTargetAgentId: string;
	agentDetailsById: Record<string, AgentDetail>;
	lastCompletion?: {
		nonce: number;
		threadId: string;
		messageId: string;
		threadName: string;
		agentId: string;
		preview: string;
	};
};

type CreateAgentDraft = {
	id: string;
	displayName: string;
	description: string;
	model: string;
	prompt: string;
	toolsCsv: string;
	promptTraining: boolean;
	selectedSubAgentIds: string[];
};

const STORAGE_KEY = "wingman.desktop.settings";
const DEVICE_KEY = "wingman.desktop.device";
const DEFAULT_THREAD_NAME = "New Session";
const DEFAULT_AGENT_PROMPT = "You are a helpful Wingman desktop agent.";
const NATIVE_SYNC_INTERVAL_MS = 1200;
const COMPOSER_MAX_LINES = 6;
const SMS_BRIDGE_CURSOR_STORAGE_KEY = "wingman.desktop.smsBridge.cursor.v1";
const SMS_BRIDGE_POLL_INTERVAL_MS = 4000;
const SMS_BRIDGE_POLL_LIMIT = 20;
const SMS_BRIDGE_LOG_LIMIT = 24;
const SMS_BRIDGE_AVAILABLE = false;
const SMS_BRIDGE_LOOPBACK_TTL_MS = 2 * 60 * 1000;
const SMS_BRIDGE_SKIP_BACKLOG_ON_START = true;
const SMS_BRIDGE_AGENT_REPLY_TIMEOUT_MS = 90 * 1000;

function createEmptyAgentDraft(): CreateAgentDraft {
	return {
		id: "",
		displayName: "",
		description: "",
		model: "",
		prompt: DEFAULT_AGENT_PROMPT,
		toolsCsv: "",
		promptTraining: false,
		selectedSubAgentIds: [],
	};
}

function createDefaultSmsBridgeHealth(): SmsBridgeHealth {
	return {
		mode: "disabled",
		lastPollAt: null,
		lastInboundAt: null,
		lastOutboundAt: null,
		lastError: null,
		processedInboundCount: 0,
		skippedInboundCount: 0,
		commandReplyCount: 0,
		agentReplyCount: 0,
		pendingReplyCount: 0,
		logLines: [],
	};
}

function loadSettings(): GatewaySettings {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		const parsed = raw ? (JSON.parse(raw) as Partial<GatewaySettings>) : {};
		return normalizeGatewaySettings(parsed);
	} catch {
		return normalizeGatewaySettings({});
	}
}

function persistSettings(settings: GatewaySettings): void {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function getDeviceId(): string {
	let existing = localStorage.getItem(DEVICE_KEY);
	if (existing) return existing;
	const next = `desktop-${window.crypto.randomUUID().slice(0, 8)}`;
	localStorage.setItem(DEVICE_KEY, next);
	return next;
}

function canUseWebSpeechRecognition(state: RuntimeState): boolean {
	if (state.nativeRuntime && state.platform.os === "macos") return false;
	return true;
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | undefined {
	const candidate = window as unknown as {
		SpeechRecognition?: SpeechRecognitionCtor;
		webkitSpeechRecognition?: SpeechRecognitionCtor;
	};
	return candidate.SpeechRecognition || candidate.webkitSpeechRecognition;
}

function mergeNativeState(
	prev: RuntimeState,
	next: NativeState | undefined,
): RuntimeState {
	if (!next) return prev;

	let changed = false;
	const merged: RuntimeState = { ...prev };

	if (
		typeof next.connected === "boolean" &&
		next.connected !== prev.connected
	) {
		merged.connected = next.connected;
		changed = true;
	}
	if (
		typeof next.recording === "boolean" &&
		next.recording !== prev.recording
	) {
		merged.recording = next.recording;
		changed = true;
	}
	if (
		typeof next.overlayVisible === "boolean" &&
		next.overlayVisible !== prev.overlayVisible
	) {
		merged.overlayVisible = next.overlayVisible;
		changed = true;
	}
	if (
		typeof next.transcript === "string" &&
		next.transcript !== prev.transcript
	) {
		merged.transcript = next.transcript;
		changed = true;
	}
	if (
		typeof next.speechStatus === "string" &&
		next.speechStatus !== prev.recognitionMessage
	) {
		merged.recognitionMessage = next.speechStatus;
		changed = true;
	}
	if (
		typeof next.recordHotkey === "string" &&
		next.recordHotkey !== prev.recordHotkey
	) {
		merged.recordHotkey = next.recordHotkey;
		changed = true;
	}
	if (
		typeof next.overlayHotkey === "string" &&
		next.overlayHotkey !== prev.overlayHotkey
	) {
		merged.overlayHotkey = next.overlayHotkey;
		changed = true;
	}
	if (
		typeof next.quickSendOnRecordHotkey === "boolean" &&
		next.quickSendOnRecordHotkey !== prev.quickSendOnRecordHotkey
	) {
		merged.quickSendOnRecordHotkey = next.quickSendOnRecordHotkey;
		changed = true;
	}
	if (
		typeof next.quickSendNonce === "number" &&
		next.quickSendNonce !== prev.quickSendNonce
	) {
		merged.quickSendNonce = next.quickSendNonce;
		changed = true;
	}
	if (next.gateway) {
		const settings = mergeGatewaySettingsFromNative(
			prev.settings,
			next.gateway,
		);
		if (JSON.stringify(settings) !== JSON.stringify(prev.settings)) {
			merged.settings = settings;
			merged.settingsSavedAt = Date.now();
			persistSettings(settings);
			changed = true;
		}
	}

	return changed ? merged : prev;
}

function mapSessionName(prompt: string, fallback: string): string {
	const normalized = prompt.trim();
	if (!normalized) return fallback;
	return normalized.slice(0, 36);
}

function mergeToolEvents(
	existing: ToolEvent[] | undefined,
	next: ToolEvent[],
): ToolEvent[] {
	const byId = new Map<string, ToolEvent>();
	for (const item of existing || []) {
		byId.set(item.id, item);
	}
	for (const item of next) {
		const current = byId.get(item.id);
		if (!current) {
			byId.set(item.id, {
				...item,
				startedAt: item.startedAt ?? item.timestamp,
				completedAt:
					item.completedAt ??
					(item.status === "completed" || item.status === "error"
						? item.timestamp
						: undefined),
			});
			continue;
		}
		byId.set(item.id, {
			...current,
			...item,
			name:
				item.name && item.name !== "tool"
					? item.name
					: current.name || item.name,
			node: item.node || current.node,
			actor: item.actor || current.actor,
			runId: item.runId || current.runId,
			parentRunIds: item.parentRunIds || current.parentRunIds,
			delegatedByTaskId: item.delegatedByTaskId || current.delegatedByTaskId,
			delegatedSubagentType:
				item.delegatedSubagentType || current.delegatedSubagentType,
			args: item.args ?? current.args,
			output: item.output ?? current.output,
			ui: item.ui ?? current.ui,
			uiOnly: item.uiOnly ?? current.uiOnly,
			textFallback: item.textFallback ?? current.textFallback,
			error: item.error ?? current.error,
			timestamp: item.timestamp ?? current.timestamp,
			startedAt:
				current.startedAt ?? item.startedAt ?? item.timestamp ?? current.timestamp,
			completedAt:
				item.completedAt ??
				(item.status === "completed" || item.status === "error"
					? (item.timestamp ?? current.completedAt)
					: current.completedAt),
			streamOrder: current.streamOrder ?? item.streamOrder,
		});
	}
	return [...byId.values()].sort((a, b) => {
		const aTime =
			a.streamOrder ?? a.startedAt ?? a.timestamp ?? a.completedAt ?? 0;
		const bTime =
			b.streamOrder ?? b.startedAt ?? b.timestamp ?? b.completedAt ?? 0;
		return aTime - bTime;
	});
}

function deriveUiBlocks(
	toolEvents: ToolEvent[] | undefined,
): ChatMessage["uiBlocks"] {
	if (!toolEvents || toolEvents.length === 0) return undefined;
	const blocks: NonNullable<ChatMessage["uiBlocks"]> = [];
	for (const toolEvent of toolEvents) {
		if (!toolEvent.ui) continue;
		blocks.push({
			id: toolEvent.id,
			spec: toolEvent.ui,
			uiOnly: toolEvent.uiOnly,
			textFallback: toolEvent.textFallback,
		});
	}
	return blocks.length > 0 ? blocks : undefined;
}

function updateAssistantMessage(
	thread: SessionThread,
	messageId: string,
	update: (message: ChatMessage) => ChatMessage,
): SessionThread {
	let found = false;
	const updated = thread.messages.map((message) => {
		if (message.id !== messageId) return message;
		found = true;
		return update(message);
	});
	if (!found) {
		const seeded: ChatMessage = update({
			id: messageId,
			role: "assistant",
			content: "",
			createdAt: Date.now(),
		});
		updated.push(seeded);
	}
	return {
		...thread,
		messages: updated,
		messageCount: Math.max(thread.messageCount || 0, updated.length),
		updatedAt: Date.now(),
		messagesLoaded: true,
	};
}

function normalizeStreamAttachment(
	raw: ParsedStreamAttachmentEvent,
	gatewayBase: string,
): ChatAttachment | null {
	const kind =
		typeof raw.kind === "string" &&
			(raw.kind === "image" || raw.kind === "audio" || raw.kind === "file")
			? raw.kind
			: null;
	const dataUrl =
		typeof raw.dataUrl === "string"
			? resolveGatewayMediaUrl(raw.dataUrl, gatewayBase)
			: "";
	if (!kind || !dataUrl) return null;

	const textContent =
		kind === "file" && typeof raw.textContent === "string"
			? raw.textContent
			: undefined;
	const name = typeof raw.name === "string" ? raw.name : undefined;
	const mimeType = typeof raw.mimeType === "string" ? raw.mimeType : undefined;
	const size =
		typeof raw.size === "number" && Number.isFinite(raw.size)
			? raw.size
			: undefined;

	return {
		id: createAttachmentId(),
		kind,
		dataUrl,
		textContent,
		name,
		mimeType,
		size,
	};
}

function mergeStreamAttachments(
	existing: ChatAttachment[] | undefined,
	incoming: ChatAttachment[],
): ChatAttachment[] | undefined {
	if (incoming.length === 0) return existing;
	const merged = mergeUniqueAttachments(existing || [], incoming);
	return merged.length > 0 ? merged : undefined;
}

function useRuntimeController(isOverlayView: boolean) {
	const [state, setState] = useState<RuntimeState>(() => {
		const desktopPrefs = loadDesktopPreferences();
		return {
			connected: false,
			recording: false,
			overlayVisible: false,
			transcript: "",
			nativeRuntime: isTauriRuntime(),
			statusMessage: "Disconnected",
			statusIsError: false,
			settings: loadSettings(),
			platform: DEFAULT_PROFILE,
			permissions: DEFAULT_PERMISSIONS,
			recognitionMessage: "Native speech idle.",
			recognitionActive: false,
			settingsSavedAt: Date.now(),
			recordHotkey: "CommandOrControl+Shift+R",
			overlayHotkey: "CommandOrControl+Shift+O",
			quickSendOnRecordHotkey: true,
			quickSendNonce: 0,
			autoConnectOnLaunch: desktopPrefs.autoConnectOnLaunch,
			notifyOnAgentFinish: desktopPrefs.notifyOnAgentFinish,
			enableNodeMode: desktopPrefs.enableNodeMode,
			nodeName: loadNodeNamePreference(),
			smsBridgeEnabled: SMS_BRIDGE_AVAILABLE
				? desktopPrefs.smsBridgeEnabled
				: false,
			smsBridgeAllowlist: desktopPrefs.smsBridgeAllowlist,
		};
	});

	const stateRef = useRef(state);
	const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
	const speechUnavailableNotifiedRef = useRef(false);
	const lastSyncSignatureRef = useRef("");
	const nativeSyncInFlightRef = useRef(false);

	useEffect(() => {
		stateRef.current = state;
	}, [state]);

	const setStatus = useCallback((message: string, isError = false) => {
		setState((prev) => {
			if (prev.statusMessage === message && prev.statusIsError === isError) {
				return prev;
			}
			return { ...prev, statusMessage: message, statusIsError: isError };
		});
	}, []);

	const setRecognitionMessage = useCallback((message: string) => {
		setState((prev) => {
			if (prev.recognitionMessage === message) return prev;
			return { ...prev, recognitionMessage: message };
		});
	}, []);

	const applyNativeState = useCallback((next: NativeState | undefined) => {
		setState((prev) => mergeNativeState(prev, next));
	}, []);

	const ensureRecognizer = useCallback((): SpeechRecognitionLike | null => {
		if (!canUseWebSpeechRecognition(stateRef.current)) return null;
		if (recognitionRef.current) return recognitionRef.current;

		const Ctor = getSpeechRecognitionCtor();
		if (!Ctor) return null;

		const recognizer = new Ctor();
		recognizer.continuous = true;
		recognizer.interimResults = true;
		recognizer.lang = "en-US";

		recognizer.onresult = (event: Event) => {
			const speechEvent = event as Event & {
				results?: ArrayLike<{
					0?: { transcript?: string };
				}>;
			};
			const results = speechEvent.results;
			if (!results) return;

			const chunks: string[] = [];
			for (let index = 0; index < results.length; index += 1) {
				const text = results[index]?.[0]?.transcript?.trim();
				if (text) chunks.push(text);
			}
			const transcript = chunks.join(" ").replace(/\s+/g, " ").trim();
			if (!transcript) return;

			setState((prev) => ({
				...prev,
				transcript,
				recognitionMessage: "Transcribing live audio.",
			}));

			if (stateRef.current.nativeRuntime) {
				void invokeTauri("set_transcript", { transcript }).catch(() => {
					// no-op
				});
			}
		};

		recognizer.onerror = (event) => {
			const error = event.error || "unknown";
			setRecognitionMessage(`Recognizer error: ${error}`);
			setStatus(`Speech recognition error: ${error}`, true);
		};

		recognizer.onend = () => {
			setState((prev) => ({ ...prev, recognitionActive: false }));
			if (isOverlayView && stateRef.current.recording) {
				void startRecognition();
			}
		};

		recognitionRef.current = recognizer;
		return recognizer;
	}, [isOverlayView, setRecognitionMessage, setStatus]);

	const stopRecognition = useCallback(() => {
		const recognition = recognitionRef.current;
		if (!recognition || !stateRef.current.recognitionActive) return;
		try {
			recognition.stop();
		} catch {
			// no-op
		}
		setState((prev) => ({
			...prev,
			recognitionActive: false,
			recognitionMessage: "Recognizer stopped.",
		}));
	}, []);

	const startRecognition = useCallback(async () => {
		const current = stateRef.current;
		if (!isOverlayView || !current.recording || current.recognitionActive)
			return;

		if (!canUseWebSpeechRecognition(current)) {
			setRecognitionMessage("Using native speech adapter.");
			setStatus("Listening...", false);
			return;
		}

		const recognition = ensureRecognizer();
		if (!recognition) {
			if (!speechUnavailableNotifiedRef.current) {
				speechUnavailableNotifiedRef.current = true;
				setRecognitionMessage(
					"SpeechRecognition API unavailable in this webview.",
				);
				setStatus("Speech recognition is unavailable in this runtime.", true);
			}
			return;
		}

		try {
			recognition.start();
			setState((prev) => ({
				...prev,
				recognitionActive: true,
				recognitionMessage: "Recognizer started.",
			}));
		} catch {
			setRecognitionMessage(
				"Recognizer start blocked. Click Start in overlay to grant access.",
			);
		}
	}, [ensureRecognizer, isOverlayView, setRecognitionMessage, setStatus]);

	const syncRecognitionLifecycle = useCallback(() => {
		if (!stateRef.current.recording) {
			stopRecognition();
		}
	}, [stopRecognition]);

	const refreshNativeContext = useCallback(async () => {
		if (!stateRef.current.nativeRuntime) return;

		const [profilePayload, permissionsPayload, nativeState] = await Promise.all(
			[
				invokeTauri<Partial<PlatformProfile>>("get_platform_profile"),
				invokeTauri<Partial<PermissionSnapshot>>("get_permission_snapshot"),
				invokeTauri<NativeState>("get_state"),
			],
		);

		const profile = normalizePlatformProfile(profilePayload);
		const permissions = normalizePermissionSnapshot(permissionsPayload);

		const signature = buildSyncSignature({
			profile,
			permissions,
			nativeState: nativeState || {},
		});
		if (signature === lastSyncSignatureRef.current) return;
		lastSyncSignatureRef.current = signature;

		setState((prev) => {
			const withProfile =
				JSON.stringify(prev.platform) === JSON.stringify(profile)
					? prev
					: { ...prev, platform: profile };
			const withPermissions =
				JSON.stringify(withProfile.permissions) === JSON.stringify(permissions)
					? withProfile
					: { ...withProfile, permissions };
			return mergeNativeState(withPermissions, nativeState);
		});
	}, []);

	const toggleRecording =
		useCallback(async (): Promise<ToggleRecordingResult> => {
			const currentState = stateRef.current;
			const wasRecording = currentState.recording;
			const transcriptBeforeToggle = currentState.transcript;

			if (stateRef.current.nativeRuntime) {
				const next = await invokeTauri<NativeState>(
					"toggle_recording_with_window",
				);
				applyNativeState(next);
				setStatus(
					stateRef.current.recording ? "Listening..." : "Recording stopped.",
				);
				if (!stateRef.current.recording) {
					syncRecognitionLifecycle();
				}
				return {
					wasRecording,
					isRecording:
						typeof next?.recording === "boolean"
							? next.recording
							: !wasRecording,
					transcriptBeforeToggle,
				};
			}

			const nextRecording = !stateRef.current.recording;
			setState((prev) => ({
				...prev,
				recording: nextRecording,
				overlayVisible: nextRecording,
				transcript: nextRecording ? "" : prev.transcript,
				statusMessage: nextRecording ? "Listening..." : "Recording stopped.",
				statusIsError: false,
			}));

			if (nextRecording) {
				await startRecognition();
			} else {
				syncRecognitionLifecycle();
			}
			return {
				wasRecording,
				isRecording: nextRecording,
				transcriptBeforeToggle,
			};
		}, [
			applyNativeState,
			setStatus,
			startRecognition,
			syncRecognitionLifecycle,
		]);

	const toggleOverlay = useCallback(async () => {
		if (stateRef.current.nativeRuntime) {
			const next = await invokeTauri<NativeState>("toggle_overlay");
			applyNativeState(next);
			setStatus(
				stateRef.current.overlayVisible ? "Overlay shown." : "Overlay hidden.",
			);
			return;
		}

		setState((prev) => ({
			...prev,
			overlayVisible: !prev.overlayVisible,
			statusMessage: !prev.overlayVisible
				? "Overlay shown."
				: "Overlay hidden.",
			statusIsError: false,
		}));
	}, [applyNativeState, setStatus]);

	const updateSetting = useCallback(
		(key: keyof GatewaySettings, value: string) => {
			setState((prev) => {
				const settings = normalizeGatewaySettings({
					...prev.settings,
					[key]: value,
				});
				persistSettings(settings);
				return { ...prev, settings, settingsSavedAt: Date.now() };
			});

			if (key === "url" && stateRef.current.nativeRuntime) {
				const url = normalizeGatewaySettings({
					...stateRef.current.settings,
					[key]: value,
				}).url;
				void invokeTauri("set_gateway_url", { url }).catch(() => {
					// no-op
				});
			}
		},
		[],
	);

	const persistRuntimeDesktopPrefs = useCallback((next: RuntimeState) => {
		saveDesktopPreferences({
			autoConnectOnLaunch: next.autoConnectOnLaunch,
			notifyOnAgentFinish: next.notifyOnAgentFinish,
			enableNodeMode: next.enableNodeMode,
			smsBridgeEnabled: next.smsBridgeEnabled,
			smsBridgeAllowlist: next.smsBridgeAllowlist,
		});
	}, []);

	const updateAutoConnectOnLaunch = useCallback(
		(enabled: boolean) => {
			setState((prev) => {
				const next = { ...prev, autoConnectOnLaunch: enabled };
				persistRuntimeDesktopPrefs(next);
				return next;
			});
		},
		[persistRuntimeDesktopPrefs],
	);

	const updateNotifyOnAgentFinish = useCallback(
		(enabled: boolean) => {
			setState((prev) => {
				const next = { ...prev, notifyOnAgentFinish: enabled };
				persistRuntimeDesktopPrefs(next);
				return next;
			});
		},
		[persistRuntimeDesktopPrefs],
	);

	const updateEnableNodeMode = useCallback(
		(enabled: boolean) => {
			setState((prev) => {
				const next = { ...prev, enableNodeMode: enabled };
				persistRuntimeDesktopPrefs(next);
				return next;
			});
		},
		[persistRuntimeDesktopPrefs],
	);

	const updateSmsBridgeEnabled = useCallback(
		(enabled: boolean) => {
			setState((prev) => {
				const next = {
					...prev,
					smsBridgeEnabled: SMS_BRIDGE_AVAILABLE ? enabled : false,
				};
				persistRuntimeDesktopPrefs(next);
				return next;
			});
		},
		[persistRuntimeDesktopPrefs],
	);

	const updateSmsBridgeAllowlist = useCallback(
		(rawInput: string) => {
			const parsed = parseSmsAllowlistInput(rawInput);
			setState((prev) => {
				const next = { ...prev, smsBridgeAllowlist: parsed };
				persistRuntimeDesktopPrefs(next);
				return next;
			});
			return parsed;
		},
		[persistRuntimeDesktopPrefs],
	);

	const updateNodeName = useCallback((nodeName: string) => {
		saveNodeNamePreference(nodeName);
		setState((prev) => {
			return { ...prev, nodeName };
		});
	}, []);

	const updateTranscript = useCallback(
		async (transcript: string) => {
			setState((prev) => ({ ...prev, transcript }));
			if (stateRef.current.nativeRuntime) {
				const next = await invokeTauri<NativeState>("set_transcript", {
					transcript,
				});
				applyNativeState(next);
			}
		},
		[applyNativeState],
	);

	const clearTranscript = useCallback(async () => {
		if (stateRef.current.nativeRuntime) {
			const next = await invokeTauri<NativeState>("clear_transcript");
			applyNativeState(next);
			return;
		}
		setState((prev) => ({ ...prev, transcript: "" }));
	}, [applyNativeState]);

	const hideOverlay = useCallback(async () => {
		stopRecognition();
		if (stateRef.current.nativeRuntime) {
			const next = await invokeTauri<NativeState>("hide_overlay");
			applyNativeState(next);
		}
		setState((prev) => ({
			...prev,
			overlayVisible: false,
			recording: false,
			recognitionActive: false,
			statusMessage: "Overlay hidden.",
			statusIsError: false,
		}));
	}, [applyNativeState, stopRecognition]);

	const saveHotkeySettings = useCallback(
		async (payload: {
			recordHotkey: string;
			overlayHotkey: string;
			quickSendOnRecordHotkey: boolean;
		}) => {
			const recordHotkey = payload.recordHotkey.trim();
			const overlayHotkey = payload.overlayHotkey.trim();
			if (!recordHotkey || !overlayHotkey) {
				setStatus("Hotkeys cannot be empty.", true);
				return false;
			}
			if (!stateRef.current.nativeRuntime) {
				setState((prev) => ({
					...prev,
					recordHotkey,
					overlayHotkey,
					quickSendOnRecordHotkey: payload.quickSendOnRecordHotkey,
				}));
				setStatus("Saved hotkey preferences.");
				return true;
			}
			try {
				const next = await invokeTauri<NativeState>("set_hotkey_settings", {
					recordHotkey,
					overlayHotkey,
					quickSendOnRecordHotkey: payload.quickSendOnRecordHotkey,
				});
				applyNativeState(next);
				setStatus("Updated global hotkeys.");
				return true;
			} catch (error) {
				setStatus(`Failed to update hotkeys: ${String(error)}`, true);
				return false;
			}
		},
		[applyNativeState, setStatus],
	);

	const clearQuickSend = useCallback(async () => {
		if (!stateRef.current.nativeRuntime) return;
		try {
			const next = await invokeTauri<NativeState>("clear_quick_send");
			applyNativeState(next);
		} catch {
			// no-op
		}
	}, [applyNativeState]);

	const queueQuickSend = useCallback(async () => {
		if (!stateRef.current.nativeRuntime) {
			setStatus(
				"Quick-send queue is only available in the native runtime.",
				true,
			);
			return false;
		}
		try {
			const next = await invokeTauri<NativeState>("queue_quick_send");
			applyNativeState(next);
			setStatus("Queued transcript for send to the active chat session.");
			return true;
		} catch (error) {
			setStatus(`Failed to queue transcript send: ${String(error)}`, true);
			return false;
		}
	}, [applyNativeState, setStatus]);

	const openPermissionSettings = useCallback(
		async (permissionId: string) => {
			if (!stateRef.current.nativeRuntime) {
				setStatus("Permission links require the native Tauri runtime.", true);
				return;
			}
			const result = await invokeTauri<void>("open_permission_settings", {
				permissionId,
			}).catch((error: unknown) => {
				setStatus(`Failed to open permission settings: ${String(error)}`, true);
				return undefined;
			});
			if (result !== undefined) {
				setStatus("Opened system permission settings.");
			}
		},
		[setStatus],
	);

	const sendNotification = useCallback(
		async (payload: { title?: string; body: string }) => {
			if (!stateRef.current.nativeRuntime) {
				setStatus(
					"Desktop notifications require the native Tauri runtime.",
					true,
				);
				return false;
			}
			try {
				await invokeTauri<void>("send_notification", payload);
				return true;
			} catch (error) {
				setStatus(`Failed to send notification: ${String(error)}`, true);
				return false;
			}
		},
		[setStatus],
	);

	const sendTestNotification = useCallback(async () => {
		if (!stateRef.current.nativeRuntime) {
			setStatus("Notification tests require the native Tauri runtime.", true);
			return false;
		}
		try {
			const ok = await sendNotification({
				title: "Wingman Desktop",
				body: "Notifications are enabled and working.",
			});
			if (!ok) return false;
			setStatus(
				"Scheduled test notification. macOS may ask for notification permission if needed.",
			);
			await refreshNativeContext();
			return true;
		} catch (error) {
			setStatus(`Failed to send test notification: ${String(error)}`, true);
			return false;
		}
	}, [refreshNativeContext, sendNotification, setStatus]);

	useEffect(() => {
		if (!state.nativeRuntime) return;
		let cancelled = false;

		const tick = async () => {
			if (nativeSyncInFlightRef.current) return;
			nativeSyncInFlightRef.current = true;
			try {
				await refreshNativeContext();
				if (!cancelled) {
					syncRecognitionLifecycle();
				}
			} catch (error) {
				setStatus(`Runtime sync failed: ${String(error)}`, true);
			} finally {
				nativeSyncInFlightRef.current = false;
			}
		};

		const startup = window.setTimeout(() => {
			void tick();
		}, 0);
		const timer = window.setInterval(() => {
			void tick();
		}, NATIVE_SYNC_INTERVAL_MS);
		return () => {
			cancelled = true;
			window.clearTimeout(startup);
			window.clearInterval(timer);
		};
	}, [
		refreshNativeContext,
		setStatus,
		state.nativeRuntime,
		syncRecognitionLifecycle,
	]);

	useEffect(() => {
		if (!isOverlayView) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				void hideOverlay();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [hideOverlay, isOverlayView]);

	return {
		state,
		setStatus,
		actions: {
			toggleRecording,
			toggleOverlay,
			updateSetting,
			updateAutoConnectOnLaunch,
			updateNotifyOnAgentFinish,
			updateEnableNodeMode,
			updateSmsBridgeEnabled,
			updateSmsBridgeAllowlist,
			updateNodeName,
			updateTranscript,
			clearTranscript,
			hideOverlay,
			openPermissionSettings,
			sendNotification,
			sendTestNotification,
			startRecognition,
			saveHotkeySettings,
			clearQuickSend,
			queueQuickSend,
		},
		canUseWebSpeechRecognition: canUseWebSpeechRecognition(state),
	};
}

function useGatewayWorkspace(
	settings: GatewaySettings,
	enableNodeMode: boolean,
	nodeName: string,
	setGlobalStatus: (message: string, isError?: boolean) => void,
) {
	const gatewayHttpBase = getGatewayHttpBase(settings);
	const [workspace, setWorkspace] = useState<WorkspaceState>({
		connectionStatus: "disconnected",
		connectionMessage: "Not connected to gateway",
		checkingConnection: false,
		providers: [],
		providersLoading: false,
		providersUpdatedAt: undefined,
		credentialsPath: undefined,
		voiceConfig: undefined,
		voiceConfigLoading: false,
		agentCatalog: [],
		agentDetail: undefined,
		availableTools: [],
		agentsLoading: false,
		threads: [],
		sessionsLoading: false,
		loadingMessagesThreadId: null,
		activeThreadId: "",
		selectedAgentId: settings.agentId || "main",
		prompt: "",
		attachments: [],
		attachmentError: "",
		isStreaming: false,
		queuedPromptCount: 0,
		nodeModeState: "disabled",
		nodeModeMessage: "Node mode disabled",
		eventLog: [],
		createAgentDraft: createEmptyAgentDraft(),
		creatingAgent: false,
		agentFormMode: "create",
		editTargetAgentId: settings.agentId || "main",
		agentDetailsById: {},
	});

	const activeThread = useMemo(
		() =>
			workspace.threads.find(
				(thread) => thread.id === workspace.activeThreadId,
			),
		[workspace.activeThreadId, workspace.threads],
	);

	const socketRef = useRef<GatewaySocketClient | null>(null);
	const requestThreadRef = useRef<Map<string, string>>(new Map());
	const requestMessageRef = useRef<Map<string, string>>(new Map());
	const requestStreamMessageRef = useRef<Map<string, Map<string, string>>>(
		new Map(),
	);
	const requestStreamOrderRef = useRef<Map<string, number>>(new Map());
	const timelineActiveTextBlockRef = useRef<Map<string, string>>(new Map());
	const timelineActiveTextOrderRef = useRef<Map<string, number>>(new Map());
	const timelineLastKindRef = useRef<Map<string, "text" | "tool">>(new Map());
	const completionNonceRef = useRef(0);
	const subscribedRef = useRef<Set<string>>(new Set());
	const loadingMessagesRef = useRef<Set<string>>(new Set());
	const pendingRequestIdsRef = useRef<Set<string>>(new Set());
	const activeGatewayRequestIdRef = useRef<string | null>(null);
	const deviceIdRef = useRef<string>(getDeviceId());
	const agentDetailsRef = useRef<Record<string, AgentDetail>>({});
	const sessionsRefreshInFlightRef = useRef<Promise<void> | null>(null);
	const agentsRefreshInFlightRef = useRef<Promise<void> | null>(null);
	const providersRefreshInFlightRef = useRef<Promise<void> | null>(null);
	const voiceRefreshInFlightRef = useRef<Promise<void> | null>(null);

	const logEvent = useCallback((message: string) => {
		setWorkspace((prev) => ({
			...prev,
			eventLog: [message, ...prev.eventLog].slice(0, 30),
		}));
	}, []);

	const syncRequestStreamingState = useCallback(() => {
		const pendingSize = pendingRequestIdsRef.current.size;
		const hasActive = Boolean(activeGatewayRequestIdRef.current);
		const queuedPromptCount = Math.max(pendingSize - (hasActive ? 1 : 0), 0);
		setWorkspace((prev) => ({
			...prev,
			isStreaming: pendingSize > 0,
			queuedPromptCount,
		}));
	}, []);

	const getRequestMessageIds = useCallback((requestId: string): string[] => {
		const ids = new Set<string>();
		const baseMessageId = requestMessageRef.current.get(requestId) || requestId;
		ids.add(baseMessageId);
		const requestTargets = requestStreamMessageRef.current.get(requestId);
		for (const messageId of requestTargets?.values() || []) {
			ids.add(messageId);
		}
		return [...ids];
	}, []);

	const nextStreamOrder = useCallback((requestId: string): number => {
		const current = requestStreamOrderRef.current.get(requestId) || 0;
		const next = current + 1;
		requestStreamOrderRef.current.set(requestId, next);
		return next;
	}, []);

	const clearRequestTimelineState = useCallback(
		(requestId: string) => {
			for (const messageId of getRequestMessageIds(requestId)) {
				timelineActiveTextBlockRef.current.delete(messageId);
				timelineActiveTextOrderRef.current.delete(messageId);
				timelineLastKindRef.current.delete(messageId);
			}
			requestStreamOrderRef.current.delete(requestId);
		},
		[getRequestMessageIds],
	);

	const registerPendingRequest = useCallback(
		(requestId: string) => {
			pendingRequestIdsRef.current.add(requestId);
			if (!activeGatewayRequestIdRef.current) {
				activeGatewayRequestIdRef.current = requestId;
			}
			syncRequestStreamingState();
		},
		[syncRequestStreamingState],
	);

	const markRequestActive = useCallback(
		(requestId: string) => {
			if (!pendingRequestIdsRef.current.has(requestId)) return;
			if (activeGatewayRequestIdRef.current === requestId) return;
			activeGatewayRequestIdRef.current = requestId;
			syncRequestStreamingState();
		},
		[syncRequestStreamingState],
	);

	const finalizePendingRequest = useCallback(
		(requestId: string) => {
			pendingRequestIdsRef.current.delete(requestId);
			clearRequestTimelineState(requestId);
			clearStreamMessageTargets(requestStreamMessageRef.current, requestId);
			if (activeGatewayRequestIdRef.current === requestId) {
				activeGatewayRequestIdRef.current = null;
			}
			syncRequestStreamingState();
		},
		[clearRequestTimelineState, syncRequestStreamingState],
	);

	const resetPendingRequests = useCallback(() => {
		for (const requestId of pendingRequestIdsRef.current) {
			clearRequestTimelineState(requestId);
		}
		pendingRequestIdsRef.current.clear();
		activeGatewayRequestIdRef.current = null;
		requestStreamMessageRef.current.clear();
		syncRequestStreamingState();
	}, [clearRequestTimelineState, syncRequestStreamingState]);

	const resolveTrackedGatewayRequestId = useCallback(
		(requestId: string | null | undefined): string | null => {
			const normalizedRequestId =
				typeof requestId === "string" ? requestId.trim() : "";
			if (
				normalizedRequestId &&
				pendingRequestIdsRef.current.has(normalizedRequestId)
			) {
				return normalizedRequestId;
			}
			const activeRequestId = activeGatewayRequestIdRef.current;
			if (activeRequestId && pendingRequestIdsRef.current.has(activeRequestId)) {
				return activeRequestId;
			}
			if (pendingRequestIdsRef.current.size === 1) {
				const onlyPending = pendingRequestIdsRef.current.values().next().value;
				if (typeof onlyPending === "string" && onlyPending.trim()) {
					return onlyPending;
				}
			}
			return null;
		},
		[],
	);

	const applyGatewayRequestFailure = useCallback(
		(input: { requestId?: string | null; errorText?: string }): boolean => {
			const resolvedRequestId = resolveTrackedGatewayRequestId(input.requestId);
			if (!resolvedRequestId) return false;
			const errorText =
				typeof input.errorText === "string" && input.errorText.trim()
					? input.errorText.trim()
					: "Agent error";
			const threadId = requestThreadRef.current.get(resolvedRequestId);
			const messageId =
				requestMessageRef.current.get(resolvedRequestId) || resolvedRequestId;
			if (threadId) {
				setWorkspace((prev) => ({
					...prev,
					threads: prev.threads.map((thread) => {
						if (thread.id !== threadId) return thread;
						return updateAssistantMessage(thread, messageId, (message) => {
							const existing = message.content.trim();
							if (!existing) {
								return { ...message, content: errorText };
							}
							if (existing.includes(errorText)) {
								return message;
							}
							return {
								...message,
								content: `${message.content.trimEnd()}\n\n${errorText}`,
							};
						});
					}),
				}));
			}
			finalizePendingRequest(resolvedRequestId);
			requestThreadRef.current.delete(resolvedRequestId);
			requestMessageRef.current.delete(resolvedRequestId);
			return true;
		},
		[finalizePendingRequest, resolveTrackedGatewayRequestId],
	);

	useEffect(() => {
		agentDetailsRef.current = workspace.agentDetailsById;
	}, [workspace.agentDetailsById]);

	const refreshSessionsData = useCallback(
		async (options?: { silent?: boolean }) => {
			return runWithInFlightGuard(sessionsRefreshInFlightRef, async () => {
				const startedAt = performance.now();
				const silent = options?.silent === true;
				if (!silent) {
					setWorkspace((prev) => ({ ...prev, sessionsLoading: true }));
				}
				try {
					const sessions = await fetchSessions(settings, { limit: 200 });
					setWorkspace((prev) => {
						const mapped = sessions.map((session) =>
							mapSessionToThread(session),
						);
						const next = mapped.map((thread) => {
							const existing = prev.threads.find(
								(item) => item.id === thread.id,
							);
							if (!existing?.messagesLoaded) return thread;
							return {
								...thread,
								messages: existing.messages,
								messagesLoaded: true,
							};
						});
						const activeThreadId = prev.activeThreadId
							? next.find((item) => item.id === prev.activeThreadId)
								? prev.activeThreadId
								: ""
							: "";
						return {
							...prev,
							threads: next,
							activeThreadId,
						};
					});
				} catch (error) {
					logEvent(`Failed to load sessions: ${String(error)}`);
				} finally {
					if (!silent) {
						setWorkspace((prev) => ({ ...prev, sessionsLoading: false }));
						const slowEvent = formatSlowLoadEvent(
							"sessions",
							performance.now() - startedAt,
						);
						if (slowEvent) logEvent(slowEvent);
					}
				}
			});
		},
		[logEvent, settings],
	);

	const refreshAgentsData = useCallback(async () => {
		return runWithInFlightGuard(agentsRefreshInFlightRef, async () => {
			const startedAt = performance.now();
			setWorkspace((prev) => ({ ...prev, agentsLoading: true }));
			try {
				const agents = await fetchAgents(settings);
				setWorkspace((prev) => {
					const preferred =
						prev.selectedAgentId ||
						settings.agentId ||
						agents.agents[0]?.id ||
						"main";
					const selectedAgentId =
						agents.agents.find((agent) => agent.id === preferred)?.id ||
						agents.agents[0]?.id ||
						"main";
					const editTargetAgentId =
						agents.agents.find((agent) => agent.id === prev.editTargetAgentId)
							?.id || selectedAgentId;
					return {
						...prev,
						agentCatalog: agents.agents,
						availableTools: agents.tools,
						selectedAgentId,
						editTargetAgentId,
					};
				});
			} catch (error) {
				logEvent(`Failed to load agents: ${String(error)}`);
			} finally {
				setWorkspace((prev) => ({ ...prev, agentsLoading: false }));
				const slowEvent = formatSlowLoadEvent(
					"agents",
					performance.now() - startedAt,
				);
				if (slowEvent) logEvent(slowEvent);
			}
		});
	}, [logEvent, settings, settings.agentId]);

	const refreshProvidersData = useCallback(async () => {
		return runWithInFlightGuard(providersRefreshInFlightRef, async () => {
			const startedAt = performance.now();
			setWorkspace((prev) => ({ ...prev, providersLoading: true }));
			try {
				const data = await fetchProviders(settings);
				setWorkspace((prev) => ({
					...prev,
					providers: data.providers || [],
					providersUpdatedAt: data.updatedAt,
					credentialsPath: data.credentialsPath,
				}));
			} catch (error) {
				logEvent(`Failed to load providers: ${String(error)}`);
			} finally {
				setWorkspace((prev) => ({ ...prev, providersLoading: false }));
				const slowEvent = formatSlowLoadEvent(
					"providers",
					performance.now() - startedAt,
				);
				if (slowEvent) logEvent(slowEvent);
			}
		});
	}, [logEvent, settings]);

	const refreshVoiceConfigData = useCallback(async () => {
		return runWithInFlightGuard(voiceRefreshInFlightRef, async () => {
			const startedAt = performance.now();
			setWorkspace((prev) => ({ ...prev, voiceConfigLoading: true }));
			try {
				const voice = await fetchVoiceConfig(settings);
				setWorkspace((prev) => ({ ...prev, voiceConfig: voice }));
			} catch (error) {
				logEvent(`Failed to load voice config: ${String(error)}`);
			} finally {
				setWorkspace((prev) => ({ ...prev, voiceConfigLoading: false }));
				const slowEvent = formatSlowLoadEvent(
					"voice config",
					performance.now() - startedAt,
				);
				if (slowEvent) logEvent(slowEvent);
			}
		});
	}, [logEvent, settings]);

	const loadAgentDetailData = useCallback(
		async (
			agentId: string,
			options?: { hydrateDraft?: boolean; setAgentDetail?: boolean },
		): Promise<AgentDetail | undefined> => {
			if (!agentId) return undefined;
			const hydrateDraft = options?.hydrateDraft === true;
			const setAgentDetail = options?.setAgentDetail !== false;
			try {
				const detail = await fetchAgentDetail(settings, agentId);
				setWorkspace((prev) => {
					const next: WorkspaceState = {
						...prev,
						agentDetailsById: {
							...prev.agentDetailsById,
							[detail.id]: detail,
						},
					};
					if (setAgentDetail) {
						next.agentDetail = detail;
					}
					if (hydrateDraft) {
						next.createAgentDraft = mapAgentDetailToDraftSeed(detail);
						next.editTargetAgentId = detail.id;
					}
					return next;
				});
				return detail;
			} catch {
				if (setAgentDetail) {
					setWorkspace((prev) => ({ ...prev, agentDetail: undefined }));
				}
				return undefined;
			}
		},
		[settings],
	);

	const applyAgentEvent = useCallback(
		(requestId: string, payload: unknown) => {
			const data = payload as SessionMirrorEventPayload & {
				error?: string;
				content?: string;
				node?: string;
			};
			const eventType = typeof data.type === "string" ? data.type : "";
			const shouldTrackAsStreaming =
				eventType === "agent-start" ||
				eventType === "agent-stream" ||
				(!eventType &&
					typeof payload === "object" &&
					payload !== null &&
					(Array.isArray((payload as Record<string, unknown>).messages) ||
						typeof (payload as Record<string, unknown>).event === "string"));
			if (
				shouldTrackAsStreaming &&
				!pendingRequestIdsRef.current.has(requestId)
			) {
				registerPendingRequest(requestId);
			}
			const sessionId = getSessionIdFromEventPayload(data);
			const ensureSessionSubscribed = (id: string | undefined) => {
				if (!id) return;
				socketRef.current?.subscribeSession(id);
				subscribedRef.current.add(id);
			};

			if (isSessionUserMessagePayload(data)) {
				if (!sessionId) return;
				requestThreadRef.current.set(requestId, sessionId);
				ensureSessionSubscribed(sessionId);
				setWorkspace((prev) => ({
					...prev,
					threads: upsertSessionUserMessage(prev.threads, requestId, data, {
						fallbackAgentId: "main",
					}),
				}));
				return;
			}

			let threadId = requestThreadRef.current.get(requestId);
			let messageId = requestMessageRef.current.get(requestId) || requestId;
			if (!threadId && sessionId) {
				threadId = sessionId;
				requestThreadRef.current.set(requestId, threadId);
				requestMessageRef.current.set(requestId, messageId);
				ensureSessionSubscribed(threadId);
				setWorkspace((prev) => ({
					...prev,
					threads: ensureSessionAssistantMessage(
						prev.threads,
						requestId,
						data,
						{
							defaultThreadName: DEFAULT_THREAD_NAME,
							fallbackAgentId: "main",
							messageId,
						},
					).threads,
				}));
			}
			if (!threadId) return;
			if (
				pendingRequestIdsRef.current.has(requestId) &&
				data.type !== "session-message"
			) {
				markRequestActive(requestId);
			}

			const parsed = parseStreamEvents(payload);
			const parsedToolEvents = parsed.toolEvents as ParsedToolStreamEvent[];
			const parsedAttachmentEvents =
				parsed.attachmentEvents as ParsedStreamAttachmentEvent[];
			const thinkingEvent: ThinkingEvent | null =
				typeof data.type === "string" && data.type.includes("thinking")
					? {
							id: `${requestId}-thinking-${Date.now()}`,
							node: data.node,
							content: data.content || "",
							updatedAt: Date.now(),
						}
					: null;

			setWorkspace((prev) => ({
				...prev,
				threads: prev.threads.map((thread) => {
					if (thread.id !== threadId) return thread;
					let nextThread = thread;

					if (parsedAttachmentEvents.length > 0) {
						const attachmentEventsByMessageId = new Map<
							string,
							ChatAttachment[]
						>();
						for (const attachmentEvent of parsedAttachmentEvents) {
							const nextAttachment = normalizeStreamAttachment(
								attachmentEvent,
								gatewayHttpBase,
							);
							if (!nextAttachment) continue;
							const targetMessageId = resolveTextMessageTargetId({
								state: requestStreamMessageRef.current,
								requestId,
								fallbackMessageId: messageId,
								streamMessageId: attachmentEvent.messageId,
								isDelta: attachmentEvent.isDelta,
							});
							const bucket = attachmentEventsByMessageId.get(targetMessageId) || [];
							bucket.push(nextAttachment);
							attachmentEventsByMessageId.set(targetMessageId, bucket);
						}

						for (const [attachmentMessageId, attachmentList] of attachmentEventsByMessageId) {
							nextThread = updateAssistantMessage(
								nextThread,
								attachmentMessageId,
								(message) => ({
									...message,
									attachments: mergeStreamAttachments(
										message.attachments,
										attachmentList,
									),
								}),
							);
						}
					}

					for (const [eventIndex, textEvent] of parsed.textEvents.entries()) {
						const streamMessageId = textEvent.messageId;
						const looksLikeStandaloneDelta =
							Boolean(textEvent.isDelta) &&
							!streamMessageId &&
							textEvent.text.trim().length >= 80 &&
							/\s/.test(textEvent.text);
						const targetMessageId = resolveTextMessageTargetId({
							state: requestStreamMessageRef.current,
							requestId,
							fallbackMessageId: messageId,
							streamMessageId,
							isDelta: looksLikeStandaloneDelta ? false : textEvent.isDelta,
							eventKey: !textEvent.isDelta
								? `${streamMessageId || "noid"}:${Date.now()}:${eventIndex}`
								: looksLikeStandaloneDelta
									? `standalone:${Date.now()}:${eventIndex}`
									: undefined,
						});
						nextThread = updateAssistantMessage(
							nextThread,
							targetMessageId,
							(message) => {
								let activityTimeline = message.activityTimeline;
								let timelineTextBlockId: string | undefined;
								let timelineTextOrder: number | undefined;
								if (textEvent.text) {
									timelineTextBlockId =
										timelineActiveTextBlockRef.current.get(targetMessageId);
									const previousKind =
										timelineLastKindRef.current.get(targetMessageId);
									if (!timelineTextBlockId || previousKind !== "text") {
										timelineTextOrder = nextStreamOrder(requestId);
										timelineTextBlockId = `tl-text-${targetMessageId}-${timelineTextOrder}`;
										timelineActiveTextBlockRef.current.set(
											targetMessageId,
											timelineTextBlockId,
										);
										timelineActiveTextOrderRef.current.set(
											targetMessageId,
											timelineTextOrder,
										);
									} else {
										timelineTextOrder =
											timelineActiveTextOrderRef.current.get(targetMessageId) ??
											nextStreamOrder(requestId);
									}
									timelineLastKindRef.current.set(targetMessageId, "text");
									if (timelineTextBlockId) {
										activityTimeline = upsertTimelineTextBlock(
											message.activityTimeline,
											{
												blockId: timelineTextBlockId,
												order: timelineTextOrder ?? nextStreamOrder(requestId),
												textDelta: textEvent.text,
											},
										);
									}
								}
								return {
									...message,
									content: mergeAssistantStreamText(
										message.content,
										textEvent.text,
										textEvent.isDelta,
									),
									activityTimeline,
								};
							},
						);
					}

					if (parsedToolEvents.length > 0) {
						const toolEventsByMessageId = new Map<
							string,
							ParsedToolStreamEvent[]
						>();
						const orderedToolEvents = parsedToolEvents.map((toolEvent) => ({
							...toolEvent,
							streamOrder: nextStreamOrder(requestId),
						}));
						for (const toolEvent of orderedToolEvents) {
							const targetMessageId = resolveToolMessageTargetId({
								state: requestStreamMessageRef.current,
								requestId,
								fallbackMessageId: messageId,
								runId: toolEvent.runId || toolEvent.id,
								parentRunIds: toolEvent.parentRunIds,
							});
							const bucket = toolEventsByMessageId.get(targetMessageId) || [];
							bucket.push(toolEvent);
							toolEventsByMessageId.set(targetMessageId, bucket);
						}

						for (const [toolMessageId, toolEvents] of toolEventsByMessageId) {
							nextThread = updateAssistantMessage(
								nextThread,
								toolMessageId,
								(message) => {
									const mergedToolEvents = mergeToolEvents(
										message.toolEvents,
										toolEvents,
									);
									let activityTimeline = message.activityTimeline;
									for (const toolEvent of toolEvents) {
										activityTimeline = upsertTimelineToolBlock(
											activityTimeline,
											{
												blockId: `tl-tool-${toolEvent.id}`,
												order:
													toolEvent.streamOrder ||
													toolEvent.startedAt ||
													toolEvent.timestamp ||
													Date.now(),
												toolEventId: toolEvent.id,
											},
										);
									}
									timelineActiveTextBlockRef.current.delete(toolMessageId);
									timelineActiveTextOrderRef.current.delete(toolMessageId);
									timelineLastKindRef.current.set(toolMessageId, "tool");
									return {
										...message,
										toolEvents: mergedToolEvents,
										activityTimeline:
											activityTimeline && activityTimeline.length > 0
												? activityTimeline
												: undefined,
										uiBlocks: deriveUiBlocks(mergedToolEvents),
									};
								},
							);
						}
					}

					if (thinkingEvent) {
						nextThread = updateAssistantMessage(
							nextThread,
							messageId,
							(message) => ({
								...message,
								thinkingEvents: [
									...(message.thinkingEvents || []),
									thinkingEvent,
								],
							}),
						);
					}

					return nextThread;
				}),
			}));

			if (data.type === "agent-error") {
				const errorText =
					typeof data.error === "string" && data.error.trim()
						? data.error.trim()
						: "unknown error";
				applyGatewayRequestFailure({
					requestId,
					errorText,
				});
				logEvent(`Agent error: ${errorText}`);
				return;
			}

			if (data.type === "agent-complete") {
				setWorkspace((prev) => {
					const sourceThread = prev.threads.find(
						(thread) => thread.id === threadId,
					);
					const previewMessage =
						sourceThread?.messages.find((message) => message.id === messageId)
							?.content ||
						sourceThread?.messages
							.filter((message) => message.role === "assistant")
							.at(-1)?.content ||
						"";
					const nextNonce = completionNonceRef.current + 1;
					completionNonceRef.current = nextNonce;
					return {
						...prev,
						lastCompletion: {
							nonce: nextNonce,
							threadId: threadId || "",
							messageId,
							threadName: sourceThread?.name || "Current chat",
							agentId: sourceThread?.agentId || "agent",
							preview: previewMessage,
						},
					};
				});
				finalizePendingRequest(requestId);
				requestThreadRef.current.delete(requestId);
				requestMessageRef.current.delete(requestId);
				void refreshSessionsData({ silent: true });
			}
		},
		[
			applyGatewayRequestFailure,
			finalizePendingRequest,
			gatewayHttpBase,
			logEvent,
			markRequestActive,
			nextStreamOrder,
			refreshSessionsData,
			registerPendingRequest,
		],
	);

	const setNodeExecutionEnabled = useCallback(
		async (enabled: boolean): Promise<boolean> => {
			const clientId = `desktop-${deviceIdRef.current}`;
			const resolvedNodeName = nodeName.trim() || "Wingman Desktop";
			setWorkspace((prev) => ({
				...prev,
				nodeModeState: enabled ? "enabling" : "disabled",
				nodeModeMessage: enabled
					? "Enabling node mode..."
					: "Disabling node mode...",
			}));
			try {
				const record = await setNodeEnabled(settings, {
					clientId,
					enabled,
					name: resolvedNodeName,
				});
				if (enabled) {
					socketRef.current?.enableNode({
						name: record.name || resolvedNodeName,
						capabilities: ["system.notify", "system.run"],
					});
				} else {
					socketRef.current?.disableNode();
				}
				setWorkspace((prev) => ({
					...prev,
					nodeModeState: enabled ? "enabled" : "disabled",
					nodeModeMessage: enabled
						? "Node mode enabled for this device."
						: "Node mode disabled for this device.",
				}));
				return true;
			} catch (error) {
				const message = `Failed to ${enabled ? "enable" : "disable"} node mode: ${String(error)}`;
				setWorkspace((prev) => ({
					...prev,
					nodeModeState: "error",
					nodeModeMessage: message,
				}));
				logEvent(message);
				setGlobalStatus(message, true);
				return false;
			}
		},
		[logEvent, nodeName, setGlobalStatus, settings],
	);

	const connectGateway = useCallback(async () => {
		if (!isGatewayConfigValid(settings)) {
			setGlobalStatus("Gateway URL is invalid", true);
			setWorkspace((prev) => ({
				...prev,
				connectionStatus: "disconnected",
				connectionMessage: "Invalid gateway URL",
			}));
			return;
		}

		setWorkspace((prev) => ({
			...prev,
			connectionStatus: "connecting",
			connectionMessage: "Testing gateway...",
			checkingConnection: true,
		}));

		const check = await checkGatewayConnection(settings);
		if (!check.ok) {
			const detail = check.error || check.status;
			const summary = summarizeGatewayConnectionFailure(detail);
			setWorkspace((prev) => ({
				...prev,
				connectionStatus: "disconnected",
				connectionMessage: summary,
				checkingConnection: false,
			}));
			logEvent(`Gateway probe failed: ${summary}`);
			setGlobalStatus(summary, true);
			return;
		}
		if (
			check.config?.requireAuth &&
			!settings.token.trim() &&
			!settings.password.trim()
		) {
			setWorkspace((prev) => ({
				...prev,
				connectionStatus: "disconnected",
				connectionMessage: "Gateway requires token/password",
				checkingConnection: false,
			}));
			setGlobalStatus(
				"Gateway requires authentication. Add token or password in Settings.",
				true,
			);
			return;
		}

		setWorkspace((prev) => ({
			...prev,
			gatewayConfig: check.config,
			gatewayHealth: check.health,
			gatewayStats: check.stats,
			checkingConnection: false,
		}));

		socketRef.current?.disconnect();
		socketRef.current = new GatewaySocketClient({
			onConnectionChanged: (connected, message) => {
				if (!connected) {
					resetPendingRequests();
				}
				setWorkspace((prev) => ({
					...prev,
					connectionStatus: connected ? "connected" : "disconnected",
					connectionMessage: message,
					nodeModeState:
						connected || !enableNodeMode ? prev.nodeModeState : "disabled",
					nodeModeMessage:
						connected || !enableNodeMode
							? prev.nodeModeMessage
							: "Node mode waiting for reconnect.",
				}));
				setGlobalStatus(
					message,
					!connected && message.toLowerCase().includes("failed"),
				);
				if (connected) {
					void refreshSessionsData();
					void refreshAgentsData();
					void refreshProvidersData();
					void refreshVoiceConfigData();
					if (enableNodeMode) {
						void setNodeExecutionEnabled(true);
					} else {
						socketRef.current?.disableNode();
					}
				}
			},
			onAgentEvent: applyAgentEvent,
			onError: (message, context) => {
				const consumed = applyGatewayRequestFailure({
					requestId: context?.requestId,
					errorText: message,
				});
				logEvent(consumed ? `Gateway error: ${message}` : message);
			},
		});
		const socketSettings =
			check.config?.gatewayHost && check.config?.gatewayPort
				? (() => {
						try {
							const parsed = new URL(settings.url);
							const isSecure =
								parsed.protocol === "wss:" || parsed.protocol === "https:";
							const defaultPort = isSecure ? "443" : "80";
							const currentPort = parsed.port || defaultPort;
							const nextPort = String(check.config?.gatewayPort);
							const nextHost = check.config?.gatewayHost;
							const normalizedNextHost =
								nextHost === "0.0.0.0" || nextHost === "::"
									? parsed.hostname
									: nextHost;
							const shouldNormalizeSocket =
								parsed.hostname !== normalizedNextHost ||
								currentPort !== nextPort ||
								parsed.pathname === "/" ||
								parsed.pathname === "";
							if (!shouldNormalizeSocket || !normalizedNextHost) {
								return settings;
							}
							const protocol = isSecure ? "wss" : "ws";
							const url = `${protocol}://${normalizedNextHost}:${nextPort}/ws`;
							logEvent(`Using gateway socket from config: ${url}`);
							return { ...settings, url };
						} catch {
							return settings;
						}
					})()
				: settings;
		socketRef.current.connect(socketSettings, deviceIdRef.current);
	}, [
		applyAgentEvent,
		applyGatewayRequestFailure,
		enableNodeMode,
		logEvent,
		refreshAgentsData,
		refreshProvidersData,
		refreshSessionsData,
		refreshVoiceConfigData,
		resetPendingRequests,
		setGlobalStatus,
		setNodeExecutionEnabled,
		settings,
	]);

	const disconnectGateway = useCallback(() => {
		socketRef.current?.disableNode();
		socketRef.current?.disconnect();
		resetPendingRequests();
		setWorkspace((prev) => ({
			...prev,
			connectionStatus: "disconnected",
			connectionMessage: "Disconnected",
			nodeModeState: enableNodeMode ? "disabled" : prev.nodeModeState,
			nodeModeMessage: enableNodeMode
				? "Node mode waiting for reconnect."
				: prev.nodeModeMessage,
		}));
		setGlobalStatus("Disconnected from gateway.");
	}, [enableNodeMode, resetPendingRequests, setGlobalStatus]);

	const testConnection = useCallback(async () => {
		setWorkspace((prev) => ({ ...prev, checkingConnection: true }));
		const check = await checkGatewayConnection(settings);
		const detail = check.ok
			? "Gateway test succeeded"
			: check.error || check.status;
		const summary = check.ok
			? detail
			: summarizeGatewayConnectionFailure(detail);
		setWorkspace((prev) => ({
			...prev,
			checkingConnection: false,
			gatewayConfig: check.config || prev.gatewayConfig,
			gatewayHealth: check.health || prev.gatewayHealth,
			gatewayStats: check.stats || prev.gatewayStats,
			connectionMessage: summary,
		}));
		if (!check.ok) {
			logEvent(`Gateway test failed: ${summary}`);
		}
		setGlobalStatus(summary, !check.ok);
	}, [logEvent, setGlobalStatus, settings]);

	const saveProviderCredential = useCallback(
		async (providerName: string, token: string): Promise<boolean> => {
			const trimmedProvider = providerName.trim();
			const trimmedToken = token.trim();
			if (!trimmedProvider) {
				setGlobalStatus("Provider name is required.", true);
				return false;
			}
			if (!trimmedToken) {
				setGlobalStatus("Provider token cannot be empty.", true);
				return false;
			}
			try {
				await saveProviderToken(settings, {
					providerName: trimmedProvider,
					token: trimmedToken,
				});
				await refreshProvidersData();
				setGlobalStatus(`Saved credential for ${trimmedProvider}.`);
				return true;
			} catch (error) {
				setGlobalStatus(`Failed to save credential: ${String(error)}`, true);
				return false;
			}
		},
		[refreshProvidersData, setGlobalStatus, settings],
	);

	const clearProviderCredential = useCallback(
		async (providerName: string): Promise<boolean> => {
			const trimmedProvider = providerName.trim();
			if (!trimmedProvider) {
				setGlobalStatus("Provider name is required.", true);
				return false;
			}
			try {
				await clearProviderToken(settings, trimmedProvider);
				await refreshProvidersData();
				setGlobalStatus(`Cleared credential for ${trimmedProvider}.`);
				return true;
			} catch (error) {
				setGlobalStatus(`Failed to clear credential: ${String(error)}`, true);
				return false;
			}
		},
		[refreshProvidersData, setGlobalStatus, settings],
	);

	const saveVoiceSettings = useCallback(
		async (voice: Partial<VoiceConfig>): Promise<boolean> => {
			try {
				const updated = await updateVoiceConfig(settings, voice);
				setWorkspace((prev) => ({ ...prev, voiceConfig: updated }));
				setGlobalStatus("Saved voice configuration.");
				return true;
			} catch (error) {
				setGlobalStatus(
					`Failed to save voice configuration: ${String(error)}`,
					true,
				);
				return false;
			}
		},
		[setGlobalStatus, settings],
	);

	const createNewChat = useCallback(async () => {
		const agentId = workspace.selectedAgentId || "main";
		const shortId = `thread-${Math.random().toString(36).slice(2, 8)}`;
		const sessionId = `agent:${agentId}:desktop:thread:${shortId}`;
		try {
			const session = await createSession(settings, {
				agentId,
				sessionId,
				name: DEFAULT_THREAD_NAME,
			});
			const thread = mapSessionToThread(session);
			setWorkspace((prev) => ({
				...prev,
				threads: [thread, ...prev.threads],
				activeThreadId: thread.id,
			}));
			logEvent(`Created session ${thread.id}`);
			return thread;
		} catch (error) {
			setGlobalStatus(`Failed to create session: ${String(error)}`, true);
			return null;
		}
	}, [logEvent, setGlobalStatus, settings, workspace.selectedAgentId]);

	const loadThreadMessages = useCallback(
		async (thread: SessionThread) => {
			if (thread.messagesLoaded) return;
			if (loadingMessagesRef.current.has(thread.id)) return;
			const startedAt = performance.now();
			loadingMessagesRef.current.add(thread.id);
			setWorkspace((prev) =>
				prev.loadingMessagesThreadId === thread.id
					? prev
					: { ...prev, loadingMessagesThreadId: thread.id },
			);
			try {
				const messages = await fetchSessionMessages(settings, {
					sessionId: thread.id,
					agentId: thread.agentId,
				});
				setWorkspace((prev) => ({
					...prev,
					threads: prev.threads.map((item) =>
						item.id === thread.id
							? {
									...item,
									messages,
									messagesLoaded: true,
									messageCount: messages.length,
								}
							: item,
					),
				}));
			} catch (error) {
				logEvent(`Failed to load messages: ${String(error)}`);
			} finally {
				loadingMessagesRef.current.delete(thread.id);
				setWorkspace((prev) =>
					prev.loadingMessagesThreadId === thread.id
						? { ...prev, loadingMessagesThreadId: null }
						: prev,
				);
				const slowEvent = formatSlowLoadEvent(
					`messages for ${thread.name}`,
					performance.now() - startedAt,
				);
				if (slowEvent) logEvent(slowEvent);
			}
		},
		[logEvent, settings],
	);

	const selectThread = useCallback(
		(threadId: string) => {
			setWorkspace((prev) => ({ ...prev, activeThreadId: threadId }));
			const thread = workspace.threads.find((item) => item.id === threadId);
			if (thread) {
				if (!thread.messagesLoaded) {
					void loadThreadMessages(thread);
				}
				setWorkspace((prev) => ({ ...prev, selectedAgentId: thread.agentId }));
			}
		},
		[loadThreadMessages, workspace.threads],
	);

	const removeThread = useCallback(
		async (thread: SessionThread) => {
			try {
				await deleteSession(settings, {
					sessionId: thread.id,
					agentId: thread.agentId,
				});
			} catch (error) {
				logEvent(`Failed to delete session: ${String(error)}`);
			}
			setWorkspace((prev) => {
				const next = prev.threads.filter((item) => item.id !== thread.id);
				const activeThreadId =
					prev.activeThreadId === thread.id
						? next[0]?.id || ""
						: prev.activeThreadId;
				return {
					...prev,
					threads: next,
					activeThreadId,
				};
			});
			logEvent(`Deleted session ${thread.id}`);
		},
		[logEvent, settings],
	);

	const renameThreadByPrompt = useCallback(
		async (thread: SessionThread) => {
			const nextName = window.prompt("Rename session", thread.name);
			if (!nextName || !nextName.trim()) return;
			try {
				const updated = await renameSession(settings, {
					sessionId: thread.id,
					agentId: thread.agentId,
					name: nextName.trim(),
				});
				setWorkspace((prev) => ({
					...prev,
					threads: prev.threads.map((item) =>
						item.id === thread.id ? { ...item, name: updated.name } : item,
					),
				}));
			} catch (error) {
				logEvent(`Failed to rename session: ${String(error)}`);
			}
		},
		[logEvent, settings],
	);

	const clearThreadMessages = useCallback(
		async (thread: SessionThread) => {
			try {
				const cleared = await clearSessionMessages(settings, {
					sessionId: thread.id,
					agentId: thread.agentId,
				});
				setWorkspace((prev) => ({
					...prev,
					prompt: "",
					attachments: [],
					attachmentError: "",
					threads: prev.threads.map((item) =>
						item.id === thread.id
							? {
									...item,
									messages: [],
									messagesLoaded: true,
									messageCount: cleared.messageCount,
									lastMessagePreview: cleared.lastMessagePreview || "",
									updatedAt: Date.now(),
								}
							: item,
					),
				}));
				setGlobalStatus(`Cleared chat history for ${thread.name}.`);
				logEvent(`Cleared chat messages for session ${thread.id}`);
			} catch (error) {
				setGlobalStatus(`Failed to clear chat: ${String(error)}`, true);
			}
		},
		[logEvent, setGlobalStatus, settings],
	);

	const sendPrompt = useCallback(
		async (
			promptOverride?: string,
			options?: { includeComposerAttachments?: boolean },
		): Promise<boolean> => {
			const includeComposerAttachments =
				options?.includeComposerAttachments !== false;
			const outgoingAttachments = includeComposerAttachments
				? workspace.attachments
				: [];
			const userText = (promptOverride ?? workspace.prompt).trim();
			if (!userText && outgoingAttachments.length === 0) return false;
			if (workspace.connectionStatus !== "connected") {
				setGlobalStatus("Connect to gateway first.", true);
				return false;
			}

			let target: SessionThread | undefined = activeThread;
			if (!target) {
				const created = await createNewChat();
				if (!created) return false;
				target = created;
			}

			const now = Date.now();
			const assistantId = `assistant-${now}-${Math.random().toString(36).slice(2, 8)}`;
			const previewText =
				userText.trim() ||
				buildAttachmentPreviewText(outgoingAttachments) ||
				DEFAULT_THREAD_NAME;

			setWorkspace((prev) => ({
				...prev,
				prompt: promptOverride === undefined ? "" : prev.prompt,
				attachmentError: "",
				threads: prev.threads.map((thread) =>
					thread.id === target!.id
						? {
								...thread,
								name:
									thread.name === DEFAULT_THREAD_NAME
										? mapSessionName(previewText, thread.name)
										: thread.name,
								messagesLoaded: true,
								messages: [
									...thread.messages,
									{
										id: `user-${now}`,
										role: "user",
										content: userText,
										attachments:
											outgoingAttachments.length > 0
												? outgoingAttachments
												: undefined,
										createdAt: now,
									},
									{
										id: assistantId,
										role: "assistant",
										content: "",
										createdAt: now,
									},
								],
								updatedAt: now,
								lastMessagePreview: previewText.slice(0, 200),
								messageCount:
									(thread.messageCount ?? thread.messages.length) + 1,
							}
						: thread,
				),
			}));

			try {
				const payload: AgentRequestPayload = {
					agentId: target.agentId,
					content: userText,
					attachments:
						outgoingAttachments.length > 0 ? outgoingAttachments : undefined,
					sessionKey: target.id,
					queueIfBusy: true,
					routing: {
						channel: "desktop",
						peer: { kind: "channel", id: deviceIdRef.current },
					},
				};
				const gatewayRequestId = socketRef.current?.sendAgentRequest(payload);
				if (!gatewayRequestId) {
					throw new Error("Gateway socket is unavailable");
				}
				requestThreadRef.current.set(gatewayRequestId, target.id);
				requestMessageRef.current.set(gatewayRequestId, assistantId);
				registerPendingRequest(gatewayRequestId);
				if (pendingRequestIdsRef.current.size > 1) {
					setGlobalStatus(
						`Queued prompt (${pendingRequestIdsRef.current.size - 1} waiting).`,
					);
				}
				if (includeComposerAttachments) {
					setWorkspace((prev) => ({
						...prev,
						attachments: [],
						attachmentError: "",
					}));
				}
				return true;
			} catch (error) {
				setGlobalStatus(`Failed to send prompt: ${String(error)}`, true);
				return false;
			}
		},
		[
			activeThread,
			createNewChat,
			registerPendingRequest,
			setGlobalStatus,
			workspace.attachments,
			workspace.connectionStatus,
			workspace.prompt,
		],
	);

	const updatePrompt = useCallback((value: string) => {
		setWorkspace((prev) => ({ ...prev, prompt: value }));
	}, []);

	const addAttachments = useCallback(
		async (files: FileList | File[] | null) => {
			if (!files || files.length === 0) return;
			const selected = Array.from(files);
			const prepared: ChatAttachment[] = [];
			let errorMessage = "";
			let truncatedCount = 0;
			let pdfFallbackCount = 0;

			for (const file of selected) {
				const isImage = file.type.startsWith("image/");
				const isAudio = file.type.startsWith("audio/");
				const isPdf = isPdfUploadFile(file);
				const isTextFile = isSupportedTextUploadFile(file);

				if (!isImage && !isAudio && !isPdf && !isTextFile) {
					errorMessage =
						errorMessage ||
						"Unsupported file type. Allowed: images, audio, PDF, text, markdown, JSON, YAML, XML, logs, and common code files.";
					continue;
				}

				if (isImage || isAudio) {
					const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;
					if (file.size > maxBytes) {
						errorMessage =
							errorMessage ||
							(isImage
								? "Image is too large. Max size is 8MB."
								: "Audio is too large. Max size is 20MB.");
						continue;
					}
					try {
						const dataUrl = await readFileAsDataUrl(file);
						prepared.push({
							id: createAttachmentId(),
							kind: isAudio ? "audio" : "image",
							dataUrl,
							name: file.name,
							mimeType: file.type,
							size: file.size,
						});
					} catch {
						errorMessage =
							errorMessage || "Unable to read one or more attachments.";
					}
					continue;
				}

				const maxBytes = isPdf ? MAX_PDF_BYTES : MAX_FILE_BYTES;
				if (file.size > maxBytes) {
					errorMessage =
						errorMessage ||
						(isPdf
							? "PDF is too large. Max size is 8MB."
							: "Text/code file is too large. Max size is 2MB.");
					continue;
				}

				try {
					const { textContent, truncated, usedPdfFallback } =
						await readUploadFileText(file, MAX_FILE_TEXT_CHARS);
					if (!textContent.trim()) {
						errorMessage = errorMessage || "Unable to read file contents.";
						continue;
					}
					let dataUrl = "";
					if (isPdf) {
						dataUrl = await readFileAsDataUrl(file);
					}
					prepared.push({
						id: createAttachmentId(),
						kind: "file",
						dataUrl,
						textContent,
						name: file.name,
						mimeType: file.type || (isPdf ? "application/pdf" : "text/plain"),
						size: file.size,
					});
					if (truncated) truncatedCount += 1;
					if (usedPdfFallback) pdfFallbackCount += 1;
				} catch {
					errorMessage = errorMessage || "Unable to read file contents.";
				}
			}

			if (prepared.length === 0 && !errorMessage) return;

			setWorkspace((prev) => {
				const combined = [...prev.attachments, ...prepared];
				const limited =
					combined.length > MAX_ATTACHMENTS
						? combined.slice(0, MAX_ATTACHMENTS)
						: combined;
				const limitError =
					combined.length > MAX_ATTACHMENTS
						? `Limit is ${MAX_ATTACHMENTS} attachments per message.`
						: "";

				return {
					...prev,
					attachments: limited,
					attachmentError: errorMessage || limitError || "",
				};
			});

			if (truncatedCount > 0) {
				setGlobalStatus(
					"One or more files were truncated before upload to keep prompts manageable.",
				);
			}
			if (pdfFallbackCount > 0) {
				setGlobalStatus(
					"One or more PDFs had no extractable text. A fallback note was attached.",
				);
			}
		},
		[setGlobalStatus],
	);

	const removeAttachment = useCallback((id: string) => {
		setWorkspace((prev) => ({
			...prev,
			attachments: prev.attachments.filter((item) => item.id !== id),
			attachmentError: "",
		}));
	}, []);

	const clearAttachments = useCallback(() => {
		setWorkspace((prev) => ({ ...prev, attachments: [], attachmentError: "" }));
	}, []);

	const sendPromptText = useCallback(
		async (value: string) => {
			return sendPrompt(value, { includeComposerAttachments: false });
		},
		[sendPrompt],
	);

	const updateSelectedAgent = useCallback(
		(value: string) => {
			setWorkspace((prev) => ({ ...prev, selectedAgentId: value }));
			void loadAgentDetailData(value);
		},
		[loadAgentDetailData],
	);

	const updateCreateAgentDraft = useCallback(
		<K extends keyof CreateAgentDraft>(key: K, value: CreateAgentDraft[K]) => {
			setWorkspace((prev) => ({
				...prev,
				createAgentDraft: { ...prev.createAgentDraft, [key]: value },
			}));
		},
		[],
	);

	const setAgentFormMode = useCallback(
		(mode: "create" | "edit") => {
			setWorkspace((prev) => {
				if (mode === "create") {
					return {
						...prev,
						agentFormMode: "create",
						createAgentDraft: createEmptyAgentDraft(),
					};
				}
				const fallbackId =
					prev.editTargetAgentId ||
					prev.selectedAgentId ||
					prev.agentCatalog[0]?.id ||
					"";
				return {
					...prev,
					agentFormMode: "edit",
					editTargetAgentId: fallbackId,
				};
			});
			if (mode === "edit") {
				const targetId =
					workspace.editTargetAgentId ||
					workspace.selectedAgentId ||
					workspace.agentCatalog[0]?.id ||
					"";
				if (targetId) {
					void loadAgentDetailData(targetId, {
						hydrateDraft: true,
						setAgentDetail: true,
					});
				}
			}
		},
		[
			loadAgentDetailData,
			workspace.agentCatalog,
			workspace.editTargetAgentId,
			workspace.selectedAgentId,
		],
	);

	const setEditTargetAgentId = useCallback(
		(agentId: string) => {
			setWorkspace((prev) => ({ ...prev, editTargetAgentId: agentId }));
			void loadAgentDetailData(agentId, {
				hydrateDraft: true,
				setAgentDetail: true,
			});
		},
		[loadAgentDetailData],
	);

	const toggleCreateAgentSubAgent = useCallback((agentId: string) => {
		setWorkspace((prev) => {
			const selected = prev.createAgentDraft.selectedSubAgentIds;
			const exists = selected.includes(agentId);
			return {
				...prev,
				createAgentDraft: {
					...prev.createAgentDraft,
					selectedSubAgentIds: exists
						? selected.filter((id) => id !== agentId)
						: [...selected, agentId],
				},
			};
		});
	}, []);

	const submitAgentForm = useCallback(async () => {
		const draft = workspace.createAgentDraft;
		const mode = workspace.agentFormMode;
		const targetAgentId =
			mode === "edit" ? workspace.editTargetAgentId : draft.id.trim();
		if (!targetAgentId) {
			setGlobalStatus("Agent id is required.", true);
			return;
		}
		const tools = parseToolsCsv(draft.toolsCsv);

		setWorkspace((prev) => ({ ...prev, creatingAgent: true }));
		try {
			const selectedSubAgentIds = draft.selectedSubAgentIds.filter(
				(id) => id && id !== targetAgentId,
			);
			const missingIds = selectedSubAgentIds.filter(
				(id) => !agentDetailsRef.current[id],
			);
			if (missingIds.length > 0) {
				const fetched = await Promise.all(
					missingIds.map((id) =>
						loadAgentDetailData(id, { setAgentDetail: false }),
					),
				);
				const unresolved = missingIds.filter((id, index) => !fetched[index]);
				if (unresolved.length > 0) {
					throw new Error(
						`Unable to load selected sub-agent details: ${unresolved.join(", ")}`,
					);
				}
			}

			const subAgents = buildSubAgentPayloads(
				selectedSubAgentIds,
				agentDetailsRef.current,
				targetAgentId,
			);
			if (selectedSubAgentIds.length !== subAgents.length) {
				throw new Error(
					"Each selected sub-agent must include a description and prompt before linking.",
				);
			}

			const payload = {
				displayName: draft.displayName.trim() || undefined,
				description: draft.description.trim() || undefined,
				model: draft.model.trim() || undefined,
				prompt: draft.prompt.trim() || undefined,
				tools,
				promptTraining: draft.promptTraining,
				subAgents,
			};

			if (mode === "edit") {
				await updateAgent(settings, targetAgentId, payload);
				setGlobalStatus(`Updated agent ${targetAgentId}.`);
			} else {
				await createAgent(settings, { id: targetAgentId, ...payload });
				setGlobalStatus(`Created agent ${targetAgentId}.`);
			}

			await refreshAgentsData();
			if (mode === "edit") {
				await loadAgentDetailData(targetAgentId, {
					hydrateDraft: true,
					setAgentDetail: true,
				});
				setWorkspace((prev) => ({ ...prev, creatingAgent: false }));
			} else {
				setWorkspace((prev) => ({
					...prev,
					creatingAgent: false,
					createAgentDraft: createEmptyAgentDraft(),
				}));
			}
		} catch (error) {
			setWorkspace((prev) => ({ ...prev, creatingAgent: false }));
			setGlobalStatus(
				`Failed to ${mode === "edit" ? "update" : "create"} agent: ${String(error)}`,
				true,
			);
		}
	}, [
		loadAgentDetailData,
		refreshAgentsData,
		setGlobalStatus,
		settings,
		workspace.agentFormMode,
		workspace.createAgentDraft,
		workspace.editTargetAgentId,
	]);

	useEffect(() => {
		if (workspace.connectionStatus !== "connected") return;
		const socket = socketRef.current;
		if (!socket) return;

		const nextIds = new Set(workspace.threads.map((thread) => thread.id));
		for (const sessionId of nextIds) {
			socket.subscribeSession(sessionId);
		}
		for (const sessionId of subscribedRef.current) {
			if (nextIds.has(sessionId)) continue;
			socket.unsubscribeSession(sessionId);
		}
		subscribedRef.current = nextIds;
	}, [workspace.connectionStatus, workspace.threads]);

	useEffect(() => {
		const thread = findThreadNeedingHydration(
			workspace.threads,
			workspace.activeThreadId,
		);
		if (!thread) return;
		void loadThreadMessages(thread);
	}, [loadThreadMessages, workspace.activeThreadId, workspace.threads]);

	useEffect(() => {
		return () => {
			socketRef.current?.disconnect();
		};
	}, []);

	return {
		workspace,
		activeThread,
		actions: {
			connectGateway,
			disconnectGateway,
			setNodeExecutionEnabled,
			testConnection,
			refreshAgentsData,
			refreshProvidersData,
			refreshSessionsData,
			refreshVoiceConfigData,
			loadThreadMessages,
			selectThread,
			updateSelectedAgent,
			createNewChat,
			removeThread,
			clearThreadMessages,
			renameThreadByPrompt,
			sendPrompt,
			sendPromptText,
			updatePrompt,
			addAttachments,
			removeAttachment,
			clearAttachments,
			updateCreateAgentDraft,
			toggleCreateAgentSubAgent,
			setAgentFormMode,
			setEditTargetAgentId,
			submitAgentForm,
			loadAgentDetailData,
			saveProviderCredential,
			clearProviderCredential,
			saveVoiceSettings,
		},
	};
}

type AppProps = {
	overlayMode: boolean;
};

export function App({ overlayMode }: AppProps) {
	const runtime = useRuntimeController(overlayMode);
	const gateway = useGatewayWorkspace(
		runtime.state.settings,
		runtime.state.enableNodeMode,
		runtime.state.nodeName,
		runtime.setStatus,
	);
	const handledQuickSendNonceRef = useRef(0);
	const handledCompletionNonceRef = useRef(0);
	const autoConnectAttemptedRef = useRef(false);
	const [voiceSessions, setVoiceSessions] = useState<Record<string, boolean>>(
		{},
	);
	const [voicePlayback, setVoicePlayback] = useState<{
		status: VoicePlaybackStatus;
		messageId?: string;
	}>({ status: "idle" });
	const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
	const voiceUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
	const voiceAbortRef = useRef<AbortController | null>(null);
	const voiceRequestIdRef = useRef<string | null>(null);
	const spokenMessagesRef = useRef<Map<string, Set<string>>>(new Map());
	const smsBridgeSocketRef = useRef<GatewaySocketClient | null>(null);
	const smsBridgeCursorRef = useRef<number | null>(null);
	const smsBridgeCursorReadyRef = useRef(false);
	const smsBridgePollingRef = useRef(false);
	const smsBridgePendingRequestsRef = useRef<
		Map<
			string,
			{
				handle: string;
				replyText: string;
				inboundComparableText: string;
				createdAt: number;
			}
		>
	>(new Map());
	const smsBridgeRecentOutboundRef = useRef<SmsBridgeLoopbackRecord[]>([]);
	const [smsBridgeHealth, setSmsBridgeHealth] = useState<SmsBridgeHealth>(
		createDefaultSmsBridgeHealth,
	);

	const smsBridgeAllowlistSet = useMemo(() => {
		return new Set(
			runtime.state.smsBridgeAllowlist
				.map((entry) => normalizeSmsAllowlistEntry(entry))
				.filter(Boolean),
		);
	}, [runtime.state.smsBridgeAllowlist]);

	const pushSmsBridgeLog = useCallback((message: string) => {
		const line = `${new Date().toLocaleTimeString()} ${message}`;
		setSmsBridgeHealth((prev) => ({
			...prev,
			logLines: [line, ...prev.logLines].slice(0, SMS_BRIDGE_LOG_LIMIT),
		}));
	}, []);

	const setSmsBridgeMode = useCallback(
		(mode: SmsBridgeHealth["mode"], lastError?: string | null) => {
			setSmsBridgeHealth((prev) => ({
				...prev,
				mode,
				lastError: lastError === undefined ? prev.lastError : lastError || null,
			}));
		},
		[],
	);

	const setSmsBridgePendingCount = useCallback((count: number) => {
		setSmsBridgeHealth((prev) => ({
			...prev,
			pendingReplyCount: Math.max(0, count),
		}));
	}, []);

	const isVoiceAutoEnabled = useCallback(
		(threadId: string): boolean => {
			const stored = voiceSessions[threadId];
			if (stored !== undefined) return stored;
			return (gateway.workspace.voiceConfig?.defaultPolicy || "off") === "auto";
		},
		[gateway.workspace.voiceConfig?.defaultPolicy, voiceSessions],
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

	const speakMessageVoice = useCallback(
		async (input: { messageId: string; text: string; agentId?: string }) => {
			const { messageId, text, agentId } = input;
			const cleaned = sanitizeForSpeech(text);
			if (!cleaned) return;
			const resolved = resolveVoiceConfig(
				gateway.workspace.voiceConfig,
				agentId
					? gateway.workspace.agentCatalog.find((item) => item.id === agentId)
							?.voice
					: undefined,
			);

			stopVoicePlayback();
			const requestId = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			voiceRequestIdRef.current = requestId;
			setVoicePlayback({ status: "pending", messageId });

			const isStale = () => voiceRequestIdRef.current !== requestId;

			if (resolved.provider === "web_speech") {
				if (!("speechSynthesis" in window)) {
					runtime.setStatus(
						"Speech synthesis is not available in this runtime.",
						true,
					);
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
					runtime.setStatus("Voice playback failed.", true);
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
					runtime.setStatus("ElevenLabs voiceId is not configured.", true);
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
					const blob = await speakVoice(runtime.state.settings, {
						text: cleaned,
						agentId,
					});
					if (isStale()) return;
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
						runtime.setStatus("Voice playback failed.", true);
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
						runtime.setStatus(`Voice request failed: ${String(error)}`, true);
					}
					if (!isStale()) {
						setVoicePlayback({ status: "idle" });
					}
				} finally {
					if (voiceAbortRef.current === controller) {
						voiceAbortRef.current = null;
					}
				}
				return;
			}

			runtime.setStatus("Voice provider is not supported.", true);
			if (!isStale()) {
				setVoicePlayback({ status: "idle" });
			}
		},
		[
			gateway.workspace.agentCatalog,
			gateway.workspace.voiceConfig,
			runtime,
			stopVoicePlayback,
		],
	);

	const toggleVoiceAuto = useCallback(
		(threadId: string) => {
			setVoiceSessions((prev) => {
				const current =
					prev[threadId] ??
					(gateway.workspace.voiceConfig?.defaultPolicy || "off") === "auto";
				return { ...prev, [threadId]: !current };
			});
		},
		[gateway.workspace.voiceConfig?.defaultPolicy],
	);

	const handleToggleVoiceAuto = useCallback(() => {
		const activeThread = gateway.activeThread;
		if (!activeThread) return;
		const next = !isVoiceAutoEnabled(activeThread.id);
		toggleVoiceAuto(activeThread.id);
		if (!next) {
			stopVoicePlayback();
		}
	}, [
		gateway.activeThread,
		isVoiceAutoEnabled,
		stopVoicePlayback,
		toggleVoiceAuto,
	]);

	const handleSpeakVoice = useCallback(
		(messageId: string, text: string, agentId?: string) => {
			void speakMessageVoice({ messageId, text, agentId });
		},
		[speakMessageVoice],
	);

	const handleStopVoice = useCallback(() => {
		stopVoicePlayback();
	}, [stopVoicePlayback]);

	const flushSmsBridgeReply = useCallback(
		async (params: {
			handle: string;
			text: string;
			replyType: "command" | "agent";
		}) => {
			const chunks = splitSmsBridgeReply(params.text);
			if (chunks.length === 0) return;
			let loopbackRecords = smsBridgeRecentOutboundRef.current;
			for (const chunk of chunks) {
				await sendMacosMessage({ handle: params.handle, text: chunk });
				loopbackRecords = rememberSmsBridgeOutbound(
					loopbackRecords,
					{
						handle: params.handle,
						text: chunk,
					},
					{
						ttlMs: SMS_BRIDGE_LOOPBACK_TTL_MS,
					},
				);
			}
			smsBridgeRecentOutboundRef.current = loopbackRecords;
			setSmsBridgeHealth((prev) => ({
				...prev,
				lastOutboundAt: Date.now(),
				lastError: null,
				commandReplyCount:
					params.replyType === "command"
						? prev.commandReplyCount + 1
						: prev.commandReplyCount,
				agentReplyCount:
					params.replyType === "agent"
						? prev.agentReplyCount + 1
						: prev.agentReplyCount,
			}));
			pushSmsBridgeLog(
				`Sent ${params.replyType} reply to ${params.handle} (${chunks.length} SMS segment${chunks.length === 1 ? "" : "s"}).`,
			);
		},
		[pushSmsBridgeLog],
	);

	const handleSmsBridgeAgentEvent = useCallback(
		(requestId: string, payload: unknown) => {
			const pending = smsBridgePendingRequestsRef.current.get(requestId);
			if (!pending) return;
			if (isSessionUserMessagePayload(payload as SessionMirrorEventPayload)) {
				return;
			}

			pending.replyText = appendAgentEventText(pending.replyText, payload);
			const eventType =
				typeof payload === "object" &&
				payload !== null &&
				typeof (payload as { type?: unknown }).type === "string"
					? ((payload as { type: string }).type as string)
					: "";
			if (eventType === "agent-error") {
				smsBridgePendingRequestsRef.current.delete(requestId);
				setSmsBridgePendingCount(smsBridgePendingRequestsRef.current.size);
				setSmsBridgeMode("error", "Agent stream returned an error event.");
				pushSmsBridgeLog(`Agent stream failed for ${pending.handle}.`);
				void flushSmsBridgeReply({
					handle: pending.handle,
					text: "Sorry, Wingman hit an error while processing that request.",
					replyType: "command",
				}).catch(() => {
					// no-op
				});
				return;
			}
			if (eventType !== "agent-complete") return;

			smsBridgePendingRequestsRef.current.delete(requestId);
			setSmsBridgePendingCount(smsBridgePendingRequestsRef.current.size);
			const response =
				pending.replyText.trim() ||
				extractAgentTerminalText(payload) ||
				"Done.";
			if (
				isSmsBridgeSelfEcho({
					inboundText: pending.inboundComparableText,
					outboundText: response,
				})
			) {
				pushSmsBridgeLog(
					`Skipped self-echo agent reply for ${pending.handle}.`,
				);
				return;
			}
			void flushSmsBridgeReply({
				handle: pending.handle,
				text: response,
				replyType: "agent",
			}).catch((error: unknown) => {
				const message = `Failed to send agent SMS reply: ${String(error)}`;
				setSmsBridgeMode("error", message);
				pushSmsBridgeLog(message);
			});
		},
		[
			flushSmsBridgeReply,
			pushSmsBridgeLog,
			setSmsBridgeMode,
			setSmsBridgePendingCount,
		],
	);

	const ensureSmsBridgeCursor = useCallback(async (): Promise<boolean> => {
		if (smsBridgeCursorReadyRef.current) {
			return typeof smsBridgeCursorRef.current === "number";
		}

		let storedCursor = 0;
		if (SMS_BRIDGE_SKIP_BACKLOG_ON_START) {
			const latest = await getMacosMessagesLatestRowId();
			if (latest === null) {
				setSmsBridgeMode(
					"error",
					"Could not read latest Messages cursor. Check Full Disk Access permissions.",
				);
				return false;
			}
			storedCursor = latest;
			localStorage.setItem(SMS_BRIDGE_CURSOR_STORAGE_KEY, String(storedCursor));
			pushSmsBridgeLog(
				`Aligned SMS bridge cursor to latest row ${storedCursor.toLocaleString()} on startup.`,
			);
		} else {
			const rawCursor = localStorage.getItem(SMS_BRIDGE_CURSOR_STORAGE_KEY);
			if (rawCursor) {
				const parsed = Number.parseInt(rawCursor, 10);
				if (Number.isFinite(parsed) && parsed > 0) {
					storedCursor = parsed;
				}
			}

			if (storedCursor <= 0) {
				const latest = await getMacosMessagesLatestRowId();
				if (latest === null) {
					setSmsBridgeMode(
						"error",
						"Could not read latest Messages cursor. Check Full Disk Access permissions.",
					);
					return false;
				}
				storedCursor = latest;
				localStorage.setItem(
					SMS_BRIDGE_CURSOR_STORAGE_KEY,
					String(storedCursor),
				);
				pushSmsBridgeLog(
					`Initialized SMS bridge cursor to row ${storedCursor.toLocaleString()}.`,
				);
			}
		}

		smsBridgeCursorRef.current = storedCursor;
		smsBridgeCursorReadyRef.current = true;
		return true;
	}, [pushSmsBridgeLog, setSmsBridgeMode]);

	const pollSmsBridge = useCallback(async () => {
		if (smsBridgePollingRef.current) return;
		if (!smsBridgeSocketRef.current?.isConnected()) return;
		if (!runtime.state.smsBridgeEnabled) return;
		smsBridgePollingRef.current = true;
		try {
			const now = Date.now();
			for (const [requestId, pending] of smsBridgePendingRequestsRef.current) {
				if (now - pending.createdAt < SMS_BRIDGE_AGENT_REPLY_TIMEOUT_MS)
					continue;
				smsBridgePendingRequestsRef.current.delete(requestId);
				setSmsBridgePendingCount(smsBridgePendingRequestsRef.current.size);
				pushSmsBridgeLog(
					`Timed out pending SMS agent reply for ${pending.handle}.`,
				);
				await flushSmsBridgeReply({
					handle: pending.handle,
					text: "Sorry, Wingman timed out while preparing a reply. Please try again.",
					replyType: "command",
				});
			}

			setSmsBridgeHealth((prev) => ({
				...prev,
				lastPollAt: Date.now(),
				mode: "running",
			}));
			const ready = await ensureSmsBridgeCursor();
			if (!ready) return;
			const afterRowId = smsBridgeCursorRef.current || 0;
			const inboundMessages = await pollMacosMessages({
				afterRowId,
				limit: SMS_BRIDGE_POLL_LIMIT,
			});
			if (inboundMessages.length === 0) return;

			let nextCursor = afterRowId;
			for (const inbound of inboundMessages) {
				if (inbound.rowId <= nextCursor) continue;
				const normalizedHandle = normalizeSmsAllowlistEntry(inbound.handle);
				if (
					smsBridgeAllowlistSet.size > 0 &&
					(!normalizedHandle || !smsBridgeAllowlistSet.has(normalizedHandle))
				) {
					setSmsBridgeHealth((prev) => ({
						...prev,
						skippedInboundCount: prev.skippedInboundCount + 1,
					}));
					pushSmsBridgeLog(
						`Skipped inbound SMS from ${inbound.handle} (not in allowlist).`,
					);
					nextCursor = inbound.rowId;
					smsBridgeCursorRef.current = nextCursor;
					localStorage.setItem(
						SMS_BRIDGE_CURSOR_STORAGE_KEY,
						String(nextCursor),
					);
					continue;
				}
				const target = buildSmsTargetForHandle(inbound.handle);
				if (!target) {
					nextCursor = inbound.rowId;
					continue;
				}
				const loopback = consumeSmsBridgeLoopback(
					smsBridgeRecentOutboundRef.current,
					{
						handle: inbound.handle,
						text: inbound.text,
					},
					{
						ttlMs: SMS_BRIDGE_LOOPBACK_TTL_MS,
					},
				);
				smsBridgeRecentOutboundRef.current = loopback.records;
				if (loopback.matched) {
					setSmsBridgeHealth((prev) => ({
						...prev,
						skippedInboundCount: prev.skippedInboundCount + 1,
					}));
					pushSmsBridgeLog(
						`Suppressed loopback SMS echo from ${inbound.handle}.`,
					);
					nextCursor = inbound.rowId;
					smsBridgeCursorRef.current = nextCursor;
					localStorage.setItem(
						SMS_BRIDGE_CURSOR_STORAGE_KEY,
						String(nextCursor),
					);
					continue;
				}
				setSmsBridgeHealth((prev) => ({
					...prev,
					processedInboundCount: prev.processedInboundCount + 1,
					lastInboundAt: Date.now(),
					lastError: null,
				}));

				const resolution = await submitSmsInboundMessage(
					runtime.state.settings,
					{
						target,
						text: inbound.text,
						agentId: gateway.workspace.selectedAgentId || undefined,
						queueIfBusy: true,
					},
				);
				pushSmsBridgeLog(
					`Inbound SMS from ${inbound.handle} classified as ${resolution.kind}.`,
				);
				if (resolution.kind === "command" || resolution.kind === "stopped") {
					if (
						isSmsBridgeSelfEcho({
							inboundText: inbound.text,
							outboundText: resolution.responseText,
						})
					) {
						pushSmsBridgeLog(
							`Skipped self-echo command reply for ${inbound.handle}.`,
						);
						nextCursor = inbound.rowId;
						smsBridgeCursorRef.current = nextCursor;
						localStorage.setItem(
							SMS_BRIDGE_CURSOR_STORAGE_KEY,
							String(nextCursor),
						);
						continue;
					}
					await flushSmsBridgeReply({
						handle: inbound.handle,
						text: resolution.responseText,
						replyType: "command",
					});
				} else {
					try {
						const requestId = smsBridgeSocketRef.current?.sendAgentRequest(
							resolution.request,
						);
						if (requestId) {
							smsBridgePendingRequestsRef.current.set(requestId, {
								handle: inbound.handle,
								replyText: "",
								inboundComparableText: normalizeSmsBridgeComparableText(
									inbound.text,
								),
								createdAt: Date.now(),
							});
							setSmsBridgePendingCount(
								smsBridgePendingRequestsRef.current.size,
							);
							pushSmsBridgeLog(
								`Forwarded SMS to agent request ${requestId} for ${inbound.handle}.`,
							);
						}
					} catch {
						await flushSmsBridgeReply({
							handle: inbound.handle,
							text: "Sorry, Wingman is currently offline. Please try again in a moment.",
							replyType: "command",
						});
					}
				}

				nextCursor = inbound.rowId;
				smsBridgeCursorRef.current = nextCursor;
				localStorage.setItem(SMS_BRIDGE_CURSOR_STORAGE_KEY, String(nextCursor));
			}
		} catch (error) {
			const message = `SMS bridge polling failed: ${String(error)}`;
			setSmsBridgeMode("error", message);
			pushSmsBridgeLog(message);
		} finally {
			smsBridgePollingRef.current = false;
		}
	}, [
		ensureSmsBridgeCursor,
		flushSmsBridgeReply,
		gateway.workspace.selectedAgentId,
		pushSmsBridgeLog,
		runtime.state.settings,
		runtime.state.smsBridgeEnabled,
		setSmsBridgeMode,
		setSmsBridgePendingCount,
		smsBridgeAllowlistSet,
	]);

	useEffect(() => {
		if (!runtime.state.smsBridgeEnabled) {
			setSmsBridgeMode("disabled", null);
			setSmsBridgePendingCount(0);
			return;
		}
		setSmsBridgeMode("idle");
	}, [
		runtime.state.smsBridgeEnabled,
		setSmsBridgeMode,
		setSmsBridgePendingCount,
	]);

	useEffect(() => {
		if (overlayMode) return;
		if (!runtime.state.nativeRuntime) return;
		if (runtime.state.platform.os !== "macos") return;
		if (!runtime.state.smsBridgeEnabled) return;
		if (gateway.workspace.connectionStatus !== "connected") return;

		const socket = new GatewaySocketClient({
			onAgentEvent: (requestId, payload) => {
				handleSmsBridgeAgentEvent(requestId, payload);
			},
			onConnectionChanged: (connected) => {
				setSmsBridgeMode(connected ? "running" : "idle");
			},
		});
		smsBridgeSocketRef.current = socket;
		socket.connect(
			runtime.state.settings,
			`sms-bridge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
		);
		pushSmsBridgeLog("Started macOS Messages bridge socket.");

		return () => {
			smsBridgePollingRef.current = false;
			smsBridgePendingRequestsRef.current.clear();
			smsBridgeRecentOutboundRef.current = [];
			setSmsBridgePendingCount(0);
			socket.disconnect();
			if (smsBridgeSocketRef.current === socket) {
				smsBridgeSocketRef.current = null;
			}
			if (runtime.state.smsBridgeEnabled) {
				setSmsBridgeMode("idle");
			}
			pushSmsBridgeLog("Stopped macOS Messages bridge socket.");
		};
	}, [
		gateway.workspace.connectionStatus,
		handleSmsBridgeAgentEvent,
		overlayMode,
		runtime.state.nativeRuntime,
		runtime.state.platform.os,
		runtime.state.smsBridgeEnabled,
		runtime.state.settings,
		pushSmsBridgeLog,
		setSmsBridgeMode,
		setSmsBridgePendingCount,
	]);

	useEffect(() => {
		if (overlayMode) return;
		if (!runtime.state.nativeRuntime) return;
		if (runtime.state.platform.os !== "macos") return;
		if (!runtime.state.smsBridgeEnabled) return;
		if (gateway.workspace.connectionStatus !== "connected") return;

		void pollSmsBridge();
		const timer = window.setInterval(() => {
			void pollSmsBridge();
		}, SMS_BRIDGE_POLL_INTERVAL_MS);
		return () => window.clearInterval(timer);
	}, [
		gateway.workspace.connectionStatus,
		overlayMode,
		pollSmsBridge,
		runtime.state.nativeRuntime,
		runtime.state.platform.os,
		runtime.state.smsBridgeEnabled,
	]);

	const runSmsBridgeSelfTest = useCallback(async () => {
		if (!runtime.state.nativeRuntime || runtime.state.platform.os !== "macos") {
			return {
				ok: false,
				message: "SMS bridge test is only available in native macOS runtime.",
			};
		}
		if (gateway.workspace.connectionStatus !== "connected") {
			return {
				ok: false,
				message: "Connect to gateway before running SMS bridge test.",
			};
		}
		if (!runtime.state.smsBridgeEnabled) {
			return {
				ok: false,
				message: "Enable SMS bridge before running bridge test.",
			};
		}

		const handle = resolveSmsBridgeTestHandle(runtime.state.smsBridgeAllowlist);
		if (!handle) {
			return {
				ok: false,
				message:
					"Add at least one contact to the SMS bridge allowlist before test.",
			};
		}

		try {
			setSmsBridgeMode("running", null);
			pushSmsBridgeLog(`Running SMS bridge test for ${handle}.`);
			const latest = await getMacosMessagesLatestRowId();
			if (latest === null) {
				throw new Error(
					"Could not read Messages database cursor. Check Full Disk Access.",
				);
			}
			setSmsBridgeHealth((prev) => ({
				...prev,
				lastPollAt: Date.now(),
				lastError: null,
			}));
			const target = buildSmsTargetForHandle(handle);
			if (!target) {
				throw new Error("Invalid allowlist test handle.");
			}

			const resolution = await submitSmsInboundMessage(runtime.state.settings, {
				target,
				text: "STATUS",
				agentId: gateway.workspace.selectedAgentId || undefined,
				queueIfBusy: true,
			});
			const roundTripText =
				resolution.kind === "agent"
					? "STATUS test unexpectedly routed to agent path."
					: resolution.responseText;
			await flushSmsBridgeReply({
				handle,
				text: `[Wingman SMS Bridge Test]\n${roundTripText}`,
				replyType: "command",
			});
			setSmsBridgeMode("running", null);
			pushSmsBridgeLog(`Bridge test completed for ${handle}.`);
			return {
				ok: true,
				message: `Sent bridge test SMS to ${handle}.`,
			};
		} catch (error) {
			const message = `Bridge test failed: ${String(error)}`;
			setSmsBridgeMode("error", message);
			pushSmsBridgeLog(message);
			return { ok: false, message };
		}
	}, [
		flushSmsBridgeReply,
		gateway.workspace.connectionStatus,
		gateway.workspace.selectedAgentId,
		pushSmsBridgeLog,
		runtime.state.nativeRuntime,
		runtime.state.platform.os,
		runtime.state.settings,
		runtime.state.smsBridgeAllowlist,
		runtime.state.smsBridgeEnabled,
		setSmsBridgeMode,
	]);

	useEffect(() => {
		if (overlayMode) return;
		if (!runtime.state.autoConnectOnLaunch) return;
		if (gateway.workspace.connectionStatus !== "disconnected") return;
		if (autoConnectAttemptedRef.current) return;
		autoConnectAttemptedRef.current = true;
		void gateway.actions.connectGateway();
	}, [
		gateway.actions,
		gateway.workspace.connectionStatus,
		overlayMode,
		runtime.state.autoConnectOnLaunch,
	]);

	useEffect(() => {
		if (overlayMode) return;
		const nonce = runtime.state.quickSendNonce;
		if (!nonce || nonce === handledQuickSendNonceRef.current) return;
		handledQuickSendNonceRef.current = nonce;

		const transcript = runtime.state.transcript.trim();
		void (async () => {
			if (!transcript) {
				await runtime.actions.clearQuickSend();
				return;
			}
			if (gateway.workspace.connectionStatus !== "connected") {
				runtime.setStatus(
					"Hotkey transcript captured. Connect to gateway to send messages.",
					true,
				);
				await runtime.actions.clearQuickSend();
				return;
			}
			const targetThread = gateway.activeThread;
			if (targetThread) {
				runtime.setStatus(
					`Sending transcript to "${targetThread.name}" (${targetThread.agentId}).`,
				);
			} else {
				runtime.setStatus(
					`Sending transcript to a new session for agent "${gateway.workspace.selectedAgentId || "main"}".`,
				);
			}
			if (!window.location.hash.startsWith("#/")) {
				window.location.hash = "#/";
			}
			const sent = await gateway.actions.sendPromptText(transcript);
			if (sent) {
				await runtime.actions.clearTranscript();
				runtime.setStatus("Transcript sent to chat.");
			}
			await runtime.actions.clearQuickSend();
		})();
	}, [
		gateway.activeThread,
		gateway.actions,
		gateway.workspace.connectionStatus,
		gateway.workspace.selectedAgentId,
		overlayMode,
		runtime.actions,
		runtime.setStatus,
		runtime.state.quickSendNonce,
		runtime.state.transcript,
	]);

	useEffect(() => {
		if (overlayMode) return;
		const completion = gateway.workspace.lastCompletion;
		if (!completion) return;
		if (completion.nonce === handledCompletionNonceRef.current) return;
		handledCompletionNonceRef.current = completion.nonce;
		if (!runtime.state.nativeRuntime) return;
		if (!runtime.state.notifyOnAgentFinish) return;
		const notice = buildAgentCompletionNotice({
			agentId: completion.agentId,
			threadName: completion.threadName,
			preview: completion.preview,
		});
		void runtime.actions.sendNotification(notice);
	}, [
		gateway.workspace.lastCompletion,
		overlayMode,
		runtime.actions,
		runtime.state.nativeRuntime,
		runtime.state.notifyOnAgentFinish,
	]);

	useEffect(() => {
		if (overlayMode) return;
		stopVoicePlayback();
	}, [gateway.workspace.activeThreadId, overlayMode, stopVoicePlayback]);

	useEffect(() => {
		const activeIds = new Set(
			gateway.workspace.threads.map((thread) => thread.id),
		);
		for (const threadId of spokenMessagesRef.current.keys()) {
			if (!activeIds.has(threadId)) {
				spokenMessagesRef.current.delete(threadId);
			}
		}
		setVoiceSessions((prev) => {
			const nextEntries = Object.entries(prev).filter(([threadId]) =>
				activeIds.has(threadId),
			);
			if (nextEntries.length === Object.keys(prev).length) return prev;
			return Object.fromEntries(nextEntries);
		});
	}, [gateway.workspace.threads]);

	useEffect(() => {
		if (overlayMode) return;
		const completion = gateway.workspace.lastCompletion;
		if (!completion) return;
		const targetThread = gateway.workspace.threads.find(
			(thread) => thread.id === completion.threadId,
		);
		if (!targetThread) return;
		const targetMessage =
			targetThread.messages.find(
				(message) => message.id === completion.messageId,
			) ||
			[...targetThread.messages]
				.reverse()
				.find((message) => message.role === "assistant");
		if (!targetMessage || targetMessage.role !== "assistant") return;

		let spoken = spokenMessagesRef.current.get(targetThread.id);
		if (!spoken) {
			spoken = new Set<string>();
			spokenMessagesRef.current.set(targetThread.id, spoken);
		}
		const shouldSpeak = shouldAutoSpeak({
			text: targetMessage.content,
			enabled: isVoiceAutoEnabled(targetThread.id),
			spokenMessages: spoken,
			requestId: targetMessage.id,
		});
		if (!shouldSpeak) return;
		spoken.add(targetMessage.id);
		void speakMessageVoice({
			messageId: targetMessage.id,
			text: targetMessage.content,
			agentId: targetThread.agentId,
		});
	}, [
		gateway.workspace.lastCompletion,
		gateway.workspace.threads,
		isVoiceAutoEnabled,
		overlayMode,
		speakMessageVoice,
	]);

	useEffect(() => {
		return () => {
			stopVoicePlayback();
		};
	}, [stopVoicePlayback]);

	if (overlayMode) {
		return (
			<OverlayView
				state={runtime.state}
				actions={runtime.actions}
				canUseWebSpeechRecognition={runtime.canUseWebSpeechRecognition}
			/>
		);
	}

	return (
		<MainView
			runtimeState={runtime.state}
			runtimeActions={runtime.actions}
			workspace={gateway.workspace}
			workspaceActions={gateway.actions}
			smsBridgeHealth={smsBridgeHealth}
			onRunSmsBridgeTest={runSmsBridgeSelfTest}
			voiceAutoEnabled={
				gateway.activeThread
					? isVoiceAutoEnabled(gateway.activeThread.id)
					: false
			}
			voicePlayback={voicePlayback}
			onToggleVoiceAuto={handleToggleVoiceAuto}
			onSpeakVoice={handleSpeakVoice}
			onStopVoice={handleStopVoice}
		/>
	);
}

type MainViewProps = {
	runtimeState: RuntimeState;
	runtimeActions: ReturnType<typeof useRuntimeController>["actions"];
	workspace: WorkspaceState;
	workspaceActions: ReturnType<typeof useGatewayWorkspace>["actions"];
	smsBridgeHealth: SmsBridgeHealth;
	onRunSmsBridgeTest: () => Promise<{ ok: boolean; message: string }>;
	voiceAutoEnabled: boolean;
	voicePlayback: { status: VoicePlaybackStatus; messageId?: string };
	onToggleVoiceAuto: () => void;
	onSpeakVoice: (messageId: string, text: string, agentId?: string) => void;
	onStopVoice: () => void;
};

type WorkspaceActions = ReturnType<typeof useGatewayWorkspace>["actions"];
type RuntimeActions = ReturnType<typeof useRuntimeController>["actions"];

type GatewayScreenProps = {
	runtimeState: RuntimeState;
	runtimeActions: RuntimeActions;
	workspace: WorkspaceState;
	workspaceActions: WorkspaceActions;
	resolvedUi: string;
};

function GatewayScreen({
	runtimeState,
	runtimeActions,
	workspace,
	workspaceActions,
	resolvedUi,
}: GatewayScreenProps) {
	return (
		<section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 backdrop-blur">
			<h2 className="text-lg font-semibold">Settings</h2>
			<p className="mt-1 text-xs text-slate-300">
				{workspace.connectionStatus === "connected"
					? "Connected"
					: workspace.connectionStatus === "connecting"
						? "Connecting"
						: "Disconnected"}
				{" · "}
				{workspace.connectionMessage}
			</p>
			<p className="mt-1 text-xs text-slate-400">
				Node mode: {workspace.nodeModeMessage}
			</p>
			<div className="mt-3 flex flex-wrap gap-2">
				<button
					type="button"
					className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
					onClick={() =>
						void (workspace.connectionStatus === "connected"
							? workspaceActions.disconnectGateway()
							: workspaceActions.connectGateway())
					}
				>
					{workspace.connectionStatus === "connected"
						? "Disconnect"
						: "Connect"}
				</button>
				<button
					type="button"
					className="rounded-full border border-white/20 px-4 py-2 text-sm"
					onClick={() => void workspaceActions.testConnection()}
					disabled={workspace.checkingConnection}
				>
					{workspace.checkingConnection ? "Testing..." : "Test Connection"}
				</button>
			</div>

			<div className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 p-3">
				<p className="text-sm font-semibold text-slate-100">Quick Controls</p>
				<p className="mt-1 text-[11px] text-slate-400">
					Common runtime behavior controls for this device.
				</p>
				<div className="mt-3 grid gap-2 lg:grid-cols-4">
					<label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
						<span>Auto-connect on launch</span>
						<input
							type="checkbox"
							checked={runtimeState.autoConnectOnLaunch}
							onChange={(event) =>
								runtimeActions.updateAutoConnectOnLaunch(event.target.checked)
							}
						/>
					</label>
					<label className="flex items-center justify-between gap-3 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
						<span>Notify when agent finishes</span>
						<input
							type="checkbox"
							checked={runtimeState.notifyOnAgentFinish}
							onChange={(event) =>
								runtimeActions.updateNotifyOnAgentFinish(event.target.checked)
							}
						/>
					</label>
					<label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
						<span>Enable this device as a node</span>
						<input
							type="checkbox"
							checked={runtimeState.enableNodeMode}
							onChange={(event) => {
								const next = event.target.checked;
								runtimeActions.updateEnableNodeMode(next);
								void workspaceActions.setNodeExecutionEnabled(next);
							}}
						/>
					</label>
					<label className="grid gap-1 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-300 lg:col-span-2">
						<span>Node Name</span>
						<input
							className="rounded-lg border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:ring"
							value={runtimeState.nodeName}
							onChange={(event) =>
								runtimeActions.updateNodeName(event.target.value)
							}
							placeholder="Wingman Desktop"
						/>
					</label>
				</div>
			</div>

			<details
				className="mt-3 rounded-xl border border-white/10 bg-slate-950/40 p-3"
				open
			>
				<summary className="cursor-pointer text-sm font-semibold">
					Connection Settings
				</summary>
				<div className="mt-3 grid gap-2 sm:grid-cols-2">
					<Field
						label="Gateway URL"
						value={runtimeState.settings.url}
						onChange={(value) => runtimeActions.updateSetting("url", value)}
					/>
					<Field
						label="Gateway UI URL"
						value={runtimeState.settings.uiUrl}
						onChange={(value) => runtimeActions.updateSetting("uiUrl", value)}
					/>
					<Field
						label="Token"
						value={runtimeState.settings.token}
						onChange={(value) => runtimeActions.updateSetting("token", value)}
					/>
					<Field
						label="Password"
						value={runtimeState.settings.password}
						onChange={(value) =>
							runtimeActions.updateSetting("password", value)
						}
					/>
				</div>
				<p className="mt-2 text-[11px] text-slate-400">
					Credentials are saved locally on this device at{" "}
					<span className="font-mono text-slate-300">
						{new Date(runtimeState.settingsSavedAt).toLocaleTimeString()}
					</span>
					.
				</p>
				<p className="mt-3 text-xs text-slate-300">
					HTTP base:{" "}
					<span className="font-mono text-slate-100">
						{resolvedUi || "(invalid)"}
					</span>
				</p>
			</details>
		</section>
	);
}

type ChatScreenProps = {
	workspace: WorkspaceState;
	activeThread?: SessionThread;
	workspaceActions: WorkspaceActions;
	runtimeState: RuntimeState;
	runtimeActions: RuntimeActions;
	voiceAutoEnabled: boolean;
	voicePlayback: { status: VoicePlaybackStatus; messageId?: string };
	onToggleVoiceAuto: () => void;
	onSpeakVoice: (messageId: string, text: string, agentId?: string) => void;
	onStopVoice: () => void;
};

function ChatScreen({
	workspace,
	activeThread,
	workspaceActions,
	runtimeState,
	runtimeActions,
	voiceAutoEnabled,
	voicePlayback,
	onToggleVoiceAuto,
	onSpeakVoice,
	onStopVoice,
}: ChatScreenProps) {
	const messageViewportRef = useRef<HTMLDivElement | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
	const previousStreamingRef = useRef(workspace.isStreaming);
	const lastMessage = activeThread?.messages[activeThread.messages.length - 1];
	const canSendPrompt =
		workspace.connectionStatus === "connected" &&
		(workspace.prompt.trim().length > 0 || workspace.attachments.length > 0);
	const activeThreadMessagesLoading = Boolean(
		activeThread &&
			!activeThread.messagesLoaded &&
			workspace.loadingMessagesThreadId === activeThread.id,
	);
	const composerStatusHint = resolveComposerStatusHint({
		recording: runtimeState.recording,
		isStreaming: workspace.isStreaming,
		queuedPromptCount: workspace.queuedPromptCount,
		loadingThreadMessages: activeThreadMessagesLoading,
	});
	const lastAssistantMessageId = useMemo(
		() => resolveLastAssistantMessageId(activeThread?.messages),
		[activeThread?.messages],
	);
	const displayMessages = useMemo(
		() => collapseToolOnlyAssistantMessages(activeThread?.messages),
		[activeThread?.messages],
	);
	const todoSnapshot = useMemo(
		() => extractLatestTodoSnapshotFromMessages(activeThread?.messages),
		[activeThread?.messages],
	);
	const visibleTodoSnapshot =
		todoSnapshot && !todoSnapshot.allCompleted ? todoSnapshot : null;
	const showStreamingGlow = workspace.isStreaming;

	const handleTalkButtonClick = useCallback(async () => {
		const toggleResult = await runtimeActions.toggleRecording();
		const transcriptToSend = resolveTalkStopTranscript(
			toggleResult.wasRecording,
			toggleResult.transcriptBeforeToggle,
		);
		if (!transcriptToSend) return;
		workspaceActions.updatePrompt(transcriptToSend);
	}, [runtimeActions, workspaceActions]);

	const handlePickFiles = useCallback(() => {
		fileInputRef.current?.click();
	}, []);

	const handleFileChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			void workspaceActions.addAttachments(event.target.files);
			event.target.value = "";
		},
		[workspaceActions],
	);

	const handlePaste = useCallback(
		(event: ClipboardEvent<HTMLTextAreaElement>) => {
			const imageFiles = extractImageFiles(event.clipboardData?.items);
			if (imageFiles.length === 0) return;
			event.preventDefault();
			void workspaceActions.addAttachments(imageFiles);
			const text = event.clipboardData?.getData("text/plain");
			if (text) {
				workspaceActions.updatePrompt(`${workspace.prompt}${text}`);
			}
		},
		[workspace.prompt, workspaceActions],
	);

	useEffect(() => {
		const node = messageViewportRef.current;
		if (!node) return;
		node.scrollTop = node.scrollHeight;
	}, [
		activeThread?.id,
		activeThread?.messages.length,
		lastMessage?.id,
		lastMessage?.content,
		workspace.isStreaming,
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
	}, [workspace.prompt]);

	useEffect(() => {
		const wasStreaming = previousStreamingRef.current;
		previousStreamingRef.current = workspace.isStreaming;
		if (
			!shouldRefocusComposer({
				wasStreaming,
				isStreaming: workspace.isStreaming,
			})
		)
			return;
		const frame = window.requestAnimationFrame(() => {
			const textarea = composerTextareaRef.current;
			if (!textarea || textarea.disabled) return;
			textarea.focus();
			const cursorPosition = textarea.value.length;
			textarea.setSelectionRange(cursorPosition, cursorPosition);
		});
		return () => window.cancelAnimationFrame(frame);
	}, [workspace.isStreaming]);

	return (
		<section className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-2.5 overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/78 p-2.5 shadow-[0_24px_80px_rgba(2,12,27,0.52)] backdrop-blur-2xl">
			<header className="flex flex-wrap items-start justify-between gap-3 px-2.5">
				<div className="min-w-0">
					<h2 className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-300">
						Chat
					</h2>
					<p className="mt-1 truncate text-sm font-semibold text-slate-100">
						{activeThread?.name || "No conversation selected"}
					</p>
					<p className="mt-0.5 truncate text-[11px] text-slate-400">
						{activeThread
							? `${activeThread.agentId} · ${activeThread.id}`
							: "Create or select a conversation from the sidebar to begin."}
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<button
						type="button"
						className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-slate-950/55 px-3 py-1.5 text-[11px] text-slate-200 transition hover:-translate-y-px hover:border-sky-400/40 hover:bg-slate-800/90 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
						onClick={() =>
							activeThread &&
							workspaceActions.renameThreadByPrompt(activeThread)
						}
						disabled={!activeThread}
					>
						<span>Rename</span>
					</button>
					<button
						type="button"
						className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-500/12 px-3 py-1.5 text-[11px] text-amber-100 transition hover:-translate-y-px hover:border-amber-300/50 hover:bg-amber-500/18 disabled:cursor-not-allowed disabled:opacity-50"
						onClick={() =>
							activeThread &&
							void workspaceActions.clearThreadMessages(activeThread)
						}
						disabled={!activeThread || workspace.isStreaming}
					>
						<TrashIcon className="h-3.5 w-3.5 shrink-0" />
						<span>Clear</span>
					</button>
					<button
						type="button"
						className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/35 bg-rose-500/12 px-3 py-1.5 text-[11px] text-rose-100 transition hover:-translate-y-px hover:border-rose-300/55 hover:bg-rose-500/18 disabled:cursor-not-allowed disabled:opacity-50"
						onClick={() =>
							activeThread && workspaceActions.removeThread(activeThread)
						}
						disabled={!activeThread}
					>
						<span>Delete</span>
					</button>
				</div>
			</header>

			<div
				ref={messageViewportRef}
				className="relative min-h-0 overflow-y-auto overflow-x-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-slate-950/80 to-slate-900/80"
			>
				<div className="min-h-full space-y-3 p-2.5">
					{activeThreadMessagesLoading ? (
						<div className="rounded-2xl border border-white/10 bg-slate-950/50 p-6 text-center text-sm text-slate-300">
							Loading chat history...
						</div>
					) : displayMessages.length > 0 ? (
						displayMessages.map((message) => (
							<MessageCard
								key={message.id}
								message={message}
								isStreaming={workspace.isStreaming}
								activeAssistantMessageId={lastAssistantMessageId}
								voicePlayback={voicePlayback}
								onSpeak={(messageId, text) =>
									onSpeakVoice(messageId, text, activeThread?.agentId)
								}
								onStop={onStopVoice}
							/>
						))
					) : workspace.sessionsLoading ? (
						<div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/50 p-6 text-center text-sm text-slate-300">
							Loading sessions...
						</div>
					) : (
						<div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/50 p-6 text-center text-sm text-slate-300">
							{activeThread
								? "No chat messages yet. Send a prompt to begin."
								: "Choose or create a conversation from the sidebar to start chatting."}
						</div>
					)}
				</div>
				{showStreamingGlow ? (
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center"
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

			<div className="flex min-h-0 flex-col gap-2">
				{workspace.attachments.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{workspace.attachments.map((attachment) => {
							const isFile = isFileAttachment(attachment);
							const isAudio = isAudioAttachment(attachment);
							const isVideo = isVideoAttachment(attachment);
							return (
								<div
									key={attachment.id}
									className="group relative flex items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-slate-900/60 pr-2 text-xs"
								>
									{!isFile && !isAudio && !isVideo && attachment.dataUrl ? (
										<img
											src={attachment.dataUrl}
											alt={attachment.name || "Attachment"}
											className="h-10 w-10 object-cover"
										/>
									) : (
										<div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-800/80 text-[10px] font-semibold text-sky-200">
											{isAudio ? "AUDIO" : isVideo ? "VIDEO" : "FILE"}
										</div>
									)}
									<span className="max-w-[180px] truncate text-slate-300">
										{attachment.name ||
											(isAudio
												? "Audio"
												: isVideo
													? "Video"
													: isFile
														? "File"
														: "Image")}
									</span>
									<button
										type="button"
										className="text-slate-400 transition hover:text-rose-400"
										onClick={() =>
											workspaceActions.removeAttachment(attachment.id)
										}
									>
										×
									</button>
								</div>
							);
						})}
						<button
							type="button"
							className="text-xs text-slate-400 underline decoration-slate-300 underline-offset-4"
							onClick={workspaceActions.clearAttachments}
						>
							Clear all
						</button>
					</div>
				) : null}
				{workspace.attachmentError ? (
					<p className="text-xs text-rose-300">{workspace.attachmentError}</p>
				) : null}
				<label htmlFor="prompt-textarea" className="sr-only">
					Message
				</label>
				<div>
					{visibleTodoSnapshot ? (
						<TodoProgressPanel
							key={`${activeThread?.id ?? "thread"}:${visibleTodoSnapshot.sourceEventId ?? "todos"}`}
							snapshot={visibleTodoSnapshot}
							attached
						/>
					) : null}
					<div
						className={`border border-white/10 bg-slate-950/70 p-2 shadow-[0_12px_26px_rgba(3,9,28,0.35)] ${
							visibleTodoSnapshot
								? "-mt-px rounded-b-2xl rounded-t-xl"
								: "rounded-2xl"
						}`}
					>
						<div className="flex items-center justify-end gap-2 px-1 pb-2">
							<div className="flex items-center gap-2 px-1">
								{workspace.isStreaming ? (
									<span className="inline-flex items-center gap-1 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-cyan-200">
										<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
										Live
									</span>
								) : null}
								{composerStatusHint ? (
									<span className="text-[11px] text-slate-400">
										{composerStatusHint}
									</span>
								) : null}
							</div>
						</div>
						<div className="rounded-xl border border-white/10 bg-slate-900/55 px-2">
							<textarea
								ref={composerTextareaRef}
								id="prompt-textarea"
								className="min-h-[44px] max-h-40 w-full resize-none border-0 bg-transparent px-2 py-[10px] text-sm leading-6 text-slate-100 placeholder:text-slate-400 focus:outline-none"
								rows={1}
								value={workspace.prompt}
								onChange={(event) =>
									workspaceActions.updatePrompt(event.target.value)
								}
								onPaste={handlePaste}
								onKeyDown={(event) => {
									if (event.key === "Enter" && !event.shiftKey) {
										event.preventDefault();
										void workspaceActions.sendPrompt();
									}
								}}
								placeholder="Ask Wingman to do something..."
								style={{ overflowY: "hidden" }}
							/>
						</div>
						<div className="mt-2 flex items-center justify-between gap-2 px-1">
							<div className="flex items-center gap-2">
								<button
									type="button"
									className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-3 text-xs text-slate-200 transition hover:border-sky-400/50 hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
									onClick={handlePickFiles}
									aria-label="Add files"
								>
									<AttachmentIcon />
									<span className="hidden sm:inline">Files</span>
								</button>
								<button
									type="button"
									aria-pressed={runtimeState.recording}
									aria-label={
										runtimeState.recording ? "Stop recording" : "Record audio"
									}
									className={`relative flex h-10 w-10 items-center justify-center rounded-xl border text-xs transition disabled:cursor-not-allowed disabled:opacity-50 ${
										runtimeState.recording
											? "border-rose-400/60 bg-rose-500/20 text-rose-100"
											: "border-white/10 bg-slate-900/70 text-slate-100 hover:border-sky-400/50 hover:text-sky-100"
									}`}
									onClick={() => void handleTalkButtonClick()}
									disabled={workspace.isStreaming}
								>
									<MicIcon />
									{runtimeState.recording ? (
										<span className="pointer-events-none absolute inset-0 rounded-xl border border-rose-400/40 animate-ping" />
									) : null}
								</button>
								<button
									type="button"
									aria-pressed={voiceAutoEnabled}
									aria-label={
										voiceAutoEnabled
											? "Disable auto voice playback"
											: "Enable auto voice playback"
									}
									className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs transition ${
										voiceAutoEnabled
											? "border-cyan-300/50 bg-cyan-500/15 text-cyan-100"
											: "border-white/10 bg-slate-900/70 text-slate-200 hover:border-sky-400/50 hover:text-sky-100"
									}`}
									onClick={onToggleVoiceAuto}
									disabled={!activeThread}
								>
									<SpeakerIcon />
									<span className="hidden md:inline">
										{voiceAutoEnabled ? "Voice Auto" : "Voice Off"}
									</span>
								</button>
							</div>
							<button
								className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-400/60 bg-gradient-to-br from-cyan-400 to-blue-500 text-white transition hover:from-cyan-300 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
								onClick={() => void workspaceActions.sendPrompt()}
								type="button"
								aria-label="Send prompt"
								title="Send prompt"
								disabled={!canSendPrompt}
							>
								<SendIcon />
							</button>
						</div>
						{voicePlayback.status !== "idle" ? (
							<div className="mt-2 flex justify-end">
								<button
									type="button"
									className="rounded-full border border-white/20 px-3 py-1 text-xs text-slate-200"
									onClick={onStopVoice}
								>
									Stop Voice ({getVoicePlaybackLabel(voicePlayback.status)})
								</button>
							</div>
						) : null}
						<input
							ref={fileInputRef}
							type="file"
							accept={FILE_INPUT_ACCEPT}
							className="hidden"
							multiple
							onChange={handleFileChange}
						/>
					</div>
				</div>
			</div>
		</section>
	);
}

type AgentsScreenProps = {
	workspace: WorkspaceState;
	workspaceActions: WorkspaceActions;
};

function AgentsScreen({ workspace, workspaceActions }: AgentsScreenProps) {
	const isEditMode = workspace.agentFormMode === "edit";
	const formAgentId = isEditMode
		? workspace.editTargetAgentId
		: workspace.createAgentDraft.id.trim();
	const subAgentCandidates = buildSubAgentCandidates(
		workspace.agentCatalog,
		formAgentId,
	);

	return (
		<section>
			<div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4 backdrop-blur">
				<div>
					<h2 className="text-lg font-semibold">
						{isEditMode ? "Edit Agent" : "Create Agent"}
					</h2>
					<p className="mt-1 text-xs text-slate-300">
						{isEditMode
							? "Update an existing agent's prompt training and sub-agent links."
							: "Create a new agent through the gateway API and make it available for sessions."}
					</p>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<button
						type="button"
						className={`rounded-full px-3 py-2 text-xs font-semibold ${
							!isEditMode
								? "bg-cyan-300 text-slate-950"
								: "border border-white/20 text-slate-100"
						}`}
						onClick={() => workspaceActions.setAgentFormMode("create")}
					>
						Create Mode
					</button>
					<button
						type="button"
						className={`rounded-full px-3 py-2 text-xs font-semibold ${
							isEditMode
								? "bg-cyan-300 text-slate-950"
								: "border border-white/20 text-slate-100"
						}`}
						onClick={() => workspaceActions.setAgentFormMode("edit")}
					>
						Edit Mode
					</button>
				</div>
				{isEditMode ? (
					<label className="grid gap-1 text-xs text-slate-300">
						<span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
							Agent To Edit
						</span>
						<div className="relative">
							<select
								className="h-10 w-full appearance-none rounded-xl border border-white/20 bg-slate-950/55 px-3 pr-9 text-sm text-slate-100 outline-none ring-cyan-300/40 transition focus:ring"
								value={workspace.editTargetAgentId}
								onChange={(event) =>
									workspaceActions.setEditTargetAgentId(event.target.value)
								}
							>
								{workspace.agentCatalog.map((agent) => (
									<option key={agent.id} value={agent.id}>
										{agent.displayName}
									</option>
								))}
							</select>
							<div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
								<ChevronDownIcon />
							</div>
						</div>
					</label>
				) : null}
				<div className="grid gap-2">
					{isEditMode ? (
						<label className="grid gap-1 text-xs text-slate-300">
							<span>Agent ID</span>
							<input
								className="rounded-lg border border-white/20 bg-slate-950/40 px-3 py-2 text-sm text-slate-400"
								value={workspace.createAgentDraft.id}
								disabled
							/>
						</label>
					) : (
						<Field
							label="Agent ID"
							value={workspace.createAgentDraft.id}
							onChange={(value) =>
								workspaceActions.updateCreateAgentDraft("id", value)
							}
						/>
					)}
					<Field
						label="Display Name"
						value={workspace.createAgentDraft.displayName}
						onChange={(value) =>
							workspaceActions.updateCreateAgentDraft("displayName", value)
						}
					/>
					<Field
						label="Description"
						value={workspace.createAgentDraft.description}
						onChange={(value) =>
							workspaceActions.updateCreateAgentDraft("description", value)
						}
					/>
					<Field
						label="Model"
						value={workspace.createAgentDraft.model}
						onChange={(value) =>
							workspaceActions.updateCreateAgentDraft("model", value)
						}
					/>
					<Field
						label="Tools (comma-separated)"
						value={workspace.createAgentDraft.toolsCsv}
						onChange={(value) =>
							workspaceActions.updateCreateAgentDraft("toolsCsv", value)
						}
					/>
					<label className="flex items-center gap-2 rounded-lg border border-white/20 bg-slate-950/50 px-3 py-2 text-xs text-slate-200">
						<input
							type="checkbox"
							className="h-4 w-4 rounded border-white/20 bg-slate-900"
							checked={workspace.createAgentDraft.promptTraining}
							onChange={(event) =>
								workspaceActions.updateCreateAgentDraft(
									"promptTraining",
									event.target.checked,
								)
							}
						/>
						<span>Enable promptTraining</span>
					</label>
					<p className="-mt-1 text-[11px] text-slate-400">
						When enabled, this agent can learn from prompt-training feedback so
						it can improve its performance over time.
					</p>
					<label className="grid gap-1 text-xs text-slate-300">
						<span>Prompt</span>
						<textarea
							className="min-h-24 rounded-lg border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:ring"
							value={workspace.createAgentDraft.prompt}
							onChange={(event) =>
								workspaceActions.updateCreateAgentDraft(
									"prompt",
									event.target.value,
								)
							}
						/>
					</label>
					<div className="rounded-lg border border-white/20 bg-slate-950/50 p-3">
						<div className="flex items-center justify-between">
							<p className="text-xs font-semibold text-slate-200">Sub-Agents</p>
							<span className="text-[11px] text-slate-400">
								{workspace.createAgentDraft.selectedSubAgentIds.length} selected
							</span>
						</div>
						<p className="mt-1 text-[11px] text-slate-400">
							Existing agents only. Current edited agent is automatically
							excluded.
						</p>
						<div className="mt-2 max-h-36 space-y-1 overflow-auto pr-1">
							{subAgentCandidates.length === 0 ? (
								<p className="text-[11px] text-slate-400">
									No available agents to link.
								</p>
							) : (
								subAgentCandidates.map((agent) => {
									const checked =
										workspace.createAgentDraft.selectedSubAgentIds.includes(
											agent.id,
										);
									return (
										<label
											key={agent.id}
											className="flex cursor-pointer items-center justify-between rounded-md border border-white/10 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-200"
										>
											<div className="mr-2 min-w-0">
												<p className="truncate font-semibold">
													{agent.displayName}
												</p>
												<p className="truncate font-mono text-[10px] text-slate-400">
													{agent.id}
												</p>
											</div>
											<input
												type="checkbox"
												className="h-4 w-4 rounded border-white/20 bg-slate-900"
												checked={checked}
												onChange={() =>
													workspaceActions.toggleCreateAgentSubAgent(agent.id)
												}
											/>
										</label>
									);
								})
							)}
						</div>
					</div>
				</div>
				<button
					type="button"
					className="w-full rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
					onClick={() => void workspaceActions.submitAgentForm()}
					disabled={workspace.creatingAgent}
				>
					{workspace.creatingAgent
						? isEditMode
							? "Saving..."
							: "Creating..."
						: isEditMode
							? "Save Agent Changes"
							: "Create Agent"}
				</button>
			</div>
		</section>
	);
}

type RuntimeScreenProps = {
	runtimeState: RuntimeState;
	runtimeActions: RuntimeActions;
	workspace: WorkspaceState;
	workspaceActions: WorkspaceActions;
	smsBridgeHealth: SmsBridgeHealth;
	onRunSmsBridgeTest: () => Promise<{ ok: boolean; message: string }>;
};

function RuntimeScreen({
	runtimeState,
	runtimeActions,
	workspace,
	workspaceActions,
	smsBridgeHealth,
	onRunSmsBridgeTest,
}: RuntimeScreenProps) {
	const [recordHotkey, setRecordHotkey] = useState(runtimeState.recordHotkey);
	const [overlayHotkey, setOverlayHotkey] = useState(
		runtimeState.overlayHotkey,
	);
	const [quickSendOnRecordHotkey, setQuickSendOnRecordHotkey] = useState(
		runtimeState.quickSendOnRecordHotkey,
	);
	const [savingHotkeys, setSavingHotkeys] = useState(false);
	const [hotkeySaveFeedback, setHotkeySaveFeedback] = useState<{
		text: string;
		error: boolean;
	} | null>(null);
	const [sendingNotification, setSendingNotification] = useState(false);
	const [notificationFeedback, setNotificationFeedback] = useState<{
		text: string;
		error: boolean;
	} | null>(null);
	const [providerDrafts, setProviderDrafts] = useState<Record<string, string>>(
		{},
	);
	const [providerFeedback, setProviderFeedback] = useState<{
		text: string;
		error: boolean;
	} | null>(null);
	const [updatingProviderName, setUpdatingProviderName] = useState<
		string | null
	>(null);
	const [voiceProvider, setVoiceProvider] =
		useState<VoiceConfig["provider"]>("web_speech");
	const [voicePolicy, setVoicePolicy] =
		useState<NonNullable<VoiceConfig["defaultPolicy"]>>("off");
	const [voiceName, setVoiceName] = useState("");
	const [voiceLang, setVoiceLang] = useState("");
	const [voiceRate, setVoiceRate] = useState("");
	const [voicePitch, setVoicePitch] = useState("");
	const [voiceVolume, setVoiceVolume] = useState("");
	const [elevenVoiceId, setElevenVoiceId] = useState("");
	const [elevenModelId, setElevenModelId] = useState("");
	const [elevenStability, setElevenStability] = useState("");
	const [elevenSimilarityBoost, setElevenSimilarityBoost] = useState("");
	const [elevenStyle, setElevenStyle] = useState("");
	const [elevenSpeed, setElevenSpeed] = useState("");
	const [elevenOutputFormat, setElevenOutputFormat] = useState("");
	const [elevenLatency, setElevenLatency] = useState("");
	const [elevenSpeakerBoost, setElevenSpeakerBoost] = useState<boolean | null>(
		null,
	);
	const [savingVoice, setSavingVoice] = useState(false);
	const [voiceFeedback, setVoiceFeedback] = useState<{
		text: string;
		error: boolean;
	} | null>(null);
	const [smsAllowlistDraft, setSmsAllowlistDraft] = useState(() =>
		formatSmsAllowlist(runtimeState.smsBridgeAllowlist),
	);
	const [smsAllowlistFeedback, setSmsAllowlistFeedback] = useState<{
		text: string;
		error: boolean;
	} | null>(null);
	const [runningSmsBridgeTest, setRunningSmsBridgeTest] = useState(false);
	const [smsBridgeTestFeedback, setSmsBridgeTestFeedback] = useState<{
		text: string;
		error: boolean;
	} | null>(null);

	useEffect(() => {
		setRecordHotkey(runtimeState.recordHotkey);
	}, [runtimeState.recordHotkey]);

	useEffect(() => {
		setOverlayHotkey(runtimeState.overlayHotkey);
	}, [runtimeState.overlayHotkey]);

	useEffect(() => {
		setQuickSendOnRecordHotkey(runtimeState.quickSendOnRecordHotkey);
	}, [runtimeState.quickSendOnRecordHotkey]);

	useEffect(() => {
		setSmsAllowlistDraft(formatSmsAllowlist(runtimeState.smsBridgeAllowlist));
	}, [runtimeState.smsBridgeAllowlist]);

	useEffect(() => {
		const voice = workspace.voiceConfig;
		if (!voice) return;
		setVoiceProvider(voice.provider || "web_speech");
		setVoicePolicy(voice.defaultPolicy || "off");
		setVoiceName(voice.webSpeech?.voiceName || "");
		setVoiceLang(voice.webSpeech?.lang || "");
		setVoiceRate(
			voice.webSpeech?.rate !== undefined ? String(voice.webSpeech.rate) : "",
		);
		setVoicePitch(
			voice.webSpeech?.pitch !== undefined ? String(voice.webSpeech.pitch) : "",
		);
		setVoiceVolume(
			voice.webSpeech?.volume !== undefined
				? String(voice.webSpeech.volume)
				: "",
		);
		setElevenVoiceId(voice.elevenlabs?.voiceId || "");
		setElevenModelId(voice.elevenlabs?.modelId || "");
		setElevenStability(
			voice.elevenlabs?.stability !== undefined
				? String(voice.elevenlabs.stability)
				: "",
		);
		setElevenSimilarityBoost(
			voice.elevenlabs?.similarityBoost !== undefined
				? String(voice.elevenlabs.similarityBoost)
				: "",
		);
		setElevenStyle(
			voice.elevenlabs?.style !== undefined
				? String(voice.elevenlabs.style)
				: "",
		);
		setElevenSpeed(
			voice.elevenlabs?.speed !== undefined
				? String(voice.elevenlabs.speed)
				: "",
		);
		setElevenOutputFormat(voice.elevenlabs?.outputFormat || "");
		setElevenLatency(
			voice.elevenlabs?.optimizeStreamingLatency !== undefined
				? String(voice.elevenlabs.optimizeStreamingLatency)
				: "",
		);
		setElevenSpeakerBoost(voice.elevenlabs?.speakerBoost ?? null);
	}, [workspace.voiceConfig]);

	const handleSaveHotkeys = useCallback(async () => {
		setSavingHotkeys(true);
		setHotkeySaveFeedback(null);
		const ok = await runtimeActions.saveHotkeySettings({
			recordHotkey,
			overlayHotkey,
			quickSendOnRecordHotkey,
		});
		setSavingHotkeys(false);
		setHotkeySaveFeedback(
			ok
				? { text: "Hotkeys saved.", error: false }
				: {
						text: "Failed to save hotkeys. Verify format and try again.",
						error: true,
					},
		);
	}, [overlayHotkey, quickSendOnRecordHotkey, recordHotkey, runtimeActions]);

	const handleSendTestNotification = useCallback(async () => {
		setSendingNotification(true);
		setNotificationFeedback(null);
		const ok = await runtimeActions.sendTestNotification();
		setSendingNotification(false);
		setNotificationFeedback(
			ok
				? {
						text: "Test notification scheduled. Check Notification Center if it is not shown immediately.",
						error: false,
					}
				: {
						text: "Notification test failed. Check OS notification permissions and retry.",
						error: true,
					},
		);
	}, [runtimeActions]);

	const handleSaveSmsAllowlist = useCallback(() => {
		const parsed = runtimeActions.updateSmsBridgeAllowlist(smsAllowlistDraft);
		setSmsAllowlistDraft(formatSmsAllowlist(parsed));
		setSmsAllowlistFeedback({
			text:
				parsed.length > 0
					? `Saved ${parsed.length} allowed contact${parsed.length === 1 ? "" : "s"}.`
					: "Allowlist cleared. All contacts are allowed.",
			error: false,
		});
	}, [runtimeActions, smsAllowlistDraft]);

	const handleRunSmsBridgeTest = useCallback(async () => {
		setRunningSmsBridgeTest(true);
		setSmsBridgeTestFeedback(null);
		const result = await onRunSmsBridgeTest();
		setRunningSmsBridgeTest(false);
		setSmsBridgeTestFeedback({
			text: result.message,
			error: !result.ok,
		});
	}, [onRunSmsBridgeTest]);

	const parseNumber = useCallback((value: string): number | undefined => {
		const trimmed = value.trim();
		if (!trimmed) return undefined;
		const parsed = Number(trimmed);
		return Number.isFinite(parsed) ? parsed : undefined;
	}, []);

	const handleSaveProvider = useCallback(
		async (providerName: string) => {
			setUpdatingProviderName(providerName);
			setProviderFeedback(null);
			const token = providerDrafts[providerName] || "";
			const ok = await workspaceActions.saveProviderCredential(
				providerName,
				token,
			);
			setUpdatingProviderName(null);
			setProviderFeedback(
				ok
					? { text: `Saved token for ${providerName}.`, error: false }
					: { text: `Failed to save token for ${providerName}.`, error: true },
			);
			if (ok) {
				setProviderDrafts((prev) => ({ ...prev, [providerName]: "" }));
			}
		},
		[providerDrafts, workspaceActions],
	);

	const handleClearProvider = useCallback(
		async (providerName: string) => {
			setUpdatingProviderName(providerName);
			setProviderFeedback(null);
			const ok = await workspaceActions.clearProviderCredential(providerName);
			setUpdatingProviderName(null);
			setProviderFeedback(
				ok
					? { text: `Cleared token for ${providerName}.`, error: false }
					: { text: `Failed to clear token for ${providerName}.`, error: true },
			);
		},
		[workspaceActions],
	);

	const handleSaveVoice = useCallback(async () => {
		setSavingVoice(true);
		setVoiceFeedback(null);
		const ok = await workspaceActions.saveVoiceSettings({
			provider: voiceProvider,
			defaultPolicy: voicePolicy,
			webSpeech: {
				voiceName: voiceName.trim() || undefined,
				lang: voiceLang.trim() || undefined,
				rate: parseNumber(voiceRate),
				pitch: parseNumber(voicePitch),
				volume: parseNumber(voiceVolume),
			},
			elevenlabs: {
				voiceId: elevenVoiceId.trim() || undefined,
				modelId: elevenModelId.trim() || undefined,
				stability: parseNumber(elevenStability),
				similarityBoost: parseNumber(elevenSimilarityBoost),
				style: parseNumber(elevenStyle),
				speed: parseNumber(elevenSpeed),
				outputFormat: elevenOutputFormat.trim() || undefined,
				optimizeStreamingLatency: parseNumber(elevenLatency),
				speakerBoost: elevenSpeakerBoost ?? undefined,
			},
		});
		setSavingVoice(false);
		setVoiceFeedback(
			ok
				? { text: "Voice settings saved.", error: false }
				: { text: "Failed to save voice settings.", error: true },
		);
	}, [
		elevenLatency,
		elevenModelId,
		elevenOutputFormat,
		elevenSimilarityBoost,
		elevenSpeakerBoost,
		elevenSpeed,
		elevenStability,
		elevenStyle,
		elevenVoiceId,
		parseNumber,
		voiceLang,
		voiceName,
		voicePitch,
		voicePolicy,
		voiceProvider,
		voiceRate,
		voiceVolume,
		workspaceActions,
	]);

	const providerList = useMemo(
		() =>
			[...workspace.providers].sort((a, b) => a.label.localeCompare(b.label)),
		[workspace.providers],
	);
	const configuredProviderCount = providerList.filter(
		(provider) => provider.source !== "missing",
	).length;
	const notificationPermission = runtimeState.permissions.items.find(
		(entry) => entry.id === "notifications",
	);

	return (
		<section className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4 backdrop-blur">
			<div>
				<h2 className="text-lg font-semibold">Runtime</h2>
				<p className="mt-1 text-xs text-slate-300">
					Native profile: {runtimeState.platform.os}. Manage local runtime
					behavior and OS integration.
				</p>
			</div>

			<div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
				<div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
					<p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
						Connection
					</p>
					<p
						className={
							runtimeState.connected
								? "text-sm text-emerald-200"
								: "text-sm text-rose-200"
						}
					>
						{runtimeState.connected ? "Connected" : "Disconnected"}
					</p>
				</div>
				<div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
					<p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
						Recording
					</p>
					<p
						className={
							runtimeState.recording
								? "text-sm text-cyan-200"
								: "text-sm text-slate-200"
						}
					>
						{runtimeState.recording ? "Active" : "Idle"}
					</p>
				</div>
				<div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
					<p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
						Overlay
					</p>
					<p
						className={
							runtimeState.overlayVisible
								? "text-sm text-cyan-200"
								: "text-sm text-slate-200"
						}
					>
						{runtimeState.overlayVisible ? "Visible" : "Hidden"}
					</p>
				</div>
				<div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
					<p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
						Finish Notification
					</p>
					<p
						className={
							runtimeState.notifyOnAgentFinish
								? "text-sm text-emerald-200"
								: "text-sm text-slate-200"
						}
					>
						{runtimeState.notifyOnAgentFinish ? "Enabled" : "Disabled"}
					</p>
				</div>
			</div>

			{SMS_BRIDGE_AVAILABLE ? (
				<details
					className="rounded-xl border border-white/10 bg-slate-950/40 p-3"
					open
				>
					<summary className="cursor-pointer text-sm font-semibold text-slate-100">
						SMS Bridge (macOS Messages)
					</summary>
					<p className="mt-2 text-[11px] text-slate-400">
						Route inbound macOS Messages through Wingman and send replies back as
						SMS/iMessage.
					</p>
					<label className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
						<span>Enable SMS bridge</span>
						<input
							type="checkbox"
							checked={runtimeState.smsBridgeEnabled}
							onChange={(event) => {
								runtimeActions.updateSmsBridgeEnabled(event.target.checked);
								setSmsAllowlistFeedback(null);
							}}
						/>
					</label>
					<label className="mt-3 grid gap-1 text-xs text-slate-300">
						<span>Allowlist (optional, one phone/email per line)</span>
						<textarea
							className="min-h-[96px] rounded-lg border border-white/20 bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-100 outline-none ring-cyan-300/40 focus:ring"
							value={smsAllowlistDraft}
							onChange={(event) => {
								setSmsAllowlistDraft(event.target.value);
								setSmsAllowlistFeedback(null);
							}}
							placeholder={"+15555550000\nfriend@example.com"}
						/>
					</label>
					<div className="mt-2 flex flex-wrap gap-2">
						<button
							type="button"
							className="rounded-full border border-white/20 px-3 py-1.5 text-xs"
							onClick={handleSaveSmsAllowlist}
						>
							Save Allowlist
						</button>
						<button
							type="button"
							className="rounded-full border border-white/20 px-3 py-1.5 text-xs"
							onClick={() => {
								setSmsAllowlistDraft("");
								const parsed = runtimeActions.updateSmsBridgeAllowlist("");
								setSmsAllowlistFeedback({
									text:
										parsed.length > 0
											? "Allowlist reset."
											: "Allowlist cleared. All contacts are allowed.",
									error: false,
								});
							}}
						>
							Clear
						</button>
						<button
							type="button"
							className="rounded-full border border-cyan-300/40 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100"
							onClick={() => void handleRunSmsBridgeTest()}
							disabled={runningSmsBridgeTest}
						>
							{runningSmsBridgeTest ? "Testing..." : "Run Bridge Test"}
						</button>
					</div>
					{smsAllowlistFeedback ? (
						<p
							className={`mt-2 text-xs ${
								smsAllowlistFeedback.error
									? "text-rose-300"
									: "text-emerald-300"
							}`}
						>
							{smsAllowlistFeedback.text}
						</p>
					) : null}
					{smsBridgeTestFeedback ? (
						<p
							className={`mt-2 text-xs ${
								smsBridgeTestFeedback.error
									? "text-rose-300"
									: "text-emerald-300"
							}`}
						>
							{smsBridgeTestFeedback.text}
						</p>
					) : null}
					<div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
						<div className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
							<p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
								Bridge Mode
							</p>
							<p className="mt-1 text-sm text-slate-100">
								{smsBridgeHealth.mode}
							</p>
						</div>
						<div className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
							<p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
								Pending Replies
							</p>
							<p className="mt-1 text-sm text-slate-100">
								{smsBridgeHealth.pendingReplyCount}
							</p>
						</div>
						<div className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
							<p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
								Inbound / Skipped
							</p>
							<p className="mt-1 text-sm text-slate-100">
								{smsBridgeHealth.processedInboundCount} /{" "}
								{smsBridgeHealth.skippedInboundCount}
							</p>
						</div>
						<div className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
							<p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
								Command / Agent Replies
							</p>
							<p className="mt-1 text-sm text-slate-100">
								{smsBridgeHealth.commandReplyCount} /{" "}
								{smsBridgeHealth.agentReplyCount}
							</p>
						</div>
					</div>
					<div className="mt-2 grid gap-1 text-[11px] text-slate-400 sm:grid-cols-2">
						<p>
							Last poll:{" "}
							<span className="font-mono text-slate-300">
								{smsBridgeHealth.lastPollAt
									? new Date(smsBridgeHealth.lastPollAt).toLocaleTimeString()
									: "n/a"}
							</span>
						</p>
						<p>
							Last inbound:{" "}
							<span className="font-mono text-slate-300">
								{smsBridgeHealth.lastInboundAt
									? new Date(smsBridgeHealth.lastInboundAt).toLocaleTimeString()
									: "n/a"}
							</span>
						</p>
						<p>
							Last outbound:{" "}
							<span className="font-mono text-slate-300">
								{smsBridgeHealth.lastOutboundAt
									? new Date(smsBridgeHealth.lastOutboundAt).toLocaleTimeString()
									: "n/a"}
							</span>
						</p>
						<p>
							Last error:{" "}
							<span className="font-mono text-slate-300">
								{smsBridgeHealth.lastError || "none"}
							</span>
						</p>
					</div>
					<div className="mt-2 max-h-36 space-y-1 overflow-auto rounded-lg border border-white/10 bg-slate-900/55 p-2 text-[11px] text-slate-300">
						{smsBridgeHealth.logLines.length > 0 ? (
							smsBridgeHealth.logLines.map((line, index) => (
								<div key={`${line}-${index}`} className="font-mono">
									{line}
								</div>
							))
						) : (
							<div className="text-slate-400">No bridge events yet.</div>
						)}
					</div>
					<p className="mt-2 text-[11px] text-slate-400">
						Requires Full Disk Access (Messages database) and Automation
						permission for Messages.
					</p>
				</details>
			) : null}

			<div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
				<p className="text-sm font-semibold text-slate-100">
					Current Transcript
				</p>
				<p className="mt-2 rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 font-mono text-xs text-slate-100">
					{runtimeState.transcript || "(empty)"}
				</p>
			</div>

			<details
				className="rounded-xl border border-white/10 bg-slate-950/40 p-3"
				open
			>
				<summary className="cursor-pointer text-sm font-semibold text-slate-100">
					Hotkeys
				</summary>
				<p className="mt-2 text-[11px] text-slate-400">
					Configure shortcuts for recording and overlay controls.
				</p>
				<div className="mt-2 grid gap-2 sm:grid-cols-2">
					<Field
						label="Record Toggle"
						value={recordHotkey}
						onChange={(value) => {
							setRecordHotkey(value);
							setHotkeySaveFeedback(null);
						}}
					/>
					<Field
						label="Overlay Toggle"
						value={overlayHotkey}
						onChange={(value) => {
							setOverlayHotkey(value);
							setHotkeySaveFeedback(null);
						}}
					/>
				</div>
				<label className="mt-3 flex items-center gap-2 text-xs text-slate-300">
					<input
						type="checkbox"
						checked={quickSendOnRecordHotkey}
						onChange={(event) => {
							setQuickSendOnRecordHotkey(event.target.checked);
							setHotkeySaveFeedback(null);
						}}
					/>
					<span>
						Quick-send transcript when stop is triggered by the record hotkey
					</span>
				</label>
				<button
					type="button"
					className="mt-3 rounded-full border border-white/20 px-4 py-2 text-sm"
					onClick={() => void handleSaveHotkeys()}
					disabled={savingHotkeys}
				>
					{savingHotkeys ? "Saving..." : "Save Hotkeys"}
				</button>
				{hotkeySaveFeedback ? (
					<p
						className={`mt-2 text-xs ${
							hotkeySaveFeedback.error ? "text-rose-300" : "text-emerald-300"
						}`}
					>
						{hotkeySaveFeedback.text}
					</p>
				) : null}
				<p className="mt-1 text-[11px] text-slate-400">
					Active shortcuts:{" "}
					<span className="font-mono text-slate-300">
						{runtimeState.recordHotkey}
					</span>{" "}
					(record),{" "}
					<span className="font-mono text-slate-300">
						{runtimeState.overlayHotkey}
					</span>{" "}
					(overlay)
				</p>
				<p className="mt-2 text-[11px] text-slate-400">
					Use Tauri accelerator syntax (example:{" "}
					<span className="font-mono text-slate-300">
						CommandOrControl+Shift+R
					</span>
					).
				</p>
				<p className="mt-1 text-[11px] text-slate-400">
					Overlay visibility is controlled by recording start/stop and the
					overlay hotkey.
				</p>
			</details>

			<details className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
				<summary className="cursor-pointer text-sm font-semibold text-slate-100">
					Providers ({configuredProviderCount}/{providerList.length} configured)
				</summary>
				<div className="mt-3 flex items-center justify-end gap-2">
					<button
						type="button"
						className="rounded-full border border-white/20 px-3 py-1 text-[11px]"
						onClick={() => void workspaceActions.refreshProvidersData()}
						disabled={workspace.providersLoading}
					>
						{workspace.providersLoading ? "Refreshing..." : "Refresh"}
					</button>
				</div>
				<p className="mt-1 text-[11px] text-slate-400">
					Store API credentials in the gateway profile used by this desktop app.
				</p>
				{workspace.providersUpdatedAt ? (
					<p className="mt-1 text-[11px] text-slate-400">
						Updated {new Date(workspace.providersUpdatedAt).toLocaleString()}
					</p>
				) : null}
				{workspace.credentialsPath ? (
					<p className="mt-1 break-all text-[11px] text-slate-400">
						Credentials path:{" "}
						<span className="font-mono text-slate-300">
							{workspace.credentialsPath}
						</span>
					</p>
				) : null}
				<div className="mt-2 space-y-2">
					{providerList.length === 0 ? (
						<div className="rounded-lg border border-dashed border-white/10 px-3 py-2 text-xs text-slate-400">
							No providers found yet.
						</div>
					) : (
						providerList.map((provider) => (
							<div
								key={provider.name}
								className="rounded-lg border border-white/10 bg-slate-900/60 p-2"
							>
								<div className="mb-2 flex items-center justify-between gap-2">
									<div className="min-w-0">
										<p className="truncate text-xs font-semibold text-slate-100">
											{provider.label}
										</p>
										<p className="truncate text-[10px] uppercase tracking-[0.12em] text-slate-400">
											{provider.category || "model"} · {provider.source}
										</p>
									</div>
									<span
										className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${
											provider.source === "missing"
												? "border-rose-300/40 text-rose-200"
												: "border-emerald-300/40 text-emerald-200"
										}`}
									>
										{provider.source}
									</span>
								</div>
								<div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
									<input
										type="password"
										autoComplete="off"
										placeholder={`Token for ${provider.label}`}
										value={providerDrafts[provider.name] || ""}
										onChange={(event) =>
											setProviderDrafts((prev) => ({
												...prev,
												[provider.name]: event.target.value,
											}))
										}
										className="rounded-lg border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:ring"
									/>
									<button
										type="button"
										className="rounded-full border border-cyan-300/40 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-100"
										onClick={() => void handleSaveProvider(provider.name)}
										disabled={updatingProviderName === provider.name}
									>
										{updatingProviderName === provider.name
											? "Saving..."
											: "Save"}
									</button>
									<button
										type="button"
										className="rounded-full border border-white/20 px-3 py-1.5 text-xs"
										onClick={() => void handleClearProvider(provider.name)}
										disabled={updatingProviderName === provider.name}
									>
										Clear
									</button>
								</div>
							</div>
						))
					)}
				</div>
				{providerFeedback ? (
					<p
						className={`mt-2 text-xs ${
							providerFeedback.error ? "text-rose-300" : "text-emerald-300"
						}`}
					>
						{providerFeedback.text}
					</p>
				) : null}
			</details>

			<details className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
				<summary className="cursor-pointer text-sm font-semibold text-slate-100">
					Voice ({voiceProvider === "web_speech" ? "Web Speech" : "ElevenLabs"}{" "}
					· {voicePolicy})
				</summary>
				<p className="mt-2 text-[11px] text-slate-400">
					Set default text-to-speech behavior for chat playback.
				</p>
				<div className="mt-2 grid gap-2 sm:grid-cols-2">
					<label className="grid gap-1 text-xs text-slate-300">
						<span>Provider</span>
						<select
							className="rounded-lg border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:ring"
							value={voiceProvider}
							onChange={(event) =>
								setVoiceProvider(event.target.value as VoiceConfig["provider"])
							}
						>
							<option value="web_speech">Web Speech</option>
							<option value="elevenlabs">ElevenLabs</option>
						</select>
					</label>
					<label className="grid gap-1 text-xs text-slate-300">
						<span>Default Policy</span>
						<select
							className="rounded-lg border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:ring"
							value={voicePolicy}
							onChange={(event) =>
								setVoicePolicy(
									event.target.value as NonNullable<
										VoiceConfig["defaultPolicy"]
									>,
								)
							}
						>
							<option value="off">Off</option>
							<option value="manual">Manual</option>
							<option value="auto">Auto</option>
						</select>
					</label>
				</div>
				{voiceProvider === "web_speech" ? (
					<div className="mt-2 grid gap-2 sm:grid-cols-2">
						<Field
							label="Voice Name"
							value={voiceName}
							onChange={setVoiceName}
						/>
						<Field label="Language" value={voiceLang} onChange={setVoiceLang} />
						<Field label="Rate" value={voiceRate} onChange={setVoiceRate} />
						<Field label="Pitch" value={voicePitch} onChange={setVoicePitch} />
						<Field
							label="Volume"
							value={voiceVolume}
							onChange={setVoiceVolume}
						/>
					</div>
				) : null}
				{voiceProvider === "elevenlabs" ? (
					<div className="mt-2 grid gap-2 sm:grid-cols-2">
						<Field
							label="Voice ID"
							value={elevenVoiceId}
							onChange={setElevenVoiceId}
						/>
						<Field
							label="Model ID"
							value={elevenModelId}
							onChange={setElevenModelId}
						/>
						<Field
							label="Stability"
							value={elevenStability}
							onChange={setElevenStability}
						/>
						<Field
							label="Similarity Boost"
							value={elevenSimilarityBoost}
							onChange={setElevenSimilarityBoost}
						/>
						<Field
							label="Style"
							value={elevenStyle}
							onChange={setElevenStyle}
						/>
						<Field
							label="Speed"
							value={elevenSpeed}
							onChange={setElevenSpeed}
						/>
						<Field
							label="Output Format"
							value={elevenOutputFormat}
							onChange={setElevenOutputFormat}
						/>
						<Field
							label="Streaming Latency"
							value={elevenLatency}
							onChange={setElevenLatency}
						/>
						<label className="flex items-center gap-2 rounded-lg border border-white/20 bg-slate-950/40 px-3 py-2 text-xs text-slate-300">
							<input
								type="checkbox"
								checked={elevenSpeakerBoost === true}
								onChange={(event) =>
									setElevenSpeakerBoost(event.target.checked ? true : false)
								}
							/>
							<span>Use speaker boost</span>
						</label>
					</div>
				) : null}
				<button
					type="button"
					className="mt-3 rounded-full border border-white/20 px-4 py-2 text-sm"
					onClick={() => void handleSaveVoice()}
					disabled={savingVoice}
				>
					{savingVoice ? "Saving..." : "Save Voice Settings"}
				</button>
				{voiceFeedback ? (
					<p
						className={`mt-2 text-xs ${
							voiceFeedback.error ? "text-rose-300" : "text-emerald-300"
						}`}
					>
						{voiceFeedback.text}
					</p>
				) : null}
			</details>

			<details
				className="rounded-xl border border-white/10 bg-slate-950/40 p-3"
				open
			>
				<summary className="cursor-pointer text-sm font-semibold text-slate-100">
					Permissions (
					{notificationPermission
						? statusLabel(notificationPermission.status)
						: "Unknown"}
					)
				</summary>
				<p className="mt-2 text-[11px] text-slate-400">
					Use these shortcuts to jump directly to OS privacy settings.
				</p>
				<div className="mt-2 space-y-2">
					{runtimeState.permissions.items.map((entry) => (
						<div
							key={entry.id}
							className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1.5 text-xs"
						>
							<div className="min-w-0">
								<p>{entry.label}</p>
								<p className="mt-0.5 font-mono text-[10px] text-slate-300">
									{statusLabel(entry.status)}
								</p>
							</div>
							<div className="flex items-center gap-1.5">
								{entry.canOpenSettings ? (
									<button
										type="button"
										className="rounded-full border border-white/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-100 transition hover:border-cyan-300/50"
										onClick={() =>
											void runtimeActions.openPermissionSettings(entry.id)
										}
									>
										Open Settings
									</button>
								) : null}
								{entry.id === "notifications" ? (
									<button
										type="button"
										className="rounded-full border border-cyan-300/40 bg-cyan-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-cyan-100 transition hover:border-cyan-300/70"
										onClick={() => void handleSendTestNotification()}
										disabled={sendingNotification}
									>
										{sendingNotification ? "Testing..." : "Send Test"}
									</button>
								) : null}
								{!entry.canOpenSettings && entry.id !== "notifications" ? (
									<span className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
										No action
									</span>
								) : null}
							</div>
						</div>
					))}
				</div>
				{notificationFeedback ? (
					<p
						className={`mt-2 text-xs ${
							notificationFeedback.error ? "text-rose-300" : "text-emerald-300"
						}`}
					>
						{notificationFeedback.text}
					</p>
				) : null}
				<p className="mt-2 text-[11px] text-slate-400">
					{runtimeState.permissions.note}
				</p>
			</details>
		</section>
	);
}

type EventsScreenProps = {
	workspace: WorkspaceState;
};

function EventsScreen({ workspace }: EventsScreenProps) {
	return (
		<section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 backdrop-blur">
			<h2 className="text-lg font-semibold">Event Log</h2>
			<div className="mt-3 max-h-80 space-y-2 overflow-auto text-xs">
				{workspace.eventLog.length ? (
					workspace.eventLog.map((entry, index) => (
						<div
							key={`${entry}-${index}`}
							className="rounded-lg border border-white/10 bg-slate-950/50 px-2 py-1 text-slate-300"
						>
							{entry}
						</div>
					))
				) : (
					<div className="text-slate-400">No events yet.</div>
				)}
			</div>
		</section>
	);
}

function MainView({
	runtimeState,
	runtimeActions,
	workspace,
	workspaceActions,
	smsBridgeHealth,
	onRunSmsBridgeTest,
	voiceAutoEnabled,
	voicePlayback,
	onToggleVoiceAuto,
	onSpeakVoice,
	onStopVoice,
}: MainViewProps) {
	const resolvedUi = useMemo(
		() => resolveGatewayUiUrl(runtimeState.settings),
		[runtimeState.settings],
	);
	const location = useLocation();
	const navigate = useNavigate();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const lastFailureRedirectRef = useRef<string | null>(null);
	const utilityItems: DesktopUtilityItem[] = [
		{
			type: "route",
			path: "/settings",
			label: "Settings",
			icon: SettingsIcon,
		},
		{
			type: "route",
			path: "/agents",
			label: "Agents",
			icon: AgentsIcon,
		},
		{
			type: "route",
			path: "/runtime",
			label: "Runtime",
			icon: RuntimeIcon,
		},
		{
			type: "route",
			path: "/events",
			label: "Events",
			icon: EventsIcon,
		},
		{
			type: "link",
			href: "https://docs.getwingmanai.com",
			label: "Docs",
			icon: DocsIcon,
		},
	];
	const displayedThreadId = getDisplayedThreadId({
		pathname: location.pathname,
		search: location.search,
	});
	const displayedActiveThread = useMemo(
		() =>
			displayedThreadId
				? workspace.threads.find((thread) => thread.id === displayedThreadId)
				: undefined,
		[displayedThreadId, workspace.threads],
	);
	const routeThreadSelection = useMemo(
		() =>
			resolveRouteThreadSelection({
				pathname: location.pathname,
				search: location.search,
				activeThreadId: workspace.activeThreadId,
				threadIds: workspace.threads.map((thread) => thread.id),
				sessionsLoading: workspace.sessionsLoading,
			}),
		[
			location.pathname,
			location.search,
			workspace.activeThreadId,
			workspace.sessionsLoading,
			workspace.threads,
		],
	);
	const workspaceLoadingTasks = collectWorkspaceLoadingTasks({
		checkingConnection: workspace.checkingConnection,
		sessionsLoading: workspace.sessionsLoading,
		agentsLoading: workspace.agentsLoading,
		providersLoading: workspace.providersLoading,
		voiceConfigLoading: workspace.voiceConfigLoading,
	});
	const statusBadge = (
		<div className="space-y-2">
			<ConnectionBadge
				status={workspace.connectionStatus}
				detail={workspace.connectionMessage}
				runtimeDetail={runtimeState.statusMessage}
			/>
			{workspaceLoadingTasks.length > 0 ? (
				<div className="flex flex-wrap gap-1.5">
					{workspaceLoadingTasks.map((task) => (
						<span
							key={task}
							className="rounded-full border border-white/20 bg-slate-950/55 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-300"
						>
							{task}
						</span>
					))}
				</div>
			) : null}
		</div>
	);
	const handleCreateNewChat = useCallback(async () => {
		const created = await workspaceActions.createNewChat();
		if (created) {
			navigate(buildDesktopChatRoute(created.id));
		}
		return created;
	}, [navigate, workspaceActions]);
	const handleSelectThread = useCallback(
		(threadId: string) => {
			workspaceActions.selectThread(threadId);
			navigate(buildDesktopChatRoute(threadId));
		},
		[navigate, workspaceActions],
	);

	useEffect(() => {
		setMobileMenuOpen(false);
	}, [location.pathname]);

	useEffect(() => {
		if (!mobileMenuOpen) {
			document.body.style.overflow = "";
			return;
		}
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = "";
		};
	}, [mobileMenuOpen]);

	useEffect(() => {
		if (
			!shouldRouteToGatewayOnFailure(
				workspace.connectionStatus,
				workspace.connectionMessage,
			)
		) {
			return;
		}
		const failureKey = `${workspace.connectionStatus}:${workspace.connectionMessage}`;
		if (lastFailureRedirectRef.current === failureKey) return;
		lastFailureRedirectRef.current = failureKey;
		if (location.pathname !== "/settings") {
			navigate("/settings");
		}
	}, [
		location.pathname,
		navigate,
		workspace.connectionMessage,
		workspace.connectionStatus,
	]);

	useEffect(() => {
		if (routeThreadSelection === undefined) return;
		workspaceActions.selectThread(routeThreadSelection ?? "");
	}, [routeThreadSelection, workspaceActions]);

	useEffect(() => {
		if (location.pathname !== "/") return;
		if (location.search) return;
		if (!workspace.activeThreadId) return;
		navigate(buildDesktopChatRoute(workspace.activeThreadId), { replace: true });
	}, [location.pathname, location.search, navigate, workspace.activeThreadId]);

	return (
		<DesktopShell
			sidebar={
				<DesktopSidebar
					agents={workspace.agentCatalog}
					selectedAgentId={workspace.selectedAgentId}
					threads={workspace.threads}
					selectedThreadId={location.pathname === "/" ? displayedThreadId : null}
					sessionsLoading={workspace.sessionsLoading}
					utilityItems={utilityItems}
					onSelectAgent={workspaceActions.updateSelectedAgent}
					onSelectThread={handleSelectThread}
					onCreateThread={handleCreateNewChat}
					onRefreshThreads={workspaceActions.refreshSessionsData}
					onNavigate={() => setMobileMenuOpen(false)}
					statusBadge={statusBadge}
				/>
			}
			mobileMenuOpen={mobileMenuOpen}
			onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
			onCloseMobileMenu={() => setMobileMenuOpen(false)}
			statusBadge={statusBadge}
		>
			<Routes>
				<Route
					path="/"
					element={
						<ChatScreen
							workspace={workspace}
							activeThread={displayedActiveThread}
							workspaceActions={workspaceActions}
							runtimeState={runtimeState}
							runtimeActions={runtimeActions}
							voiceAutoEnabled={voiceAutoEnabled}
							voicePlayback={voicePlayback}
							onToggleVoiceAuto={onToggleVoiceAuto}
							onSpeakVoice={onSpeakVoice}
							onStopVoice={onStopVoice}
						/>
					}
				/>
				<Route
					path="/chat"
					element={
						<Navigate
							to={{ pathname: "/", search: location.search }}
							replace
						/>
					}
				/>
				<Route path="/gateway" element={<Navigate to="/settings" replace />} />
				<Route
					path="/settings"
					element={
						<GatewayScreen
							runtimeState={runtimeState}
							runtimeActions={runtimeActions}
							workspace={workspace}
							workspaceActions={workspaceActions}
							resolvedUi={resolvedUi}
						/>
					}
				/>
				<Route
					path="/agents"
					element={
						<AgentsScreen
							workspace={workspace}
							workspaceActions={workspaceActions}
						/>
					}
				/>
				<Route
					path="/runtime"
					element={
						<RuntimeScreen
							runtimeState={runtimeState}
							runtimeActions={runtimeActions}
							workspace={workspace}
							workspaceActions={workspaceActions}
							smsBridgeHealth={smsBridgeHealth}
							onRunSmsBridgeTest={onRunSmsBridgeTest}
						/>
					}
				/>
				<Route path="/events" element={<EventsScreen workspace={workspace} />} />
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</DesktopShell>
	);
}
type MessageCardProps = {
	message: RenderableChatMessage;
	isStreaming: boolean;
	activeAssistantMessageId?: string;
	voicePlayback: { status: VoicePlaybackStatus; messageId?: string };
	onSpeak: (messageId: string, text: string) => void;
	onStop: () => void;
};

function MessageCard({
	message,
	isStreaming,
	activeAssistantMessageId,
	voicePlayback,
	onSpeak,
	onStop,
}: MessageCardProps) {
	const isUser = message.role === "user";
	const displayText = message.content || message.uiTextFallback || "";
	const canSpeak = !isUser && !!displayText.trim();
	const isVoiceTarget = voicePlayback.messageId === message.id;
	const isVoiceBusy = voicePlayback.status !== "idle";
	const voiceLabel =
		isVoiceTarget && isVoiceBusy
			? getVoicePlaybackLabel(voicePlayback.status)
			: "Play";
	const showTypingIndicator = shouldShowAssistantTypingIndicator({
		message,
		isStreaming,
		activeAssistantMessageId,
	});
	const activityItems = useMemo(() => {
		if (message.activityTimeline?.length) {
			return groupTimelineBlocksForDisplay({
				blocks: message.activityTimeline,
				toolEventsById: new Map(
					(message.toolEvents || []).map((event) => [event.id, event]),
				),
			});
		}

		const nextItems: Array<
			| { id: string; kind: "text"; text: string }
			| { id: string; kind: "tool-rollup"; toolEvents: ToolEvent[] }
		> = [];
		if (displayText) {
			nextItems.push({
				id: `${message.id}-text`,
				kind: "text",
				text: displayText,
			});
		}
		if (message.toolEvents?.length) {
			nextItems.push(
				...groupToolEventsForDisplay({
					toolEvents: message.toolEvents,
				}),
			);
		}
		return nextItems;
	}, [
		displayText,
		message.activityTimeline,
		message.id,
		message.toolEvents,
	]);

	return (
		<div
			className={`rounded-2xl border p-3 ${
				isUser
					? "border-cyan-400/35 bg-cyan-500/10"
					: "border-white/10 bg-slate-950/60"
			}`}
		>
			<div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-400">
				<span>{message.role}</span>
				<div className="flex items-center gap-2">
					{canSpeak ? (
						<button
							type="button"
							className={`rounded-full border px-2.5 py-1 text-[10px] tracking-[0.12em] ${
								isVoiceTarget && isVoiceBusy
									? "border-cyan-300/50 bg-cyan-500/15 text-cyan-100"
									: "border-white/20 text-slate-200"
							}`}
							onClick={() => {
								if (isVoiceTarget && isVoiceBusy) {
									onStop();
									return;
								}
								onSpeak(message.id, displayText);
							}}
						>
							{voiceLabel}
						</button>
					) : null}
					<span>{new Date(message.createdAt).toLocaleTimeString()}</span>
				</div>
			</div>
			{showTypingIndicator ? (
				<div
					data-testid="message-streaming-indicator"
					className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-400"
				>
					<span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
					<span className="h-2 w-2 animate-pulse rounded-full bg-sky-400 [animation-delay:150ms]" />
					<span className="h-2 w-2 animate-pulse rounded-full bg-sky-400 [animation-delay:300ms]" />
				</div>
			) : activityItems.length > 0 ? (
				<div className="space-y-3">
					{activityItems.map((item) =>
						item.kind === "text" ? (
							<div
								key={item.id}
								className="whitespace-pre-wrap text-sm text-slate-100"
							>
								{item.text}
							</div>
						) : (
							<ToolActivityRollup
								key={item.id}
								toolEvents={item.toolEvents}
							/>
						),
					)}
				</div>
			) : null}

			{message.attachments?.length ? (
				<div className="mt-3 grid gap-2 sm:grid-cols-2">
					{message.attachments.map((attachment) => {
						const isFile = isFileAttachment(attachment);
						const isAudio = isAudioAttachment(attachment);
						const isVideo = isVideoAttachment(attachment);
						const meta = formatAttachmentMeta(attachment);
						return (
							<div
								key={attachment.id}
								className="rounded-lg border border-white/10 bg-slate-900/70 p-2 text-xs"
							>
								<p className="truncate font-semibold text-slate-200">
									{attachment.name ||
										(isAudio
											? "Audio attachment"
											: isVideo
												? "Video attachment"
											: isFile
												? "File attachment"
												: "Image attachment")}
								</p>
								{meta ? (
									<p className="mt-0.5 text-[11px] text-slate-400">{meta}</p>
								) : null}
								{!isFile && !isAudio && !isVideo && attachment.dataUrl ? (
									<img
										src={attachment.dataUrl}
										alt={attachment.name || "Image attachment"}
										className="mt-2 max-h-40 w-full rounded-md object-cover"
									/>
								) : null}
								{isAudio && attachment.dataUrl ? (
									<audio
										className="mt-2 w-full"
										controls
										src={attachment.dataUrl}
									>
										<track kind="captions" />
									</audio>
								) : null}
								{isVideo && attachment.dataUrl ? (
									/* biome-ignore lint/a11y/useMediaCaption: generated browser videos do not provide caption tracks */
									<video
										className="mt-2 max-h-64 w-full rounded-md bg-slate-950"
										controls
										preload="metadata"
										src={attachment.dataUrl}
									/>
								) : null}
								{isFile &&
								!isPdfAttachment(attachment) &&
								attachment.textContent ? (
									<p className="mt-2 whitespace-pre-wrap rounded-md border border-white/10 bg-slate-950/60 p-2 text-[11px] text-slate-300">
										{clipFilePreview(attachment.textContent)}
									</p>
								) : null}
							</div>
						);
					})}
				</div>
			) : null}

			{message.thinkingEvents?.length ? (
				<div className="mt-3 rounded-lg border border-white/10 bg-slate-900/70 px-2 py-2 text-xs text-slate-300">
					<p className="mb-1 uppercase tracking-[0.15em] text-slate-400">
						Thinking
					</p>
					{message.thinkingEvents.map((event) => (
						<p key={event.id} className="whitespace-pre-wrap">
							{event.content}
						</p>
					))}
				</div>
			) : null}

			{message.uiBlocks?.length ? (
				<div className="mt-3 rounded-lg border border-white/10 bg-slate-900/70 p-2">
					{message.uiBlocks.map((block) => (
						<div key={block.id} className="mb-2 last:mb-0">
							<SguiRenderer ui={block.spec} />
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}

type OverlayProps = {
	state: RuntimeState;
	actions: ReturnType<typeof useRuntimeController>["actions"];
	canUseWebSpeechRecognition: boolean;
};

function OverlayView({
	state,
	actions,
	canUseWebSpeechRecognition,
}: OverlayProps) {
	const hasTranscript = state.transcript.trim().length > 0;
	const overlayStatusMessage = state.statusIsError
		? state.statusMessage
		: state.recording
			? "Listening for voice input."
			: hasTranscript
				? "Review and edit transcript, then send to chat."
				: "Press Start to begin.";

	if (!state.overlayVisible) {
		return (
			<div className="fixed inset-0 flex items-center justify-center p-5 text-slate-100">
				<div className="absolute inset-0 bg-black/55" />
				<div className="relative z-10 w-full max-w-2xl rounded-3xl border border-white/20 bg-slate-900/85 p-6 backdrop-blur">
					<div className="mb-3 flex items-center justify-between">
						<DesktopBrandBadge />
						<span className="rounded-full border border-white/25 px-3 py-1 text-xs">
							Idle
						</span>
					</div>
					<h2 className="text-3xl font-semibold">Overlay Ready</h2>
					<p className="mt-2 text-sm text-slate-300">
						Use tray action <span className="font-mono">Start Recording</span>{" "}
						to show active capture.
					</p>
					<div className="mt-4">
						<button
							className="rounded-full border border-white/25 px-4 py-2 text-sm"
							onClick={() => void actions.hideOverlay()}
							type="button"
						>
							Close
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="fixed inset-0 flex items-center justify-center p-5 text-slate-100">
			<div className="absolute inset-0 bg-black/55" />
			<div className="relative z-10 w-full max-w-4xl rounded-3xl border border-white/20 bg-slate-900/85 p-6 backdrop-blur">
				<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
					<DesktopBrandBadge />
					<span
						className={`rounded-full border px-3 py-1 text-xs ${state.recording ? "border-emerald-400/50 text-emerald-300" : "border-white/25 text-slate-200"}`}
					>
						{state.recording ? "Listening" : "Idle"}
					</span>
				</div>

				<h2 className="text-3xl font-semibold">
					{state.recording ? "Listening..." : "Review transcript"}
				</h2>
				<p className="mt-2 text-sm text-slate-300">{overlayStatusMessage}</p>
				<p className="mt-1 text-sm text-slate-300">
					Recognizer: {state.recognitionMessage}
				</p>
				{state.recording && !state.recognitionActive ? (
					<p className="mt-1 text-xs text-slate-300">
						{canUseWebSpeechRecognition
							? "Click Enable Mic once to grant speech capture for this overlay."
							: "Native macOS speech adapter is active."}
					</p>
				) : null}

				<textarea
					className="mt-4 min-h-56 w-full resize-y rounded-2xl border border-white/20 bg-slate-950/60 p-4 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:ring"
					placeholder="Transcript will appear here..."
					value={state.transcript}
					onChange={(event) =>
						void actions.updateTranscript(event.target.value)
					}
				/>

				<div className="mt-4 flex flex-wrap gap-2">
					<button
						className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
						onClick={() => {
							if (
								state.recording &&
								!state.recognitionActive &&
								canUseWebSpeechRecognition
							) {
								void actions.startRecognition();
								return;
							}
							void actions.toggleRecording();
						}}
						type="button"
					>
						{state.recording
							? state.recognitionActive
								? "Stop & Review"
								: canUseWebSpeechRecognition
									? "Enable Mic"
									: "Stop"
							: hasTranscript
								? "Resume"
								: "Start"}
					</button>
					<button
						className="rounded-full border border-cyan-300/50 bg-cyan-500/15 px-4 py-2 text-sm text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
						onClick={() => {
							void (async () => {
								const queued = await actions.queueQuickSend();
								if (!queued) return;
								await actions.hideOverlay();
							})();
						}}
						type="button"
						disabled={state.recording || !hasTranscript}
					>
						Send To Chat
					</button>
					<button
						className="rounded-full border border-white/25 px-4 py-2 text-sm"
						onClick={() => void actions.clearTranscript()}
						type="button"
						disabled={state.recording || !hasTranscript}
					>
						Clear
					</button>
					<button
						className="rounded-full border border-white/25 px-4 py-2 text-sm"
						onClick={() => void actions.hideOverlay()}
						type="button"
					>
						Close
					</button>
				</div>
				<p className="mt-3 text-[11px] text-slate-400">
					Send To Chat targets the active session in the main desktop window. If
					no session is active, a new one is created for the selected agent.
				</p>
			</div>
			{shouldShowTranscriptionFire(state.recording) ? (
				<div className="fire-effect">
					<div className="fire-layer fire-layer-a" />
					<div className="fire-layer fire-layer-b" />
					<div className="fire-layer fire-layer-c" />
				</div>
			) : null}
		</div>
	);
}

type FieldProps = {
	label: string;
	value: string;
	onChange: (value: string) => void;
};

function Field({ label, value, onChange }: FieldProps) {
	return (
		<label className="grid gap-1 text-xs text-slate-300">
			<span>{label}</span>
			<input
				className="rounded-lg border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:ring"
				value={value}
				onChange={(event) => onChange(event.target.value)}
			/>
		</label>
	);
}

type ConnectionBadgeProps = {
	status: ConnectionStatus;
	detail: string;
	runtimeDetail?: string;
};

function ConnectionBadge({
	status,
	detail,
	runtimeDetail,
}: ConnectionBadgeProps) {
	const palette =
		status === "connected"
			? {
					border: "border-emerald-400/35",
					bg: "bg-emerald-500/12",
					text: "text-emerald-200",
					dot: "bg-emerald-300",
					label: "Connected",
				}
			: status === "connecting"
				? {
						border: "border-amber-400/35",
						bg: "bg-amber-500/12",
						text: "text-amber-200",
						dot: "bg-amber-300",
						label: "Connecting",
					}
				: {
						border: "border-rose-300/45",
						bg: "bg-rose-400/12",
						text: "text-rose-200",
						dot: "bg-rose-300",
						label: "Disconnected",
					};
	return (
		<div
			className={`min-w-44 rounded-2xl border px-3 py-2 ${palette.border} ${palette.bg} ${palette.text}`}
			title={runtimeDetail || detail}
		>
			<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
				<span className={`h-2.5 w-2.5 rounded-full ${palette.dot}`} />
				<span>{palette.label}</span>
			</div>
			<p className="mt-1 text-[11px] opacity-90">{detail}</p>
		</div>
	);
}
