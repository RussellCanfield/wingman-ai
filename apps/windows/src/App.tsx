import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
	checkGatewayConnection,
	createAgent,
	createSession,
	deleteSession,
	fetchAgentDetail,
	fetchAgents,
	fetchSessionMessages,
	fetchSessions,
	mapSessionToThread,
	renameSession,
	updateAgent,
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
	ChatMessage,
	ConnectionStatus,
	GatewayConfig,
	GatewayHealth,
	GatewayStats,
	PromptTrainingConfig,
	SessionThread,
	ThinkingEvent,
	ToolEvent,
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
import { parseStreamEvents } from "./lib/streaming.js";
import { buildSyncSignature } from "./lib/syncSignature.js";
import { isTauriRuntime, invokeTauri } from "./lib/tauriBridge.js";
import { mergeGatewaySettingsFromNative } from "./lib/runtimeSettings.js";
import { summarizeGatewayConnectionFailure } from "./lib/connectionStatus.js";
import { shouldRouteToGatewayOnFailure } from "./lib/connectionRouting.js";
import { shouldShowThreadRail } from "./lib/chatLayout.js";
import { findThreadNeedingHydration } from "./lib/threadHydration.js";
import { resolveTalkStopTranscript } from "./lib/talkToChat.js";
import { buildAgentCompletionNotice } from "./lib/notifications.js";
import {
	loadDesktopPreferences,
	saveDesktopPreferences,
} from "./lib/desktopPrefs.js";
import { SguiRenderer } from "./sgui/SguiRenderer.js";
import {
	buildSubAgentCandidates,
	buildSubAgentPayloads,
	mapAgentDetailToDraftSeed,
	parseToolsCsv,
} from "./lib/agentsForm.js";

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

