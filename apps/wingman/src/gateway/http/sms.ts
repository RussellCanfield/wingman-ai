import {
	applySmsControlCommand,
	type SmsControlResolution,
} from "../sms/control.js";
import {
	createSmsPolicyStore,
	normalizeSmsPolicyTarget,
	type SmsPolicyPatch,
	type SmsPolicyStore,
} from "../sms/policyStore.js";
import type { AgentRequestPayload, RoutingInfo } from "../types.js";
import type { GatewayHttpContext } from "./types.js";

const MAX_PAUSE_FOR_MS = 30 * 24 * 60 * 60 * 1000;

type SmsPolicyBody = {
	paused?: boolean;
	pausedUntil?: number | null;
	pauseForMs?: number;
	stopEnabled?: boolean;
	alertMode?: "off" | "important-only" | "all";
	quietHours?: {
		enabled?: boolean;
		startMinute?: number;
		endMinute?: number;
		timezone?: string;
	} | null;
};

type SmsInboundBody = {
	target?: string;
	text?: string;
	agentId?: string;
	accountId?: string;
	sessionKey?: string;
	threadId?: string;
	queueIfBusy?: boolean;
};

export const createSmsPolicyStateStore = (
	resolveConfigDirPath: () => string,
): SmsPolicyStore => createSmsPolicyStore(resolveConfigDirPath);

function decodeTarget(raw: string): string | null {
	let decoded = "";
	try {
		decoded = decodeURIComponent(raw);
	} catch {
		return null;
	}
	return normalizeSmsPolicyTarget(decoded);
}

function parsePauseForMs(raw: unknown): number | null {
	if (typeof raw !== "number" || !Number.isFinite(raw)) {
		return null;
	}
	const value = Math.trunc(raw);
	if (value <= 0 || value > MAX_PAUSE_FOR_MS) {
		return null;
	}
	return value;
}

function toResponsePayload(resolution: SmsControlResolution, nowMs: number) {
	return {
		...resolution,
		policy: {
			...resolution.policy,
			pauseExpiresInMs:
				resolution.policy.paused && resolution.policy.pausedUntil
					? Math.max(resolution.policy.pausedUntil - nowMs, 0)
					: null,
		},
	};
}

function parseRoutingTarget(
	rawTarget: string,
): { normalizedTarget: string; routing: RoutingInfo } | null {
	const trimmed = rawTarget.trim();
	if (!trimmed) {
		return null;
	}

	const normalized = normalizeSmsPolicyTarget(trimmed);
	if (!normalized) {
		return null;
	}

	const separatorIndex = normalized.indexOf(":");
	let channel = "sms-macos";
	let peerId = normalized;
	if (separatorIndex > 0 && separatorIndex < normalized.length - 1) {
		const candidateChannel = normalized.slice(0, separatorIndex).trim();
		const candidatePeer = normalized.slice(separatorIndex + 1).trim();
		if (candidateChannel && candidatePeer) {
			channel = candidateChannel;
			peerId = candidatePeer;
		}
	}

	return {
		normalizedTarget: normalized,
		routing: {
			channel,
			peer: {
				kind: "dm",
				id: peerId,
			},
		},
	};
}

