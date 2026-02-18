import {
	isGatewayConfigValid,
	resolveGatewayUiUrl,
	type GatewaySettings,
} from "./gatewayConfig.js";
import type {
	AgentDetail,
	AgentsResponse,
	ChatMessage,
	GatewayConfig,
	GatewayHealth,
	GatewayNodeRecord,
	GatewayNodesResponse,
	GatewaySession,
	GatewayStats,
	ProviderStatusResponse,
	SessionThread,
	SmsInboundRequest,
	SmsInboundResolution,
	SubAgentPayload,
	VoiceConfig,
} from "./gatewayModels.js";

const DEFAULT_TIMEOUT_MS = 10000;

function normalizeLocalHostForClient(hostname: string): string {
	if (hostname === "0.0.0.0") return "127.0.0.1";
	if (hostname === "::" || hostname === "[::]") return "::1";
	return hostname;
}

export type ConnectionCheckResult = {
	ok: boolean;
	status: string;
	config?: GatewayConfig;
	health?: GatewayHealth;
	stats?: GatewayStats;
	error?: string;
};

function trimTrailingSlash(value: string): string {
	return value.replace(/\/+$/, "");
}

function withJsonHeaders(init?: RequestInit): RequestInit {
	const headers = new Headers(init?.headers);
	if (!headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}
	return {
		...init,
		headers,
	};
}

function withGatewayAuth(
	settings: GatewaySettings,
	init?: RequestInit,
): RequestInit {
	const headers = new Headers(init?.headers);
	const token = settings.token.trim();
	const password = settings.password.trim();
	if (token) {
		headers.set("Authorization", `Bearer ${token}`);
	}
	if (password) {
		headers.set("X-Wingman-Password", password);
	}
	return {
		...init,
		headers,
	};
}

async function fetchWithTimeout(
	url: string,
	init?: RequestInit,
	timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
	const controller = new AbortController();
	const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, {
			...init,
			signal: controller.signal,
		});
	} finally {
		globalThis.clearTimeout(timeoutId);
	}
}

export function getGatewayHttpBase(settings: GatewaySettings): string {
	const resolved = resolveGatewayUiUrl(settings);
	return trimTrailingSlash(resolved);
}

export function getGatewayWsUrl(settings: GatewaySettings): string {
	const raw = settings.url.trim();
	if (!raw) return "";
	try {
		const parsed = new URL(raw);
		parsed.hostname = normalizeLocalHostForClient(parsed.hostname);
		if (parsed.protocol === "http:") parsed.protocol = "ws:";
		if (parsed.protocol === "https:") parsed.protocol = "wss:";
		if (parsed.pathname === "/") parsed.pathname = "/ws";
		return parsed.toString();
	} catch {
		return raw;
	}
}

function ensureGatewayBase(settings: GatewaySettings): string {
	if (!isGatewayConfigValid(settings)) {
		throw new Error("Gateway URL is invalid");
	}
	const base = getGatewayHttpBase(settings);
	if (!base) {
		throw new Error("Unable to derive gateway HTTP URL");
	}
	return base;
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(text || `Request failed: ${response.status}`);
	}
	return (await response.json()) as T;
}

async function probeJson<T>(
	url: string,
	label: string,
): Promise<{ data?: T; error?: string }> {
	try {
		const response = await fetchWithTimeout(url);
		if (!response.ok) {
			const text = await response.text().catch(() => "");
			return {
				error: `${label} returned ${response.status}${text ? `: ${text}` : ""}`,
			};
		}
		return { data: (await response.json()) as T };
	} catch (error) {
		return { error: `${label} failed: ${String(error)}` };
	}
}

export async function checkGatewayConnection(
	settings: GatewaySettings,
): Promise<ConnectionCheckResult> {
	let base: string;
	try {
		base = ensureGatewayBase(settings);
	} catch (error) {
		return {
			ok: false,
			status: "Invalid gateway URL",
			error: String(error),
		};
	}

	const [configProbe, healthProbe, statsProbe] = await Promise.all([
		probeJson<GatewayConfig>(`${base}/api/config`, "config"),
		probeJson<GatewayHealth>(`${base}/api/health`, "health"),
		probeJson<GatewayStats>(`${base}/api/stats`, "stats"),
	]);

	const config = configProbe.data;
	const health = healthProbe.data;
	const stats = statsProbe.data;
	const ok = Boolean(config || health || stats);

	if (ok) {
		return {
			ok: true,
			status: "Gateway connected",
			config,
			health,
			stats,
		};
	}

	const errors = [
		configProbe.error,
		healthProbe.error,
		statsProbe.error,
	].filter(Boolean) as string[];
	return {
		ok: false,
		status: "Gateway request failed",
		error: errors.length > 0 ? errors.join(" | ") : "No gateway responses",
	};
}

