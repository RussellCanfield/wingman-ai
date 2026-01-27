import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import type {
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
	ToolEvent,
	Thread,
	Routine,
} from "./types";
import { parseStreamEvents } from "./utils/streaming";
import { Sidebar } from "./components/Sidebar";
import { HeroPanel } from "./components/HeroPanel";
import { ChatPage } from "./pages/ChatPage";
import { CommandDeckPage } from "./pages/CommandDeckPage";
import { AgentsPage } from "./pages/AgentsPage";
import { RoutinesPage } from "./pages/RoutinesPage";
import { buildRoutineAgents } from "./utils/agentOptions";

const DEFAULT_CONFIG: ControlUiConfig = {
	gatewayHost: "127.0.0.1",
	gatewayPort: 18789,
	requireAuth: false,
	outputRoot: "",
	agents: [],
};

const TOKEN_KEY = "wingman_webui_token";
const PASSWORD_KEY = "wingman_webui_password";
const DEVICE_KEY = "wingman_webui_device";
const AUTO_CONNECT_KEY = "wingman_webui_autoconnect";
const DEFAULT_THREAD_NAME = "New Thread";

export const App: React.FC = () => {
	const navigate = useNavigate();
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
	const [autoConnectStatus, setAutoConnectStatus] = useState<string>("");

	const wsRef = useRef<WebSocket | null>(null);
	const connectRequestIdRef = useRef<string | null>(null);
	const buffersRef = useRef<Map<string, string>>(new Map());
	const requestThreadRef = useRef<Map<string, string>>(new Map());
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

	const activeThread = useMemo(() => {
		return threads.find((thread) => thread.id === activeThreadId) || threads[0];
	}, [activeThreadId, threads]);

	const currentAgentId = activeThread?.agentId || agentId;

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

	const updateAssistant = useCallback((requestId: string, text: string) => {
		const threadId = requestThreadRef.current.get(requestId);
		if (!threadId) return;
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
				const existing = thread.toolEvents ? [...thread.toolEvents] : [];
				for (const event of events) {
					const index = existing.findIndex((item) => item.id === event.id);
					if (index >= 0) {
						existing[index] = {
							...existing[index],
							...event,
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
							error: event.error,
							startedAt: event.timestamp,
							completedAt:
								event.status === "completed" || event.status === "error"
									? event.timestamp
									: undefined,
						});
					}
				}
				return {
					...thread,
					toolEvents: existing,
				};
			}),
		);
	}, []);

	const finalizeAssistant = useCallback((requestId: string, fallback?: string) => {
		const threadId = requestThreadRef.current.get(requestId);
		if (!threadId) return;
		setThreads((prev) =>
			prev.map((thread) => {
				if (thread.id !== threadId) return thread;
				return {
					...thread,
					messages: thread.messages.map((msg) => {
						if (msg.id !== requestId) return msg;
						if (!msg.content && fallback) {
							return { ...msg, content: fallback };
						}
						return msg;
					}),
				};
			}),
		);
		buffersRef.current.delete(requestId);
		requestThreadRef.current.delete(requestId);
		setIsStreaming(false);
	}, []);

	const handleAgentEvent = useCallback(
		(requestId: string, payload: any) => {
			if (!payload) return;
			if (payload.type === "agent-start") {
				logEvent(`Agent started: ${payload.agent || "unknown"}`);
				return;
			}
			if (payload.type === "agent-stream") {
				const { texts, toolEvents } = parseStreamEvents(payload.chunk);
				if (texts.length > 0) {
					const existing = buffersRef.current.get(requestId) || "";
					const next = texts.reduce((acc, text) => {
						if (text.startsWith(acc)) return text;
						return acc + text;
					}, existing);
					buffersRef.current.set(requestId, next);
					updateAssistant(requestId, next);
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
				finalizeAssistant(
					requestId,
					payload.result ? JSON.stringify(payload.result, null, 2) : undefined,
				);
				return;
			}
			if (payload.type === "agent-error") {
				logEvent(`Agent error: ${payload.error || "unknown"}`);
				finalizeAssistant(requestId, payload.error || "Agent error");
			}
		},
		[finalizeAssistant, logEvent, updateAssistant],
	);

	const disconnect = useCallback(() => {
		if (autoConnectTimerRef.current) {
			window.clearTimeout(autoConnectTimerRef.current);
			autoConnectTimerRef.current = null;
		}
		autoConnectAttemptsRef.current = 0;
		autoConnectFailureRef.current = false;
		setAutoConnectStatus("");
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
		if (!prompt.trim()) return;
		if (isStreaming) {
			logEvent("Wait for the current response to finish");
			return;
		}
		let targetThread = activeThread;
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
		const userMessage: ChatMessage = {
			id: `user-${now}`,
			role: "user",
			content: prompt.trim(),
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
								? userMessage.content.slice(0, 32)
								: thread.name,
						messages: [...thread.messages, userMessage, assistantMessage],
						messageCount: (thread.messageCount ?? thread.messages.length) + 1,
						lastMessagePreview: userMessage.content.slice(0, 200),
						updatedAt: now,
					}
					: thread,
			),
		);
		setPrompt("");
		setIsStreaming(true);
		requestThreadRef.current.set(requestId, targetThread.id);

		const payload = {
			agentId: targetThread.agentId,
			content: userMessage.content,
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
	}, [activeThread, agentId, createThread, deviceId, isStreaming, loadThreadMessages, logEvent, prompt]);

	const clearChat = useCallback(() => {
		if (!activeThread) return;
		setThreads((prev) =>
			prev.map((thread) =>
				thread.id === activeThread.id
					? { ...thread, messages: [], messageCount: 0, messagesLoaded: true }
					: thread,
			),
		);
	}, [activeThread]);

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
			if (activeThreadId === threadId) {
				const remaining = threads.filter((thread) => thread.id !== threadId);
				setActiveThreadId(remaining[0]?.id || "");
			}
		},
		[activeThread?.id, activeThreadId, isStreaming, logEvent, threads],
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
			setConfig(data);
		} catch {
			logEvent("Failed to load gateway config");
		}
	}, [logEvent]);

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
		refreshStats();
		fetchThreads();
		refreshProviders();
		refreshAgents();
	}, [fetchThreads, refreshAgents, refreshProviders, refreshStats]);

	useEffect(() => {
		if (threads.length === 0) return;
		if (!threads.find((thread) => thread.id === activeThreadId)) {
			setActiveThreadId(threads[0].id);
		}
	}, [activeThreadId, threads]);

	useEffect(() => {
		if (!activeThread) return;
		if (activeThread.messagesLoaded || !activeThread.messageCount) return;
		void loadThreadMessages(activeThread);
	}, [activeThread, loadThreadMessages]);

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
		(routine: Omit<Routine, "id" | "createdAt">) => {
			const id = `routine-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
			setRoutines((prev) => [
				{
					id,
					createdAt: Date.now(),
					...routine,
				},
				...prev,
			]);
		},
		[],
	);

	const deleteRoutine = useCallback((id: string) => {
		setRoutines((prev) => prev.filter((routine) => routine.id !== id));
	}, []);

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
					<Sidebar
						activeAgents={agentOptions}
						selectedAgentId={agentId}
						threads={threads}
						activeThreadId={activeThread?.id || ""}
						loadingThreads={loadingThreads}
						onSelectAgent={setAgentId}
						onSelectThread={handleSelectThread}
						onCreateThread={handleCreateThread}
						onDeleteThread={deleteThread}
						hostLabel={hostLabel}
						deviceId={deviceId}
						getAgentLabel={(id) =>
							agentOptions.find((agent) => agent.id === id)?.name || id
						}
					/>
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
										isStreaming={isStreaming}
										connected={connected}
										loadingThread={loadingThreadId === activeThread?.id}
										outputRoot={config.outputRoot}
										toolEvents={activeThread?.toolEvents || []}
										onPromptChange={setPrompt}
										onSendPrompt={sendPrompt}
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
										onCreateRoutine={createRoutine}
										onDeleteRoutine={deleteRoutine}
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
		createdAt: session.createdAt || Date.now(),
		updatedAt: session.updatedAt,
		messageCount: session.messageCount ?? 0,
		lastMessagePreview: session.lastMessagePreview,
		messagesLoaded: false,
		workdir: session.workdir ?? null,
	};
}
