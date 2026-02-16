export function resolveSandboxName(request: Request): string {
	const headerName = request.headers.get("x-wingman-sandbox")?.trim();
	if (headerName) {
		return headerName;
	}

	const hostname = new URL(request.url).hostname;
	const normalized = hostname.replace(/[^a-zA-Z0-9-]/g, "-");
	return `wingman-${normalized || "default"}`;
}