export async function fetchNodes(
	settings: GatewaySettings,
): Promise<GatewayNodeRecord[]> {
	const base = ensureGatewayBase(settings);
	const response = await fetchWithTimeout(
		`${base}/api/nodes`,
		withGatewayAuth(settings),
	);
	const payload = await parseJsonOrThrow<GatewayNodesResponse>(response);
	return Array.isArray(payload.nodes) ? payload.nodes : [];
}

export async function setNodeEnabled(
	settings: GatewaySettings,
	args: { clientId: string; enabled: boolean; name?: string },
): Promise<GatewayNodeRecord> {
	const base = ensureGatewayBase(settings);
	const response = await fetchWithTimeout(
		`${base}/api/nodes/${encodeURIComponent(args.clientId)}`,
		withGatewayAuth(
			settings,
			withJsonHeaders({
				method: "PUT",
				body: JSON.stringify({
					enabled: args.enabled,
					name: args.name,
				}),
			}),
		),
	);
	return parseJsonOrThrow<GatewayNodeRecord>(response);
}

export async function fetchAgents(
	settings: GatewaySettings,
): Promise<AgentsResponse> {
	const base = ensureGatewayBase(settings);
	const response = await fetchWithTimeout(
		`${base}/api/agents`,
		withGatewayAuth(settings),
	);
	return parseJsonOrThrow<AgentsResponse>(response);
}

export async function fetchAgentDetail(
	settings: GatewaySettings,
	agentId: string,
): Promise<AgentDetail> {
	const base = ensureGatewayBase(settings);
	const response = await fetchWithTimeout(
		`${base}/api/agents/${encodeURIComponent(agentId)}`,
		withGatewayAuth(settings),
	);
	return parseJsonOrThrow<AgentDetail>(response);
}

export async function createAgent(
	settings: GatewaySettings,
	payload: {
		id: string;
		displayName?: string;
		description?: string;
		model?: string;
		tools: string[];
		prompt?: string;
		promptTraining?: boolean;
		subAgents?: SubAgentPayload[];
	},
): Promise<void> {
	const base = ensureGatewayBase(settings);
	const response = await fetchWithTimeout(
		`${base}/api/agents`,
		withGatewayAuth(
			settings,
			withJsonHeaders({
				method: "POST",
				body: JSON.stringify(payload),
			}),
		),
	);
	await parseJsonOrThrow<unknown>(response);
}

export async function updateAgent(
	settings: GatewaySettings,
	agentId: string,
	payload: {
		displayName?: string;
		description?: string;
		model?: string;
		tools: string[];
		prompt?: string;
		promptTraining?: boolean;
		subAgents?: SubAgentPayload[];
	},
): Promise<void> {
	const base = ensureGatewayBase(settings);
	const response = await fetchWithTimeout(
		`${base}/api/agents/${encodeURIComponent(agentId)}`,
		withGatewayAuth(
			settings,
			withJsonHeaders({
				method: "PUT",
				body: JSON.stringify(payload),
			}),
		),
	);
	await parseJsonOrThrow<unknown>(response);
}

export async function fetchSessions(
	settings: GatewaySettings,
	params: { limit?: number; agentId?: string } = {},
): Promise<GatewaySession[]> {
	const base = ensureGatewayBase(settings);
	const search = new URLSearchParams();
	search.set("limit", String(params.limit ?? 100));
	if (params.agentId) search.set("agentId", params.agentId);
	const response = await fetchWithTimeout(
		`${base}/api/sessions?${search.toString()}`,
		withGatewayAuth(settings),
	);
	return parseJsonOrThrow<GatewaySession[]>(response);
}

export async function fetchSessionMessages(
	settings: GatewaySettings,
	args: { sessionId: string; agentId: string },
): Promise<ChatMessage[]> {
	const base = ensureGatewayBase(settings);
	const search = new URLSearchParams({ agentId: args.agentId });
	const response = await fetchWithTimeout(
		`${base}/api/sessions/${encodeURIComponent(args.sessionId)}/messages?${search.toString()}`,
		withGatewayAuth(settings),
	);
	return parseJsonOrThrow<ChatMessage[]>(response);
}

export async function clearSessionMessages(
	settings: GatewaySettings,
	args: { sessionId: string; agentId: string },
): Promise<{
	id: string;
	messageCount: number;
	lastMessagePreview: string | null;
}> {
	const base = ensureGatewayBase(settings);
	const search = new URLSearchParams({ agentId: args.agentId });
	const response = await fetchWithTimeout(
		`${base}/api/sessions/${encodeURIComponent(args.sessionId)}/messages?${search.toString()}`,
		withGatewayAuth(settings, { method: "DELETE" }),
	);
	return parseJsonOrThrow<{
		id: string;
		messageCount: number;
		lastMessagePreview: string | null;
	}>(response);
}

export async function createSession(
	settings: GatewaySettings,
	args: { agentId: string; name?: string; sessionId?: string },
): Promise<GatewaySession> {
	const base = ensureGatewayBase(settings);
	const response = await fetchWithTimeout(
		`${base}/api/sessions`,
		withGatewayAuth(
			settings,
			withJsonHeaders({
				method: "POST",
				body: JSON.stringify(args),
			}),
		),
	);
	return parseJsonOrThrow<GatewaySession>(response);
}

