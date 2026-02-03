import { AgentInvoker } from "@/cli/core/agentInvoker.js";
import { OutputManager } from "@/cli/core/outputManager.js";
import { SessionManager } from "@/cli/core/sessionManager.js";
import { AgentLoader } from "@/agent/config/agentLoader.js";
import type { GatewayHttpContext } from "./types.js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export type WebhookConfig = {
	id: string;
	name: string;
	agentId: string;
	secret: string;
	enabled: boolean;
	eventLabel?: string;
	preset?: string;
	sessionId?: string;
	createdAt: number;
	lastTriggeredAt?: number;
};

const WEBHOOK_PRESETS = new Set(["gog-gmail"]);

const normalizePreset = (value?: string): string | undefined => {
	if (!value) return undefined;
	const trimmed = value.trim();
	if (!trimmed || trimmed === "custom") return undefined;
	return WEBHOOK_PRESETS.has(trimmed) ? trimmed : undefined;
};

const formatGogGmailContent = (
	payload: any,
	webhookName: string,
	eventLabel?: string,
): string => {
	const payloadMessages = Array.isArray(payload?.messages) ? payload.messages : [];
	const dataMessages = Array.isArray(payload?.data?.messages)
		? payload.data.messages
		: [];
	const candidate =
		payload?.message ||
		payload?.email ||
		payload?.data?.message ||
		payloadMessages[0] ||
		dataMessages[0] ||
		null;

	const header = `Gmail update received${eventLabel ? ` (${eventLabel})` : ""} for "${webhookName}".`;

	if (!candidate) {
		const fallback = payload
			? JSON.stringify(payload, null, 2)
			: "{}";
		return `${header}\n\nPayload:\n${fallback}`;
	}

	const subject =
		candidate.subject ||
		candidate.headers?.subject ||
		candidate.headers?.Subject ||
		"(no subject)";
	const from =
		candidate.from ||
		candidate.headers?.from ||
		candidate.headers?.From ||
		"unknown sender";
	const snippet = candidate.snippet || candidate.preview || "";
	const body = candidate.body || candidate.text || candidate.html || "";
	const id = candidate.id || candidate.messageId || "";

	const lines = [
		header,
		`From: ${from}`,
		`Subject: ${subject}`,
	];
	if (id) lines.push(`Message ID: ${id}`);
	if (snippet) lines.push(`Snippet: ${snippet}`);
	if (body) lines.push("", body);

	return lines.join("\n");
};

type WebhookStore = {
	load: () => WebhookConfig[];
	save: (webhooks: WebhookConfig[]) => void;
	generateSecret: () => string;
};

export const createWebhookStore = (
	resolveConfigDirPath: () => string,
): WebhookStore => {
	const resolvePath = () => {
		const configDir = resolveConfigDirPath();
		mkdirSync(configDir, { recursive: true });
		return join(configDir, "webhooks.json");
	};

	return {
		load: () => {
			const path = resolvePath();
			if (!existsSync(path)) {
				return [];
			}
			try {
				const raw = readFileSync(path, "utf-8");
				const parsed = JSON.parse(raw);
				return Array.isArray(parsed) ? (parsed as WebhookConfig[]) : [];
			} catch {
				return [];
			}
		},
		save: (webhooks: WebhookConfig[]) => {
			const path = resolvePath();
			writeFileSync(path, JSON.stringify(webhooks, null, 2));
		},
		generateSecret: () => randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, ""),
	};
};

const agentExists = (ctx: GatewayHttpContext, agentId: string): boolean => {
	const loader = new AgentLoader(
		ctx.configDir,
		ctx.workspace,
		ctx.getWingmanConfig(),
	);
	const configs = loader.loadAllAgentConfigs();
	return Boolean(configs.find((config) => config.name === agentId));
};

const sessionExists = async (
	ctx: GatewayHttpContext,
	agentId: string,
	sessionId: string,
): Promise<boolean> => {
	const manager = await ctx.getSessionManager(agentId);
	return Boolean(manager.getSession(sessionId));
};

