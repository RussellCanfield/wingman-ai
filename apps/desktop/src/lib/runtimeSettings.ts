import {
	normalizeGatewaySettings,
	type GatewaySettings,
} from "./gatewayConfig.js";

function preferExistingOnBlank(existing: string, incoming: string | undefined): string {
	if (typeof incoming !== "string") return existing;
	const trimmed = incoming.trim();
	if (!trimmed) return existing;
	return trimmed;
}

export function mergeGatewaySettingsFromNative(
	existing: GatewaySettings,
	incoming: Partial<GatewaySettings> | undefined,
): GatewaySettings {
	if (!incoming) return existing;

	return normalizeGatewaySettings({
		url: preferExistingOnBlank(existing.url, incoming.url),
		uiUrl: preferExistingOnBlank(existing.uiUrl, incoming.uiUrl),
		token: preferExistingOnBlank(existing.token, incoming.token),
		password: preferExistingOnBlank(existing.password, incoming.password),
		agentId: preferExistingOnBlank(existing.agentId, incoming.agentId),
		sessionKey: preferExistingOnBlank(existing.sessionKey, incoming.sessionKey),
	});
}
