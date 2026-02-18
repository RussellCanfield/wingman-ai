export function summarizeGatewayConnectionFailure(detail: string): string {
	const normalized = detail.toLowerCase();

	if (
		normalized.includes("load failed") ||
		normalized.includes("failed to fetch") ||
		normalized.includes("networkerror") ||
		normalized.includes("typeerror")
	) {
		return "Gateway unreachable. Verify URL and that gateway is running.";
	}

	if (
		normalized.includes("auth") ||
		normalized.includes("unauthorized") ||
		normalized.includes("forbidden") ||
		normalized.includes("401") ||
		normalized.includes("403")
	) {
		return "Gateway authentication failed. Check token/password.";
	}

	if (normalized.includes("invalid gateway url")) {
		return "Invalid gateway URL.";
	}

	return "Gateway request failed.";
}

