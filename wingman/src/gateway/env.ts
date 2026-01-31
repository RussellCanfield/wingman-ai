export const GATEWAY_TOKEN_ENV = "WINGMAN_GATEWAY_TOKEN";

export function getGatewayTokenFromEnv(): string | undefined {
	const raw = process.env[GATEWAY_TOKEN_ENV];
	if (!raw) {
		return undefined;
	}
	const token = raw.trim();
	return token.length > 0 ? token : undefined;
}