export const handleSmsApi = async (
	ctx: GatewayHttpContext,
	store: SmsPolicyStore,
	req: Request,
	url: URL,
): Promise<Response | null> => {
	if (url.pathname === "/api/sms/messages") {
		if (req.method !== "POST") {
			return new Response("Method Not Allowed", { status: 405 });
		}

		let body: SmsInboundBody;
		try {
			body = (await req.json()) as SmsInboundBody;
		} catch {
			return new Response("Invalid JSON body", { status: 400 });
		}

		const parsed = parseRoutingTarget(
			typeof body.target === "string" ? body.target : "",
		);
		if (!parsed) {
			return new Response("valid target required", { status: 400 });
		}
		const nowMs = Date.now();
		const text = typeof body.text === "string" ? body.text : "";
		const control = applySmsControlCommand({
			store,
			target: parsed.normalizedTarget,
			text,
			nowMs,
		});
		if (control.handled) {
			return new Response(
				JSON.stringify(
					{
						kind: "command",
						...toResponsePayload(control, nowMs),
					},
					null,
					2,
				),
				{
					headers: { "Content-Type": "application/json" },
				},
			);
		}
		if (!control.passThroughText.trim()) {
			return new Response("text required", { status: 400 });
		}
		if (control.policy.stopEnabled) {
			return new Response(
				JSON.stringify(
					{
						kind: "stopped",
						responseText:
							"SMS chat is stopped for this sender. Re-enable in Wingman settings/API.",
						policy: control.policy,
					},
					null,
					2,
				),
				{
					headers: { "Content-Type": "application/json" },
				},
			);
		}

		const routing: RoutingInfo = {
			...parsed.routing,
		};
		if (typeof body.accountId === "string" && body.accountId.trim()) {
			routing.accountId = body.accountId.trim();
		}
		if (typeof body.threadId === "string" && body.threadId.trim()) {
			routing.threadId = body.threadId.trim();
		}

		const selectedAgentId = ctx.router.selectAgent(
			typeof body.agentId === "string" ? body.agentId.trim() : undefined,
			routing,
		);
		if (!selectedAgentId) {
			return new Response("Unable to resolve agent", { status: 400 });
		}
		const explicitSessionKey =
			typeof body.sessionKey === "string" ? body.sessionKey.trim() : "";
		const sessionKey =
			explicitSessionKey ||
			ctx.router.buildSessionKey(selectedAgentId, routing);
		const request: AgentRequestPayload = {
			agentId: selectedAgentId,
			content: control.passThroughText,
			routing,
			sessionKey,
		};
		if (typeof body.queueIfBusy === "boolean") {
			request.queueIfBusy = body.queueIfBusy;
		}

		return new Response(
			JSON.stringify(
				{
					kind: "agent",
					target: parsed.normalizedTarget,
					policy: control.policy,
					request,
				},
				null,
				2,
			),
			{
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	if (url.pathname === "/api/sms/policies" && req.method === "GET") {
		const targetRaw = url.searchParams.get("target");
		if (targetRaw) {
			const target = normalizeSmsPolicyTarget(targetRaw);
			if (!target) {
				return new Response("valid target query required", { status: 400 });
			}
			const record = store.resolve(target);
			return new Response(JSON.stringify(record, null, 2), {
				headers: { "Content-Type": "application/json" },
			});
		}
		const policies = store.list();
		return new Response(JSON.stringify({ policies }, null, 2), {
			headers: { "Content-Type": "application/json" },
		});
	}

	const commandMatch = url.pathname.match(
		/^\/api\/sms\/policies\/([^/]+)\/command$/,
	);
	if (commandMatch) {
		if (req.method !== "POST") {
			return new Response("Method Not Allowed", { status: 405 });
		}
		const target = decodeTarget(commandMatch[1]);
		if (!target) {
			return new Response("valid target required", { status: 400 });
		}
		let body: { text?: string; nowMs?: number };
		try {
			body = (await req.json()) as { text?: string; nowMs?: number };
		} catch {
			return new Response("Invalid JSON body", { status: 400 });
		}
		const text = typeof body.text === "string" ? body.text : "";
		const nowMs =
			typeof body.nowMs === "number" && Number.isFinite(body.nowMs)
				? Math.trunc(body.nowMs)
				: Date.now();
		const result = applySmsControlCommand({
			store,
			target,
			text,
			nowMs,
		});
		return new Response(
			JSON.stringify(toResponsePayload(result, nowMs), null, 2),
			{
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	const targetMatch = url.pathname.match(/^\/api\/sms\/policies\/([^/]+)$/);
	if (!targetMatch) {
		return null;
	}
	const target = decodeTarget(targetMatch[1]);
	if (!target) {
		return new Response("valid target required", { status: 400 });
	}

	if (req.method === "GET") {
		return new Response(JSON.stringify(store.resolve(target), null, 2), {
			headers: { "Content-Type": "application/json" },
		});
	}

	if (req.method === "DELETE") {
		store.reset(target);
		return new Response(JSON.stringify(store.resolve(target), null, 2), {
			headers: { "Content-Type": "application/json" },
		});
	}

	if (req.method !== "PUT") {
		return new Response("Method Not Allowed", { status: 405 });
	}

	let body: SmsPolicyBody;
	try {
		body = (await req.json()) as SmsPolicyBody;
	} catch {
		return new Response("Invalid JSON body", { status: 400 });
	}

	const patch: SmsPolicyPatch = {};
	const hasPauseForMs = Object.hasOwn(body ?? {}, "pauseForMs");
	if (hasPauseForMs) {
		const duration = parsePauseForMs(body.pauseForMs);
		if (duration === null) {
			return new Response("pauseForMs must be a positive duration", {
				status: 400,
			});
		}
		const nowMs = Date.now();
		patch.paused = true;
		patch.pausedUntil = nowMs + duration;
	}
	if (typeof body.paused === "boolean") {
		patch.paused = body.paused;
	}
	if (Object.hasOwn(body ?? {}, "pausedUntil")) {
		const value = body.pausedUntil;
		if (value === null) {
			patch.paused = false;
			patch.pausedUntil = null;
		} else if (typeof value === "number" && Number.isFinite(value)) {
			patch.paused = true;
			patch.pausedUntil = Math.trunc(value);
		} else {
			return new Response("pausedUntil must be a number or null", {
				status: 400,
			});
		}
	}
	if (typeof body.stopEnabled === "boolean") {
		patch.stopEnabled = body.stopEnabled;
	}
	if (
		body.alertMode === "off" ||
		body.alertMode === "important-only" ||
		body.alertMode === "all"
	) {
		patch.alertMode = body.alertMode;
	}
	if (Object.hasOwn(body ?? {}, "quietHours")) {
		patch.quietHours = body.quietHours ?? null;
	}

	const updated = store.upsert(target, patch);
	return new Response(JSON.stringify(updated, null, 2), {
		headers: { "Content-Type": "application/json" },
	});
};
