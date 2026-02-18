export function normalizeSmsAllowlistEntry(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return "";
	return trimmed.toLowerCase();
}

export function normalizeSmsAllowlist(entries: unknown): string[] {
	if (!Array.isArray(entries)) return [];
	const seen = new Set<string>();
	const normalized: string[] = [];
	for (const entry of entries) {
		if (typeof entry !== "string") continue;
		const value = normalizeSmsAllowlistEntry(entry);
		if (!value || seen.has(value)) continue;
		seen.add(value);
		normalized.push(value);
	}
	return normalized;
}

export function parseSmsAllowlistInput(input: string): string[] {
	const parts = input
		.split(/[\n,]+/g)
		.map((entry) => normalizeSmsAllowlistEntry(entry))
		.filter(Boolean);
	return normalizeSmsAllowlist(parts);
}

export function formatSmsAllowlist(entries: string[]): string {
	return normalizeSmsAllowlist(entries).join("\n");
}

export function resolveSmsBridgeTestHandle(entries: string[]): string | null {
	const normalized = normalizeSmsAllowlist(entries);
	return normalized[0] || null;
}
