import type { GatewaySettings } from "./gatewayModels.js";

export type { GatewaySettings };

const DEFAULT_GATEWAY_URL = "ws://127.0.0.1:18789/ws";

function normalizeValue(value: string | undefined): string {
	return (value || "").trim();
}

function normalizeLocalHostForClient(hostname: string): string {
	if (hostname === "0.0.0.0") return "127.0.0.1";
	if (hostname === "::" || hostname === "[::]") return "::1";
	return hostname;
}

export function normalizeGatewaySettings(
	input: Partial<GatewaySettings>,
): GatewaySettings {
	return {
		url: normalizeValue(input.url) || DEFAULT_GATEWAY_URL,
		uiUrl: normalizeValue(input.uiUrl),
		token: normalizeValue(input.token),
		password: normalizeValue(input.password),
		agentId: normalizeValue(input.agentId),
		sessionKey: normalizeValue(input.sessionKey),
	};
}

export function resolveGatewayUiUrl(settings: GatewaySettings): string {
	if (settings.uiUrl) return settings.uiUrl;
	const raw = settings.url;
	try {
		const url = new URL(raw);
		url.hostname = normalizeLocalHostForClient(url.hostname);
		if (url.protocol === "ws:") url.protocol = "http:";
		if (url.protocol === "wss:") url.protocol = "https:";
		if (url.pathname.endsWith("/ws")) {
			url.pathname = url.pathname.slice(0, -3) || "/";
		}
		return url.toString().replace(/\/$/, "");
	} catch {
		return "";
	}
}

export function isGatewayConfigValid(settings: GatewaySettings): boolean {
	try {
		// URL validation is enough for local guardrails. Runtime connection checks
		// happen in the Rust shell.
		new URL(settings.url);
		return true;
	} catch {
		return false;
	}
}
