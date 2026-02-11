const INTERNAL_TOOL_ENVELOPE_MARKERS: RegExp[] = [
	/assistant\s+to=[a-z0-9_.:-]+/i,
	/to=multi_tool_use(?:\.[a-z_]+)?/i,
	/\btool_uses\b\s*[:=]\s*\[/i,
	/\brecipient_name\b\s*[:=]\s*["']functions\.[^"'\s]+/i,
	/\bparameters\b\s*[:=]\s*\{/i,
	/\bjson\s*\{/i,
];

export function sanitizeAssistantDisplayText(
	text: string | undefined,
): string | undefined {
	if (typeof text !== "string") return undefined;
	if (!text.trim()) return undefined;

	let envelopeStart = -1;
	for (const marker of INTERNAL_TOOL_ENVELOPE_MARKERS) {
		const markerIndex = text.search(marker);
		if (markerIndex < 0) continue;
		envelopeStart =
			envelopeStart < 0 ? markerIndex : Math.min(envelopeStart, markerIndex);
	}

	if (envelopeStart === 0 && isLikelyInternalToolEnvelope(text)) {
		return undefined;
	}

	if (
		envelopeStart > 0 &&
		isLikelyInternalToolEnvelope(text.slice(envelopeStart))
	) {
		const prefix = text.slice(0, envelopeStart).replace(/\s+$/, "");
		return prefix.length > 0 ? prefix : undefined;
	}

	return text;
}

function isLikelyInternalToolEnvelope(value: string): boolean {
	const normalized = value.trim();
	if (!normalized) return false;
	if (/^assistant\s+to=[a-z0-9_.:-]+\b/i.test(normalized)) return true;
	if (
		/^\{?[\s\S]*\btool_uses\b\s*[:=]\s*\[[\s\S]*\brecipient_name\b\s*[:=]\s*["']functions\.[^"'\s]+/i.test(
			normalized,
		)
	) {
		return true;
	}

	let markerCount = 0;
	for (const marker of INTERNAL_TOOL_ENVELOPE_MARKERS) {
		if (marker.test(value)) markerCount += 1;
	}
	return markerCount >= 2;
}
