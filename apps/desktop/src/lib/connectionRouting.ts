import type { ConnectionStatus } from "./gatewayModels.js";

export function shouldRouteToGatewayOnFailure(
	status: ConnectionStatus,
	message: string,
): boolean {
	if (status !== "disconnected") return false;
	const normalized = message.trim().toLowerCase();
	if (!normalized) return false;
	if (normalized === "disconnected") return false;
	if (normalized === "not connected to gateway") return false;
	return true;
}