type WorkspaceState = {
	connectionStatus: ConnectionStatus;
	connectionMessage: string;
	checkingConnection: boolean;
	gatewayConfig?: GatewayConfig;
	gatewayHealth?: GatewayHealth;
	gatewayStats?: GatewayStats;
	agentCatalog: AgentSummary[];
	agentDetail?: AgentDetail;
	availableTools: string[];
	agentsLoading: boolean;
	threads: SessionThread[];
	sessionsLoading: boolean;
	activeThreadId: string;
	selectedAgentId: string;
	prompt: string;
	isStreaming: boolean;
	eventLog: string[];
	createAgentDraft: CreateAgentDraft;
	creatingAgent: boolean;
	agentFormMode: "create" | "edit";
	editTargetAgentId: string;
	agentDetailsById: Record<string, AgentDetail>;
	lastCompletion?: {
		nonce: number;
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

function mergeNativeState(prev: RuntimeState, next: NativeState | undefined): RuntimeState {
	if (!next) return prev;

	let changed = false;
	const merged: RuntimeState = { ...prev };

	if (typeof next.connected === "boolean" && next.connected !== prev.connected) {
		merged.connected = next.connected;
		changed = true;
	}
	if (typeof next.recording === "boolean" && next.recording !== prev.recording) {
		merged.recording = next.recording;
		changed = true;
	}
	if (typeof next.overlayVisible === "boolean" && next.overlayVisible !== prev.overlayVisible) {
		merged.overlayVisible = next.overlayVisible;
		changed = true;
	}
	if (typeof next.transcript === "string" && next.transcript !== prev.transcript) {
		merged.transcript = next.transcript;
		changed = true;
	}
	if (typeof next.speechStatus === "string" && next.speechStatus !== prev.recognitionMessage) {
		merged.recognitionMessage = next.speechStatus;
		changed = true;
	}
	if (typeof next.recordHotkey === "string" && next.recordHotkey !== prev.recordHotkey) {
		merged.recordHotkey = next.recordHotkey;
		changed = true;
	}
	if (typeof next.overlayHotkey === "string" && next.overlayHotkey !== prev.overlayHotkey) {
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
	if (typeof next.quickSendNonce === "number" && next.quickSendNonce !== prev.quickSendNonce) {
		merged.quickSendNonce = next.quickSendNonce;
		changed = true;
	}
	if (next.gateway) {
		const settings = mergeGatewaySettingsFromNative(prev.settings, next.gateway);
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

function mergeToolEvents(existing: ToolEvent[] | undefined, next: ToolEvent[]): ToolEvent[] {
	const byId = new Map<string, ToolEvent>();
	for (const item of existing || []) {
		byId.set(item.id, item);
	}
	for (const item of next) {
		const current = byId.get(item.id);
		byId.set(item.id, current ? { ...current, ...item } : item);
	}
	return [...byId.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function deriveUiBlocks(toolEvents: ToolEvent[] | undefined): ChatMessage["uiBlocks"] {
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
			};
		});

	const stateRef = useRef(state);
	const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
	const speechUnavailableNotifiedRef = useRef(false);
	const lastSyncSignatureRef = useRef("");

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
		if (!isOverlayView || !current.recording || current.recognitionActive) return;

		if (!canUseWebSpeechRecognition(current)) {
			setRecognitionMessage("Using native speech adapter.");
			setStatus("Listening...", false);
			return;
		}

		const recognition = ensureRecognizer();
		if (!recognition) {
			if (!speechUnavailableNotifiedRef.current) {
				speechUnavailableNotifiedRef.current = true;
				setRecognitionMessage("SpeechRecognition API unavailable in this webview.");
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
			setRecognitionMessage("Recognizer start blocked. Click Start in overlay to grant access.");
		}
	}, [ensureRecognizer, isOverlayView, setRecognitionMessage, setStatus]);

	const syncRecognitionLifecycle = useCallback(() => {
		if (!stateRef.current.recording) {
			stopRecognition();
		}
	}, [stopRecognition]);

	const refreshNativeContext = useCallback(async () => {
		if (!stateRef.current.nativeRuntime) return;

		const profilePayload = await invokeTauri<Partial<PlatformProfile>>("get_platform_profile");
		const permissionsPayload = await invokeTauri<Partial<PermissionSnapshot>>(
			"get_permission_snapshot",
		);
		const nativeState = await invokeTauri<NativeState>("get_state");

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

	const toggleRecording = useCallback(async (): Promise<ToggleRecordingResult> => {
		const currentState = stateRef.current;
		const wasRecording = currentState.recording;
		const transcriptBeforeToggle = currentState.transcript;

		if (stateRef.current.nativeRuntime) {
			const next = await invokeTauri<NativeState>("toggle_recording_with_window");
			applyNativeState(next);
			setStatus(stateRef.current.recording ? "Listening..." : "Recording stopped.");
			if (!stateRef.current.recording) {
				syncRecognitionLifecycle();
			}
			return {
				wasRecording,
				isRecording: typeof next?.recording === "boolean" ? next.recording : !wasRecording,
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
	}, [applyNativeState, setStatus, startRecognition, syncRecognitionLifecycle]);

	const toggleOverlay = useCallback(async () => {
		if (stateRef.current.nativeRuntime) {
			const next = await invokeTauri<NativeState>("toggle_overlay");
			applyNativeState(next);
			setStatus(stateRef.current.overlayVisible ? "Overlay shown." : "Overlay hidden.");
			return;
		}

		setState((prev) => ({
			...prev,
			overlayVisible: !prev.overlayVisible,
			statusMessage: !prev.overlayVisible ? "Overlay shown." : "Overlay hidden.",
			statusIsError: false,
		}));
	}, [applyNativeState, setStatus]);

	const updateSetting = useCallback((key: keyof GatewaySettings, value: string) => {
		setState((prev) => {
			const settings = normalizeGatewaySettings({ ...prev.settings, [key]: value });
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
	}, []);

	const updateAutoConnectOnLaunch = useCallback((enabled: boolean) => {
		setState((prev) => {
			const next = { ...prev, autoConnectOnLaunch: enabled };
			saveDesktopPreferences({
				autoConnectOnLaunch: next.autoConnectOnLaunch,
				notifyOnAgentFinish: next.notifyOnAgentFinish,
			});
			return next;
		});
	}, []);

	const updateNotifyOnAgentFinish = useCallback((enabled: boolean) => {
		setState((prev) => {
			const next = { ...prev, notifyOnAgentFinish: enabled };
			saveDesktopPreferences({
				autoConnectOnLaunch: next.autoConnectOnLaunch,
				notifyOnAgentFinish: next.notifyOnAgentFinish,
			});
			return next;
		});
	}, []);

	const updateTranscript = useCallback(
		async (transcript: string) => {
			setState((prev) => ({ ...prev, transcript }));
			if (stateRef.current.nativeRuntime) {
				const next = await invokeTauri<NativeState>("set_transcript", { transcript });
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
			setStatus("Quick-send queue is only available in the native runtime.", true);
			return false;
		}
		try {
			const next = await invokeTauri<NativeState>("queue_quick_send");
			applyNativeState(next);
			setStatus("Queued transcript for chat send.");
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
				setStatus("Desktop notifications require the native Tauri runtime.", true);
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

		const tick = async () => {
			try {
				await refreshNativeContext();
				syncRecognitionLifecycle();
			} catch (error) {
				setStatus(`Runtime sync failed: ${String(error)}`, true);
			}
		};

		void tick();
		const timer = window.setInterval(() => {
			void tick();
		}, 350);
		return () => {
			window.clearInterval(timer);
		};
	}, [refreshNativeContext, setStatus, state.nativeRuntime, syncRecognitionLifecycle]);

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
	setGlobalStatus: (message: string, isError?: boolean) => void,
) {
	const [workspace, setWorkspace] = useState<WorkspaceState>({
		connectionStatus: "disconnected",
		connectionMessage: "Not connected to gateway",
		checkingConnection: false,
		agentCatalog: [],
		agentDetail: undefined,
		availableTools: [],
		agentsLoading: false,
		threads: [],
		sessionsLoading: false,
		activeThreadId: "",
		selectedAgentId: settings.agentId || "main",
		prompt: "",
		isStreaming: false,
		eventLog: [],
		createAgentDraft: createEmptyAgentDraft(),
		creatingAgent: false,
		agentFormMode: "create",
		editTargetAgentId: settings.agentId || "main",
		agentDetailsById: {},
	});

	const activeThread = useMemo(
		() => workspace.threads.find((thread) => thread.id === workspace.activeThreadId),
		[workspace.activeThreadId, workspace.threads],
	);

	const socketRef = useRef<GatewaySocketClient | null>(null);
	const requestThreadRef = useRef<Map<string, string>>(new Map());
	const requestMessageRef = useRef<Map<string, string>>(new Map());
	const completionNonceRef = useRef(0);
	const subscribedRef = useRef<Set<string>>(new Set());
	const loadingMessagesRef = useRef<Set<string>>(new Set());
	const deviceIdRef = useRef<string>(getDeviceId());
	const agentDetailsRef = useRef<Record<string, AgentDetail>>({});

	const logEvent = useCallback((message: string) => {
		setWorkspace((prev) => ({
			...prev,
			eventLog: [message, ...prev.eventLog].slice(0, 30),
		}));
	}, []);

	useEffect(() => {
		agentDetailsRef.current = workspace.agentDetailsById;
	}, [workspace.agentDetailsById]);

	const refreshSessionsData = useCallback(async () => {
		setWorkspace((prev) => ({ ...prev, sessionsLoading: true }));
		try {
			const sessions = await fetchSessions(settings, { limit: 200 });
			setWorkspace((prev) => {
				const mapped = sessions.map((session) => mapSessionToThread(session));
				const next = mapped.map((thread) => {
					const existing = prev.threads.find((item) => item.id === thread.id);
					if (!existing?.messagesLoaded) return thread;
					return {
						...thread,
						messages: existing.messages,
						messagesLoaded: true,
					};
				});
				const activeThreadId = next.find((item) => item.id === prev.activeThreadId)
					? prev.activeThreadId
					: next[0]?.id || "";
				return {
					...prev,
					threads: next,
					activeThreadId,
				};
			});
		} catch (error) {
			logEvent(`Failed to load sessions: ${String(error)}`);
		} finally {
			setWorkspace((prev) => ({ ...prev, sessionsLoading: false }));
		}
	}, [logEvent, settings]);

	const refreshAgentsData = useCallback(async () => {
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
					agents.agents.find((agent) => agent.id === prev.editTargetAgentId)?.id ||
					selectedAgentId;
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
		}
	}, [logEvent, settings, settings.agentId]);

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
			const threadId = requestThreadRef.current.get(requestId);
			const messageId = requestMessageRef.current.get(requestId) || requestId;
			if (!threadId) return;

			const parsed = parseStreamEvents(payload);
			const data = payload as { type?: string; error?: string; content?: string; node?: string };
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
					return updateAssistantMessage(thread, messageId, (message) => {
						let content = message.content;
						for (const textEvent of parsed.textEvents) {
							if (textEvent.isDelta) {
								content += textEvent.text;
							} else if (!content.trim()) {
								content = textEvent.text;
							} else {
								content += `\n${textEvent.text}`;
							}
						}

						const toolEvents = mergeToolEvents(message.toolEvents, parsed.toolEvents as ToolEvent[]);
						const uiBlocks = deriveUiBlocks(toolEvents);
						const thinkingEvents = thinkingEvent
							? [...(message.thinkingEvents || []), thinkingEvent]
							: message.thinkingEvents;

						return {
							...message,
							content,
							toolEvents,
							uiBlocks,
							thinkingEvents,
						};
					});
				}),
			}));

			if (data.type === "agent-error") {
				setWorkspace((prev) => ({ ...prev, isStreaming: false }));
				logEvent(`Agent error: ${data.error || "unknown error"}`);
				requestThreadRef.current.delete(requestId);
				requestMessageRef.current.delete(requestId);
				return;
			}

			if (data.type === "agent-complete") {
				setWorkspace((prev) => {
					const sourceThread = prev.threads.find((thread) => thread.id === threadId);
					const previewMessage =
						sourceThread?.messages.find((message) => message.id === messageId)?.content ||
						sourceThread?.messages
							.filter((message) => message.role === "assistant")
							.at(-1)?.content ||
						"";
					const nextNonce = completionNonceRef.current + 1;
					completionNonceRef.current = nextNonce;
					return {
						...prev,
						isStreaming: false,
						lastCompletion: {
							nonce: nextNonce,
							threadName: sourceThread?.name || "Current chat",
							agentId: sourceThread?.agentId || "agent",
							preview: previewMessage,
						},
					};
				});
				requestThreadRef.current.delete(requestId);
				requestMessageRef.current.delete(requestId);
				void refreshSessionsData();
			}
		},
		[logEvent, refreshSessionsData],
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
		if (check.config?.requireAuth && !settings.token.trim() && !settings.password.trim()) {
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
				setWorkspace((prev) => ({
					...prev,
					connectionStatus: connected ? "connected" : "disconnected",
					connectionMessage: message,
					isStreaming: connected ? prev.isStreaming : false,
				}));
				setGlobalStatus(message, !connected && message.toLowerCase().includes("failed"));
				if (connected) {
					void refreshSessionsData();
					void refreshAgentsData();
				}
			},
			onAgentEvent: applyAgentEvent,
			onError: (message) => {
				logEvent(message);
			},
		});
		const socketSettings =
			check.config?.gatewayHost && check.config?.gatewayPort
				? (() => {
					try {
						const parsed = new URL(settings.url);
						const isSecure = parsed.protocol === "wss:" || parsed.protocol === "https:";
						const defaultPort = isSecure ? "443" : "80";
						const currentPort = parsed.port || defaultPort;
						const nextPort = String(check.config?.gatewayPort);
						const nextHost = check.config?.gatewayHost;
						const normalizedNextHost =
							nextHost === "0.0.0.0" || nextHost === "::" ? parsed.hostname : nextHost;
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
		logEvent,
		refreshAgentsData,
		refreshSessionsData,
		setGlobalStatus,
		settings,
	]);

	const disconnectGateway = useCallback(() => {
		socketRef.current?.disconnect();
		setWorkspace((prev) => ({
			...prev,
			connectionStatus: "disconnected",
			connectionMessage: "Disconnected",
			isStreaming: false,
		}));
		setGlobalStatus("Disconnected from gateway.");
	}, [setGlobalStatus]);

	const testConnection = useCallback(async () => {
		setWorkspace((prev) => ({ ...prev, checkingConnection: true }));
		const check = await checkGatewayConnection(settings);
		const detail = check.ok ? "Gateway test succeeded" : check.error || check.status;
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
			loadingMessagesRef.current.add(thread.id);
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
					prev.activeThreadId === thread.id ? next[0]?.id || "" : prev.activeThreadId;
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

	const sendPrompt = useCallback(async (promptOverride?: string): Promise<boolean> => {
		const userText = (promptOverride ?? workspace.prompt).trim();
		if (!userText) return false;
		if (workspace.connectionStatus !== "connected") {
			setGlobalStatus("Connect to gateway first.", true);
			return false;
		}
		if (workspace.isStreaming) {
			setGlobalStatus("Wait for current response to finish.", true);
			return false;
		}

		let target = activeThread;
		if (!target) {
			target = await createNewChat();
			if (!target) return false;
		}

		const now = Date.now();
		const assistantId = `assistant-${now}-${Math.random().toString(36).slice(2, 8)}`;

		setWorkspace((prev) => ({
			...prev,
			prompt: promptOverride === undefined ? "" : prev.prompt,
			isStreaming: true,
			threads: prev.threads.map((thread) =>
				thread.id === target!.id
					? {
						...thread,
						name:
							thread.name === DEFAULT_THREAD_NAME
								? mapSessionName(userText, thread.name)
								: thread.name,
						messagesLoaded: true,
						messages: [
							...thread.messages,
							{
								id: `user-${now}`,
								role: "user",
								content: userText,
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
						lastMessagePreview: userText.slice(0, 200),
						messageCount: (thread.messageCount ?? thread.messages.length) + 1,
					}
					: thread,
			),
		}));

		try {
			const payload: AgentRequestPayload = {
				agentId: target.agentId,
				content: userText,
				sessionKey: target.id,
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
			return true;
		} catch (error) {
			setWorkspace((prev) => ({ ...prev, isStreaming: false }));
			setGlobalStatus(`Failed to send prompt: ${String(error)}`, true);
			return false;
		}
	}, [
		activeThread,
		createNewChat,
		setGlobalStatus,
		workspace.connectionStatus,
		workspace.isStreaming,
		workspace.prompt,
	]);

	const updatePrompt = useCallback((value: string) => {
		setWorkspace((prev) => ({ ...prev, prompt: value }));
	}, []);

	const sendPromptText = useCallback(
		async (value: string) => {
			return sendPrompt(value);
		},
		[sendPrompt],
	);

	const updateSelectedAgent = useCallback((value: string) => {
		setWorkspace((prev) => ({ ...prev, selectedAgentId: value }));
		void loadAgentDetailData(value);
	}, [loadAgentDetailData]);

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
					prev.editTargetAgentId || prev.selectedAgentId || prev.agentCatalog[0]?.id || "";
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
					void loadAgentDetailData(targetId, { hydrateDraft: true, setAgentDetail: true });
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
			void loadAgentDetailData(agentId, { hydrateDraft: true, setAgentDetail: true });
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
		const targetAgentId = mode === "edit" ? workspace.editTargetAgentId : draft.id.trim();
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
			const missingIds = selectedSubAgentIds.filter((id) => !agentDetailsRef.current[id]);
			if (missingIds.length > 0) {
				const fetched = await Promise.all(
					missingIds.map((id) => loadAgentDetailData(id, { setAgentDetail: false })),
				);
				const unresolved = missingIds.filter((id, index) => !fetched[index]);
				if (unresolved.length > 0) {
					throw new Error(`Unable to load selected sub-agent details: ${unresolved.join(", ")}`);
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
				await loadAgentDetailData(targetAgentId, { hydrateDraft: true, setAgentDetail: true });
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
		void refreshAgentsData();
		void refreshSessionsData();
	}, [refreshAgentsData, refreshSessionsData]);

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
			testConnection,
			refreshAgentsData,
			refreshSessionsData,
			loadThreadMessages,
			selectThread,
			updateSelectedAgent,
			createNewChat,
			removeThread,
			renameThreadByPrompt,
			sendPrompt,
			sendPromptText,
			updatePrompt,
			updateCreateAgentDraft,
			toggleCreateAgentSubAgent,
			setAgentFormMode,
			setEditTargetAgentId,
			submitAgentForm,
			loadAgentDetailData,
		},
	};
}

type AppProps = {
	overlayMode: boolean;
};

export function App({ overlayMode }: AppProps) {
	const runtime = useRuntimeController(overlayMode);
	const gateway = useGatewayWorkspace(runtime.state.settings, runtime.setStatus);
	const handledQuickSendNonceRef = useRef(0);
	const handledCompletionNonceRef = useRef(0);
	const autoConnectAttemptedRef = useRef(false);

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
			if (!window.location.hash.startsWith("#/chat")) {
				window.location.hash = "#/chat";
			}
			const sent = await gateway.actions.sendPromptText(transcript);
			if (sent) {
				await runtime.actions.clearTranscript();
			}
			await runtime.actions.clearQuickSend();
		})();
	}, [
		gateway.actions,
		gateway.workspace.connectionStatus,
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
			activeThread={gateway.activeThread}
			workspaceActions={gateway.actions}
		/>
	);
}

type MainViewProps = {
	runtimeState: RuntimeState;
	runtimeActions: ReturnType<typeof useRuntimeController>["actions"];
	workspace: WorkspaceState;
	activeThread?: SessionThread;
	workspaceActions: ReturnType<typeof useGatewayWorkspace>["actions"];
};

type MainNavItem = {
	path: "/gateway" | "/chat" | "/agents" | "/runtime" | "/events";
	label: string;
	description: string;
};

type WorkspaceActions = ReturnType<typeof useGatewayWorkspace>["actions"];
type RuntimeActions = ReturnType<typeof useRuntimeController>["actions"];

type SidebarNavProps = {
	items: MainNavItem[];
	onNavigate?: () => void;
};

function MainSidebarNav({ items, onNavigate }: SidebarNavProps) {
	return (
		<nav className="mt-3 space-y-2">
			{items.map((item) => (
				<NavLink
					key={item.path}
					to={item.path}
					onClick={onNavigate}
					className={({ isActive }) =>
						`block w-full rounded-xl border px-3 py-2 text-left transition ${
							isActive
								? "border-cyan-400/60 bg-cyan-500/15"
								: "border-white/10 bg-slate-950/50 hover:border-cyan-400/40"
						}`
					}
				>
					<p className="text-sm font-semibold">{item.label}</p>
					<p className="mt-1 text-[11px] text-slate-300">{item.description}</p>
				</NavLink>
			))}
		</nav>
	);
}

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
			<h2 className="text-lg font-semibold">Gateway</h2>
			<p className="mt-1 text-xs text-slate-300">
				{workspace.connectionStatus === "connected"
					? "Connected"
					: workspace.connectionStatus === "connecting"
						? "Connecting"
						: "Disconnected"}
				{" · "}
				{workspace.connectionMessage}
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
					{workspace.connectionStatus === "connected" ? "Disconnect" : "Connect"}
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

			<details className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 p-3" open>
				<summary className="cursor-pointer text-sm font-semibold">Settings</summary>
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
						onChange={(value) => runtimeActions.updateSetting("password", value)}
					/>
				</div>
				<p className="mt-2 text-[11px] text-slate-400">
					Credentials are saved locally on this device at{" "}
					<span className="font-mono text-slate-300">
						{new Date(runtimeState.settingsSavedAt).toLocaleTimeString()}
					</span>
					.
				</p>
				<label className="mt-3 flex items-center gap-2 text-xs text-slate-300">
					<input
						type="checkbox"
						checked={runtimeState.autoConnectOnLaunch}
						onChange={(event) =>
							runtimeActions.updateAutoConnectOnLaunch(event.target.checked)
						}
					/>
					<span>Auto-connect on launch (single startup attempt)</span>
				</label>
				<label className="mt-2 flex items-center gap-2 text-xs text-slate-300">
					<input
						type="checkbox"
						checked={runtimeState.notifyOnAgentFinish}
						onChange={(event) =>
							runtimeActions.updateNotifyOnAgentFinish(event.target.checked)
						}
					/>
					<span>Notify when agent finishes a response</span>
				</label>
				<p className="mt-3 text-xs text-slate-300">
					HTTP base: <span className="font-mono text-slate-100">{resolvedUi || "(invalid)"}</span>
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
};

function ChatScreen({
	workspace,
	activeThread,
	workspaceActions,
	runtimeState,
	runtimeActions,
}: ChatScreenProps) {
	const messageViewportRef = useRef<HTMLDivElement | null>(null);
	const lastMessage = activeThread?.messages[activeThread.messages.length - 1];
	const handleTalkButtonClick = useCallback(async () => {
		const toggleResult = await runtimeActions.toggleRecording();
		const transcriptToSend = resolveTalkStopTranscript(
			toggleResult.wasRecording,
			toggleResult.transcriptBeforeToggle,
		);
		if (!transcriptToSend) return;
		workspaceActions.updatePrompt(transcriptToSend);
	}, [runtimeActions, workspaceActions]);

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

	return (
		<section className="space-y-4">
			<div className="rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900/85 to-slate-900/65 p-4 backdrop-blur">
				<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
					<label className="grid gap-1 text-xs text-slate-300">
						<span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
							Active Agent
						</span>
						<div className="relative">
							<select
								className="h-10 w-full appearance-none rounded-xl border border-white/20 bg-slate-950/55 px-3 pr-9 text-sm text-slate-100 outline-none ring-cyan-300/40 transition focus:ring"
								value={workspace.selectedAgentId}
								onChange={(event) => workspaceActions.updateSelectedAgent(event.target.value)}
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
					<button
						type="button"
						className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-cyan-300 px-4 text-xs font-semibold text-slate-950 shadow-[0_0_0_1px_rgba(56,189,248,0.2)]"
						onClick={() => void workspaceActions.createNewChat()}
					>
						<PlusIcon />
						New Session
					</button>
					<button
						type="button"
						className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-white/20 bg-slate-950/45 px-4 text-xs text-slate-100 transition hover:border-cyan-300/45"
						onClick={() => void workspaceActions.refreshSessionsData()}
					>
						<RefreshIcon />
						Refresh
					</button>
				</div>
			</div>

			<div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 backdrop-blur">
				<div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
					<div>
						<h2 className="text-xl font-semibold">{activeThread?.name || "No session selected"}</h2>
						<p className="mt-1 text-xs text-slate-300">
							{activeThread
								? `${activeThread.agentId} · ${activeThread.id}`
								: "Create or select a session to start chatting."}
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							className="rounded-full border border-white/20 px-3 py-1 text-xs"
							onClick={() => activeThread && workspaceActions.renameThreadByPrompt(activeThread)}
							disabled={!activeThread}
						>
							Rename
						</button>
						<button
							type="button"
							className="rounded-full border border-rose-400/40 bg-rose-500/15 px-3 py-1 text-xs text-rose-200"
							onClick={() => activeThread && workspaceActions.removeThread(activeThread)}
							disabled={!activeThread}
						>
							Delete
						</button>
					</div>
				</div>

				<div ref={messageViewportRef} className="mt-4 max-h-[46vh] space-y-3 overflow-auto pr-1">
					{activeThread?.messages.length ? (
						activeThread.messages.map((message) => (
							<MessageCard key={message.id} message={message} />
						))
					) : (
						<div className="rounded-2xl border border-dashed border-white/15 bg-slate-950/50 p-6 text-center text-sm text-slate-300">
							No chat messages yet. Send a prompt to begin.
						</div>
					)}
				</div>

				<div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
						<div className="mb-2 flex flex-wrap items-center gap-2">
							<button
								type="button"
								className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
									runtimeState.recording
										? "bg-rose-500/20 text-rose-100"
										: "bg-cyan-300 text-slate-950"
								}`}
								onClick={() => void handleTalkButtonClick()}
								aria-label={runtimeState.recording ? "Stop microphone" : "Start microphone"}
							>
								<MicIcon />
								{runtimeState.recording ? "Stop Mic" : "Talk"}
							</button>
						</div>
						<textarea
							className="min-h-28 w-full resize-y rounded-xl border border-white/15 bg-slate-950/50 p-3 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:ring"
							placeholder={
								workspace.connectionStatus === "connected"
									? "Message the selected agent..."
									: "Connect to a gateway first..."
							}
							value={workspace.prompt}
							onChange={(event) => workspaceActions.updatePrompt(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter" && !event.shiftKey) {
									event.preventDefault();
									void workspaceActions.sendPrompt();
								}
							}}
						/>
						<div className="mt-2 flex flex-wrap items-center justify-between gap-2">
							<p className="text-xs text-slate-300">
								{workspace.isStreaming ? "Streaming response..." : "Enter sends, Shift+Enter adds newline."}
							</p>
							<button
								type="button"
								className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
								onClick={() => void workspaceActions.sendPrompt()}
								disabled={workspace.connectionStatus !== "connected" || workspace.isStreaming}
							>
								Send
							</button>
						</div>
					</div>
			</div>
		</section>
	);
}

type ChatThreadsRailProps = {
	workspace: WorkspaceState;
	workspaceActions: WorkspaceActions;
	onSelectThread?: () => void;
};

function ChatThreadsRail({
	workspace,
	workspaceActions,
	onSelectThread,
}: ChatThreadsRailProps) {
	return (
		<div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 p-3">
			<div className="flex items-center justify-between">
				<p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
					Conversations
				</p>
				<span className="text-[11px] text-slate-400">{workspace.threads.length}</span>
			</div>
			<div className="mt-2 flex gap-2">
				<button
					type="button"
					className="flex-1 rounded-full bg-cyan-300 px-3 py-1.5 text-[11px] font-semibold text-slate-950"
					onClick={() => void workspaceActions.createNewChat()}
				>
					New
				</button>
				<button
					type="button"
					className="flex-1 rounded-full border border-white/20 px-3 py-1.5 text-[11px]"
					onClick={() => void workspaceActions.refreshSessionsData()}
				>
					Refresh
				</button>
			</div>
			<div className="mt-3 max-h-[52vh] space-y-2 overflow-auto pr-1">
				{workspace.sessionsLoading ? (
					<div className="rounded-xl border border-dashed border-white/15 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
						Loading sessions...
					</div>
				) : workspace.threads.length === 0 ? (
					<div className="rounded-xl border border-dashed border-white/15 bg-slate-950/50 px-3 py-2 text-xs text-slate-400">
						No sessions yet.
					</div>
				) : (
					workspace.threads.map((thread) => (
						<button
							key={thread.id}
							type="button"
							onClick={() => {
								workspaceActions.selectThread(thread.id);
								onSelectThread?.();
							}}
							className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition ${
								thread.id === workspace.activeThreadId
									? "border-cyan-400/50 bg-cyan-500/10"
									: "border-white/10 bg-slate-950/50 hover:border-cyan-400/40"
							}`}
						>
							<div className="truncate font-semibold">{thread.name}</div>
							<div className="mt-1 flex items-center justify-between text-[10px] uppercase tracking-[0.15em] text-slate-400">
								<span>{thread.agentId}</span>
								<span>{thread.messageCount ?? thread.messages.length}</span>
							</div>
						</button>
					))
				)}
			</div>
		</div>
	);
}

function MicIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			className="h-3.5 w-3.5"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="9" y="3" width="6" height="11" rx="3" />
			<path d="M5 11a7 7 0 0 0 14 0" />
			<path d="M12 18v3" />
			<path d="M8 21h8" />
		</svg>
	);
}

function PlusIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			className="h-3.5 w-3.5"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
		>
			<path d="M12 5v14" />
			<path d="M5 12h14" />
		</svg>
	);
}

function RefreshIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			className="h-3.5 w-3.5"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M20 12a8 8 0 1 1-2.34-5.66" />
			<path d="M20 4v6h-6" />
		</svg>
	);
}

function ChevronDownIcon() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 24 24"
			className="h-4 w-4"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.8"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="m6 9 6 6 6-6" />
		</svg>
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
	const subAgentCandidates = buildSubAgentCandidates(workspace.agentCatalog, formAgentId);

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
								onChange={(event) => workspaceActions.setEditTargetAgentId(event.target.value)}
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
							onChange={(value) => workspaceActions.updateCreateAgentDraft("id", value)}
						/>
					)}
					<Field
						label="Display Name"
						value={workspace.createAgentDraft.displayName}
						onChange={(value) => workspaceActions.updateCreateAgentDraft("displayName", value)}
					/>
					<Field
						label="Description"
						value={workspace.createAgentDraft.description}
						onChange={(value) => workspaceActions.updateCreateAgentDraft("description", value)}
					/>
					<Field
						label="Model"
						value={workspace.createAgentDraft.model}
						onChange={(value) => workspaceActions.updateCreateAgentDraft("model", value)}
					/>
					<Field
						label="Tools (comma-separated)"
						value={workspace.createAgentDraft.toolsCsv}
						onChange={(value) => workspaceActions.updateCreateAgentDraft("toolsCsv", value)}
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
						When enabled, this agent can learn from prompt-training feedback so it can improve
						its performance over time.
					</p>
					<label className="grid gap-1 text-xs text-slate-300">
						<span>Prompt</span>
						<textarea
							className="min-h-24 rounded-lg border border-white/20 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none ring-cyan-300/40 focus:ring"
							value={workspace.createAgentDraft.prompt}
							onChange={(event) =>
								workspaceActions.updateCreateAgentDraft("prompt", event.target.value)
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
							Existing agents only. Current edited agent is automatically excluded.
						</p>
						<div className="mt-2 max-h-36 space-y-1 overflow-auto pr-1">
							{subAgentCandidates.length === 0 ? (
								<p className="text-[11px] text-slate-400">No available agents to link.</p>
							) : (
								subAgentCandidates.map((agent) => {
									const checked = workspace.createAgentDraft.selectedSubAgentIds.includes(agent.id);
									return (
										<label
											key={agent.id}
											className="flex cursor-pointer items-center justify-between rounded-md border border-white/10 bg-slate-900/70 px-2 py-1.5 text-xs text-slate-200"
										>
											<div className="mr-2 min-w-0">
												<p className="truncate font-semibold">{agent.displayName}</p>
												<p className="truncate font-mono text-[10px] text-slate-400">{agent.id}</p>
											</div>
											<input
												type="checkbox"
												className="h-4 w-4 rounded border-white/20 bg-slate-900"
												checked={checked}
												onChange={() => workspaceActions.toggleCreateAgentSubAgent(agent.id)}
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
};

function RuntimeScreen({ runtimeState, runtimeActions }: RuntimeScreenProps) {
	const [recordHotkey, setRecordHotkey] = useState(runtimeState.recordHotkey);
	const [overlayHotkey, setOverlayHotkey] = useState(runtimeState.overlayHotkey);
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

	useEffect(() => {
		setRecordHotkey(runtimeState.recordHotkey);
	}, [runtimeState.recordHotkey]);

	useEffect(() => {
		setOverlayHotkey(runtimeState.overlayHotkey);
	}, [runtimeState.overlayHotkey]);

	useEffect(() => {
		setQuickSendOnRecordHotkey(runtimeState.quickSendOnRecordHotkey);
	}, [runtimeState.quickSendOnRecordHotkey]);

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
				: { text: "Failed to save hotkeys. Verify format and try again.", error: true },
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
						text: "Notification test failed. Check macOS notification permissions and retry.",
						error: true,
					},
		);
	}, [runtimeActions]);

	return (
		<section className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4 backdrop-blur">
			<div>
				<h2 className="text-lg font-semibold">Runtime</h2>
				<p className="mt-1 text-xs text-slate-300">
					Native profile: {runtimeState.platform.os}. Configure overlay and hotkeys here.
				</p>
			</div>
			<p className="text-xs text-slate-300">
				Transcript: <span className="font-mono text-slate-100">{runtimeState.transcript || "(empty)"}</span>
			</p>
				<div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
					<p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
						Hotkeys
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
					<span>Quick-send transcript when record hotkey session stops</span>
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
					<span className="font-mono text-slate-300">{runtimeState.recordHotkey}</span> (record),{" "}
					<span className="font-mono text-slate-300">{runtimeState.overlayHotkey}</span>{" "}
					(overlay)
				</p>
				<p className="mt-2 text-[11px] text-slate-400">
					Use Tauri accelerator syntax (example:{" "}
					<span className="font-mono text-slate-300">CommandOrControl+Shift+R</span>).
				</p>
				<p className="mt-1 text-[11px] text-slate-400">
					Overlay visibility is controlled by recording start/stop and the overlay hotkey.
				</p>
				</div>
				<div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
					<p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
						Permissions
					</p>
					<p className="mt-1 text-[11px] text-slate-400">
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
											onClick={() => void runtimeActions.openPermissionSettings(entry.id)}
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
					<p className="mt-2 text-[11px] text-slate-400">{runtimeState.permissions.note}</p>
				</div>
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
						<div key={`${entry}-${index}`} className="rounded-lg border border-white/10 bg-slate-950/50 px-2 py-1 text-slate-300">
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
	activeThread,
	workspaceActions,
}: MainViewProps) {
	const resolvedUi = useMemo(() => resolveGatewayUiUrl(runtimeState.settings), [runtimeState.settings]);
	const location = useLocation();
	const navigate = useNavigate();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const lastFailureRedirectRef = useRef<string | null>(null);
	const navItems: MainNavItem[] = [
		{ path: "/gateway", label: "Gateway", description: "Connection + settings" },
		{ path: "/chat", label: "Chat", description: "Sessions and messages" },
		{ path: "/agents", label: "Agents", description: "Create and inspect" },
			{ path: "/runtime", label: "Runtime", description: "Overlay + hotkeys settings" },
		{ path: "/events", label: "Events", description: "Activity feed" },
	];

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
			!shouldRouteToGatewayOnFailure(workspace.connectionStatus, workspace.connectionMessage)
		) {
			return;
		}
		const failureKey = `${workspace.connectionStatus}:${workspace.connectionMessage}`;
		if (lastFailureRedirectRef.current === failureKey) return;
		lastFailureRedirectRef.current = failureKey;
		if (location.pathname !== "/gateway") {
			navigate("/gateway");
		}
	}, [
		location.pathname,
		navigate,
		workspace.connectionMessage,
		workspace.connectionStatus,
	]);

	const showThreadRail = shouldShowThreadRail(location.pathname);

	return (
		<div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_6%,rgba(56,189,248,0.18),transparent_34%),radial-gradient(circle_at_92%_94%,rgba(14,165,233,0.18),transparent_36%)]" />
			<div className="mx-auto w-full max-w-[1500px] px-5 py-6">
				<header className="mb-4 flex flex-wrap items-start justify-between gap-3">
					<div>
						<p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-400">
							Wingman Desktop Companion
						</p>
						<h1 className="text-3xl font-semibold">Gateway Workspace</h1>
						<p className="mt-2 text-sm text-slate-300">
							Focused desktop experience for sessions, agent chats, and local voice capture.
						</p>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							className="rounded-full border border-white/20 bg-slate-900/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-200 lg:hidden"
							onClick={() => setMobileMenuOpen((prev) => !prev)}
						>
							Menu
						</button>
						<ConnectionBadge
							status={workspace.connectionStatus}
							detail={workspace.connectionMessage}
							runtimeDetail={runtimeState.statusMessage}
						/>
					</div>
				</header>

				<div className="grid gap-4 lg:grid-cols-[260px_1fr]">
					<aside className="hidden lg:block">
						<section className="sticky top-6 rounded-2xl border border-white/10 bg-slate-900/70 p-4 backdrop-blur">
							<h2 className="text-lg font-semibold">Sections</h2>
							<p className="mt-1 text-xs text-slate-300">Two-column desktop layout.</p>
							<MainSidebarNav items={navItems} />
							{showThreadRail ? (
								<ChatThreadsRail
									workspace={workspace}
									workspaceActions={workspaceActions}
								/>
							) : null}
						</section>
					</aside>
					<main className="space-y-4">
						<Routes>
							<Route path="/" element={<Navigate to="/chat" replace />} />
							<Route
								path="/gateway"
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
								path="/chat"
								element={
									<ChatScreen
										workspace={workspace}
										activeThread={activeThread}
										workspaceActions={workspaceActions}
										runtimeState={runtimeState}
										runtimeActions={runtimeActions}
									/>
								}
							/>
							<Route
								path="/agents"
								element={<AgentsScreen workspace={workspace} workspaceActions={workspaceActions} />}
							/>
							<Route
								path="/runtime"
								element={<RuntimeScreen runtimeState={runtimeState} runtimeActions={runtimeActions} />}
							/>
							<Route path="/events" element={<EventsScreen workspace={workspace} />} />
							<Route path="*" element={<Navigate to="/chat" replace />} />
						</Routes>
					</main>
				</div>

				{mobileMenuOpen ? (
					<div className="fixed inset-0 z-40 lg:hidden">
						<button
							type="button"
							className="absolute inset-0 bg-black/55"
							aria-label="Close menu"
							onClick={() => setMobileMenuOpen(false)}
						/>
						<div className="absolute left-0 top-0 h-full w-[82vw] max-w-[320px] border-r border-white/10 bg-slate-950/95 p-4 backdrop-blur">
							<div className="mb-3 flex items-center justify-between">
								<h2 className="text-lg font-semibold">Sections</h2>
								<button
									type="button"
									className="rounded-full border border-white/20 px-3 py-1 text-xs"
									onClick={() => setMobileMenuOpen(false)}
								>
									Close
								</button>
							</div>
							<p className="text-xs text-slate-300">Navigation for smaller screens.</p>
							<MainSidebarNav items={navItems} onNavigate={() => setMobileMenuOpen(false)} />
							{showThreadRail ? (
								<ChatThreadsRail
									workspace={workspace}
									workspaceActions={workspaceActions}
									onSelectThread={() => setMobileMenuOpen(false)}
								/>
							) : null}
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}
type MessageCardProps = {
	message: ChatMessage;
};

function MessageCard({ message }: MessageCardProps) {
	const isUser = message.role === "user";
	return (
		<div
			className={`rounded-2xl border p-3 ${
				isUser ? "border-cyan-400/35 bg-cyan-500/10" : "border-white/10 bg-slate-950/60"
			}`}
		>
			<div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-400">
				<span>{message.role}</span>
				<span>{new Date(message.createdAt).toLocaleTimeString()}</span>
			</div>
			<div className="whitespace-pre-wrap text-sm text-slate-100">
				{message.content || message.uiTextFallback || "..."}
			</div>

			{message.toolEvents?.length ? (
				<div className="mt-3 space-y-2">
					{message.toolEvents.map((tool) => (
						<div key={tool.id} className="rounded-lg border border-white/10 bg-slate-900/70 px-2 py-2 text-xs">
							<div className="flex items-center justify-between">
								<span className="font-semibold">{tool.name}</span>
								<span className="font-mono text-slate-300">{tool.status}</span>
							</div>
							{tool.error ? <p className="mt-1 text-rose-300">{tool.error}</p> : null}
						</div>
					))}
				</div>
			) : null}

			{message.thinkingEvents?.length ? (
				<div className="mt-3 rounded-lg border border-white/10 bg-slate-900/70 px-2 py-2 text-xs text-slate-300">
					<p className="mb-1 uppercase tracking-[0.15em] text-slate-400">Thinking</p>
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

function OverlayView({ state, actions, canUseWebSpeechRecognition }: OverlayProps) {
	const hasTranscript = state.transcript.trim().length > 0;
	const overlayStatusMessage =
		state.statusIsError
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
						<span className="rounded-full border border-white/25 px-3 py-1 text-xs">Wingman AI</span>
						<span className="rounded-full border border-white/25 px-3 py-1 text-xs">Idle</span>
					</div>
					<h2 className="text-3xl font-semibold">Overlay Ready</h2>
					<p className="mt-2 text-sm text-slate-300">Use tray action <span className="font-mono">Start Recording</span> to show active capture.</p>
					<div className="mt-4">
						<button className="rounded-full border border-white/25 px-4 py-2 text-sm" onClick={() => void actions.hideOverlay()} type="button">
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
					<span className="rounded-full border border-white/25 px-3 py-1 text-xs">Wingman AI</span>
					<span className={`rounded-full border px-3 py-1 text-xs ${state.recording ? "border-emerald-400/50 text-emerald-300" : "border-white/25 text-slate-200"}`}>
						{state.recording ? "Listening" : "Idle"}
					</span>
				</div>

				<h2 className="text-3xl font-semibold">{state.recording ? "Listening..." : "Review transcript"}</h2>
				<p className="mt-2 text-sm text-slate-300">{overlayStatusMessage}</p>
				<p className="mt-1 text-sm text-slate-300">Recognizer: {state.recognitionMessage}</p>
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
					onChange={(event) => void actions.updateTranscript(event.target.value)}
				/>

				<div className="mt-4 flex flex-wrap gap-2">
					<button
						className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950"
						onClick={() => {
							if (state.recording && !state.recognitionActive && canUseWebSpeechRecognition) {
								void actions.startRecognition();
								return;
							}
							void actions.toggleRecording();
						}}
						type="button"
					>
						{state.recording
							? state.recognitionActive
								? "Stop"
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

function ConnectionBadge({ status, detail, runtimeDetail }: ConnectionBadgeProps) {
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