export async function renameSession(
	settings: GatewaySettings,
	args: { sessionId: string; agentId: string; name: string },
): Promise<GatewaySession> {
	const base = ensureGatewayBase(settings);
	const search = new URLSearchParams({ agentId: args.agentId });
	const response = await fetchWithTimeout(
		`${base}/api/sessions/${encodeURIComponent(args.sessionId)}?${search.toString()}`,
		withGatewayAuth(
			settings,
			withJsonHeaders({
				method: "PUT",
				body: JSON.stringify({ name: args.name }),
			}),
		),
	);
	return parseJsonOrThrow<GatewaySession>(response);
}

export async function deleteSession(
	settings: GatewaySettings,
	args: { sessionId: string; agentId: string },
): Promise<void> {
	const base = ensureGatewayBase(settings);
	const search = new URLSearchParams({ agentId: args.agentId });
	const response = await fetchWithTimeout(
		`${base}/api/sessions/${encodeURIComponent(args.sessionId)}?${search.toString()}`,
		withGatewayAuth(settings, { method: "DELETE" }),
	);
	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(text || `Failed to delete session: ${response.status}`);
	}
}

export async function fetchProviders(
	settings: GatewaySettings,
): Promise<ProviderStatusResponse> {
	const base = ensureGatewayBase(settings);
	const response = await fetchWithTimeout(
		`${base}/api/providers`,
		withGatewayAuth(settings),
	);
	return parseJsonOrThrow<ProviderStatusResponse>(response);
}

export async function saveProviderToken(
	settings: GatewaySettings,
	args: { providerName: string; token: string },
): Promise<void> {
	const base = ensureGatewayBase(settings);
	const response = await fetchWithTimeout(
		`${base}/api/providers/${encodeURIComponent(args.providerName)}`,
		withGatewayAuth(
			settings,
			withJsonHeaders({
				method: "POST",
				body: JSON.stringify({ token: args.token }),
			}),
		),
	);
	await parseJsonOrThrow<unknown>(response);
}

export async function clearProviderToken(
	settings: GatewaySettings,
	providerName: string,
): Promise<void> {
	const base = ensureGatewayBase(settings);
	const response = await fetchWithTimeout(
		`${base}/api/providers/${encodeURIComponent(providerName)}`,
		withGatewayAuth(settings, { method: "DELETE" }),
	);
	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(
			text || `Failed to clear provider token: ${response.status}`,
		);
	}
}

export async function fetchVoiceConfig(
	settings: GatewaySettings,
): Promise<VoiceConfig | undefined> {
	const base = ensureGatewayBase(settings);
	const response = await fetchWithTimeout(
		`${base}/api/voice`,
		withGatewayAuth(settings),
	);
	const parsed = await parseJsonOrThrow<{ voice?: VoiceConfig }>(response);
	return parsed.voice;
}

export async function updateVoiceConfig(
	settings: GatewaySettings,
	voice: Partial<VoiceConfig>,
): Promise<VoiceConfig | undefined> {
	const base = ensureGatewayBase(settings);
	const response = await fetchWithTimeout(
		`${base}/api/voice`,
		withGatewayAuth(
			settings,
			withJsonHeaders({
				method: "PUT",
				body: JSON.stringify(voice),
			}),
		),
	);
	const parsed = await parseJsonOrThrow<{ voice?: VoiceConfig }>(response);
	return parsed.voice;
}

export async function speakVoice(
	settings: GatewaySettings,
	args: { text: string; agentId?: string },
): Promise<Blob> {
	const base = ensureGatewayBase(settings);
	const response = await fetchWithTimeout(
		`${base}/api/voice/speak`,
		withGatewayAuth(
			settings,
			withJsonHeaders({
				method: "POST",
				body: JSON.stringify(args),
			}),
		),
	);
	if (!response.ok) {
		const text = await response.text().catch(() => "");
		throw new Error(text || `Voice request failed: ${response.status}`);
	}
	return response.blob();
}

export async function submitSmsInboundMessage(
	settings: GatewaySettings,
	args: SmsInboundRequest,
): Promise<SmsInboundResolution> {
	const base = ensureGatewayBase(settings);
	const response = await fetchWithTimeout(
		`${base}/api/sms/messages`,
		withGatewayAuth(
			settings,
			withJsonHeaders({
				method: "POST",
				body: JSON.stringify(args),
			}),
		),
	);
	return parseJsonOrThrow<SmsInboundResolution>(response);
}

export function mapSessionToThread(session: GatewaySession): SessionThread {
	return {
		id: session.id,
		name: session.name,
		agentId: session.agentId,
		messages: [],
		createdAt: session.createdAt,
		updatedAt: session.updatedAt,
		messageCount: session.messageCount,
		lastMessagePreview: session.lastMessagePreview,
		messagesLoaded: false,
		workdir: session.workdir ?? null,
	};
}