export const handleWebhooksApi = async (
	ctx: GatewayHttpContext,
	store: WebhookStore,
	req: Request,
	url: URL,
): Promise<Response | null> => {
	if (url.pathname === "/api/webhooks") {
		if (req.method === "GET") {
			const webhooks = store.load();
			return new Response(JSON.stringify(webhooks, null, 2), {
				headers: { "Content-Type": "application/json" },
			});
		}

		if (req.method === "POST") {
			const body = (await req.json()) as {
				id?: string;
				name?: string;
				agentId?: string;
				secret?: string;
				enabled?: boolean;
				eventLabel?: string;
				preset?: string;
				sessionId?: string;
			};

			const id = body?.id?.trim();
			const name = body?.name?.trim();
			const agentId = body?.agentId?.trim();
			if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
				return new Response("Invalid webhook id", { status: 400 });
			}
			if (!name) {
				return new Response("Webhook name required", { status: 400 });
			}
			if (!agentId) {
				return new Response("agentId required", { status: 400 });
			}
			if (!agentExists(ctx, agentId)) {
				return new Response("Invalid agentId", { status: 400 });
			}
			const sessionId = body?.sessionId?.trim();
			if (sessionId) {
				const exists = await sessionExists(ctx, agentId, sessionId);
				if (!exists) {
					return new Response("Invalid sessionId", { status: 400 });
				}
			}

			const webhooks = store.load();
			if (webhooks.some((hook) => hook.id === id)) {
				return new Response("Webhook already exists", { status: 409 });
			}

			const presetValue = normalizePreset(body?.preset);
			if (body?.preset && !presetValue && body.preset.trim() !== "custom") {
				return new Response("Invalid preset", { status: 400 });
			}

			const webhook: WebhookConfig = {
				id,
				name,
				agentId,
				secret: body?.secret?.trim() || store.generateSecret(),
				enabled: body?.enabled ?? true,
				eventLabel: body?.eventLabel?.trim() || undefined,
				preset: presetValue,
				sessionId: sessionId || undefined,
				createdAt: Date.now(),
			};

			webhooks.unshift(webhook);
			store.save(webhooks);

			return new Response(JSON.stringify(webhook, null, 2), {
				headers: { "Content-Type": "application/json" },
			});
		}

		return new Response("Method Not Allowed", { status: 405 });
	}

	const webhookMatch = url.pathname.match(/^\/api\/webhooks\/([^/]+)$/);
	if (!webhookMatch) {
		return null;
	}

	const webhookId = decodeURIComponent(webhookMatch[1]);
	const webhooks = store.load();
	const webhook = webhooks.find((hook) => hook.id === webhookId);

	if (req.method === "GET") {
		if (!webhook) {
			return new Response("Webhook not found", { status: 404 });
		}
		return new Response(JSON.stringify(webhook, null, 2), {
			headers: { "Content-Type": "application/json" },
		});
	}

	if (req.method === "PUT") {
		if (!webhook) {
			return new Response("Webhook not found", { status: 404 });
		}
		const body = (await req.json()) as {
			name?: string;
			agentId?: string;
			secret?: string;
			enabled?: boolean;
			eventLabel?: string;
			preset?: string;
			sessionId?: string;
		};

		const nextAgentId = body?.agentId?.trim() || webhook.agentId;
		if (!agentExists(ctx, nextAgentId)) {
			return new Response("Invalid agentId", { status: 400 });
		}

		const hasPreset = Object.prototype.hasOwnProperty.call(body ?? {}, "preset");
		const presetValue = hasPreset ? normalizePreset(body?.preset) : webhook.preset;
		if (hasPreset && body?.preset && !presetValue && body.preset.trim() !== "custom") {
			return new Response("Invalid preset", { status: 400 });
		}
		const hasSessionId = Object.prototype.hasOwnProperty.call(
			body ?? {},
			"sessionId",
		);
		let nextSessionId = webhook.sessionId;
		if (hasSessionId) {
			const trimmed = body?.sessionId?.trim();
			if (!trimmed) {
				nextSessionId = undefined;
			} else {
				const exists = await sessionExists(ctx, nextAgentId, trimmed);
				if (!exists) {
					return new Response("Invalid sessionId", { status: 400 });
				}
				nextSessionId = trimmed;
			}
		}

		const updated: WebhookConfig = {
			...webhook,
			name: body?.name?.trim() || webhook.name,
			agentId: nextAgentId,
			secret: body?.secret?.trim() || webhook.secret,
			enabled: body?.enabled ?? webhook.enabled,
			eventLabel: body?.eventLabel?.trim() || undefined,
			preset: presetValue,
			sessionId: nextSessionId,
		};

		const nextWebhooks = webhooks.map((hook) =>
			hook.id === webhookId ? updated : hook,
		);
		store.save(nextWebhooks);

		return new Response(JSON.stringify(updated, null, 2), {
			headers: { "Content-Type": "application/json" },
		});
	}

	if (req.method === "DELETE") {
		if (!webhook) {
			return new Response("Webhook not found", { status: 404 });
		}
		const nextWebhooks = webhooks.filter((hook) => hook.id !== webhookId);
		store.save(nextWebhooks);
		return new Response(JSON.stringify({ ok: true }, null, 2), {
			headers: { "Content-Type": "application/json" },
		});
	}

	return new Response("Method Not Allowed", { status: 405 });
};

export const handleWebhookInvoke = async (
	ctx: GatewayHttpContext,
	store: WebhookStore,
	req: Request,
	url: URL,
): Promise<Response | null> => {
	const match = url.pathname.match(/^\/webhooks\/([^/]+)$/);
	if (!match) {
		return null;
	}
	if (req.method !== "POST") {
		return new Response("Method Not Allowed", { status: 405 });
	}

	const webhookId = decodeURIComponent(match[1]);
	const webhooks = store.load();
	const webhook = webhooks.find((hook) => hook.id === webhookId);

	if (!webhook) {
		return new Response("Webhook not found", { status: 404 });
	}
	if (!webhook.enabled) {
		return new Response("Webhook disabled", { status: 403 });
	}

	const secret =
		req.headers.get("x-wingman-secret") ||
		url.searchParams.get("secret") ||
		"";
	if (!secret || secret !== webhook.secret) {
		return new Response("Unauthorized", { status: 401 });
	}

	let body: any = null;
	let rawText: string | null = null;
	try {
		body = await req.json();
	} catch {
		try {
			rawText = await req.text();
		} catch {
			rawText = null;
		}
	}

	const eventLabel =
		typeof body?.event === "string" ? body.event : webhook.eventLabel;
	const directPrompt =
		typeof body?.prompt === "string"
			? body.prompt
			: typeof body?.content === "string"
				? body.content
				: typeof body?.message === "string"
					? body.message
					: "";

	const payloadText =
		rawText ||
		(body !== null && body !== undefined ? JSON.stringify(body, null, 2) : "");

	const content =
		directPrompt ||
		(webhook.preset === "gog-gmail"
			? formatGogGmailContent(body ?? {}, webhook.name, eventLabel)
			: `Webhook "${webhook.name}" triggered${eventLabel ? ` (${eventLabel})` : ""}.\n\nPayload:\n${payloadText || "{}"}`);

	const agentId = webhook.agentId;
	const defaultSessionKey = `agent:${agentId}:webhook:${webhook.id}`;
	let sessionKey = defaultSessionKey;

	try {
		const sessionManager = await ctx.getSessionManager(agentId);
		sessionKey = webhook.sessionId || defaultSessionKey;
		if (webhook.sessionId) {
			const target = sessionManager.getSession(webhook.sessionId);
			if (!target) {
				return new Response("Target session not found", { status: 404 });
			}
		} else {
			sessionManager.getOrCreateSession(
				sessionKey,
				agentId,
				`Webhook: ${webhook.name}`,
			);
		}
		sessionManager.updateSession(sessionKey, {
			lastMessagePreview: content.substring(0, 200),
		});
		const existing = sessionManager.getSession(sessionKey);
		if (existing) {
			sessionManager.updateSession(sessionKey, {
				messageCount: existing.messageCount + 1,
			});
		}
		sessionManager.updateSessionMetadata(sessionKey, {
			source: "webhook",
			webhookId: webhook.id,
			webhookName: webhook.name,
			eventLabel: eventLabel || undefined,
			webhookPreset: webhook.preset,
		});

		const outputManager = new OutputManager("interactive");
		const workspace = ctx.resolveAgentWorkspace(agentId);
		const session = (sessionManager as SessionManager).getSession(sessionKey);
		const workdir = session?.metadata?.workdir ?? null;
		const defaultOutputDir = ctx.resolveDefaultOutputDir(agentId);
		const invoker = new AgentInvoker({
			workspace,
			configDir: ctx.configDir,
			outputManager,
			logger: ctx.logger,
			sessionManager,
			workdir,
			defaultOutputDir,
		});

		void invoker.invokeAgent(agentId, content, sessionKey);
	} catch (error) {
		ctx.logger.error("Webhook agent invocation failed", error);
		return new Response("Webhook invocation failed", { status: 500 });
	}

	const updatedWebhooks = webhooks.map((hook) =>
		hook.id === webhook.id ? { ...hook, lastTriggeredAt: Date.now() } : hook,
	);
	store.save(updatedWebhooks);

	return new Response(JSON.stringify({ ok: true, sessionId: sessionKey }, null, 2), {
		headers: { "Content-Type": "application/json" },
	});
};
