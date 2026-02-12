const INTERNAL_TOOL_ENVELOPE_MARKERS: RegExp[] = [
	/assistant\s+to=[a-z0-9_.:-]+/i,
	/to=multi_tool_use(?:\.[a-z_]+)?/i,
	/["']?tool_uses["']?\s*[:=]\s*\[/i,
	/["']?recipient_name["']?\s*[:=]\s*["']functions\.[^"'\s]+/i,
	/["']?parameters["']?\s*[:=]\s*\{/i,
	/\bjson\s*\{/i,
];

type SanitizeAssistantDisplayTextOptions = {
	preserveTrailingWhitespace?: boolean;
};

export function sanitizeAssistantDisplayText(
	text: string | undefined,
	options?: SanitizeAssistantDisplayTextOptions,
): string | undefined {
	if (typeof text !== "string") return undefined;
	const cleanedText = stripDisplayNoise(
		text,
		options?.preserveTrailingWhitespace,
	);
	if (!cleanedText.trim()) return undefined;
	const trimmedStart = cleanedText.trimStart();
	if (
		/^[{[]/.test(trimmedStart) &&
		isLikelyInternalToolEnvelope(trimmedStart)
	) {
		return undefined;
	}
	if (/^assistant\s+to=[a-z0-9_.:-]+\b/i.test(trimmedStart)) {
		return undefined;
	}

	let envelopeStart = -1;
	for (const marker of INTERNAL_TOOL_ENVELOPE_MARKERS) {
		const markerIndex = cleanedText.search(marker);
		if (markerIndex < 0) continue;
		envelopeStart =
			envelopeStart < 0 ? markerIndex : Math.min(envelopeStart, markerIndex);
	}

	if (envelopeStart === 0 && isLikelyInternalToolEnvelope(cleanedText)) {
		return undefined;
	}

	if (
		envelopeStart > 0 &&
		(() => {
			let adjustedStart = envelopeStart;
			if (cleanedText.charAt(adjustedStart - 1) === "{") {
				adjustedStart -= 1;
			}
			return isLikelyInternalToolEnvelope(cleanedText.slice(adjustedStart));
		})()
	) {
		let adjustedStart = envelopeStart;
		if (cleanedText.charAt(adjustedStart - 1) === "{") {
			adjustedStart -= 1;
		}
		const preserveTrailingWhitespace =
			options?.preserveTrailingWhitespace === true;
		const prefix = stripDisplayNoise(
			cleanedText.slice(0, adjustedStart),
			preserveTrailingWhitespace,
		);
		return prefix.length > 0 ? prefix : undefined;
	}

	return cleanedText;
}

function isLikelyInternalToolEnvelope(value: string): boolean {
	const normalized = value.trim();
	if (!normalized) return false;
	if (/^assistant\s+to=[a-z0-9_.:-]+\b/i.test(normalized)) return true;
	if (/^\{[\s\S]*["']?tool_uses["']?\s*[:=]/i.test(normalized)) return true;
	if (
		/^\{?[\s\S]*["']?tool_uses["']?\s*[:=]\s*\[[\s\S]*["']?recipient_name["']?\s*[:=]\s*["']functions\.[^"'\s]+/i.test(
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

function stripDisplayNoise(
	value: string,
	preserveTrailingWhitespace = false,
): string {
	const trailingWhitespace = preserveTrailingWhitespace
		? value.match(/\s+$/)?.[0] || ""
		: "";
	let output = value.replace(/\r\n?/g, "\n");
	output = stripAsciiControlChars(output);
	output = output.replace(/\uFFFD/g, "");
	output = stripTrailingSymbolNoise(output);
	if (preserveTrailingWhitespace && trailingWhitespace) {
		return `${output}${trailingWhitespace}`;
	}
	return output.replace(/\s+$/, "");
}

function stripTrailingSymbolNoise(value: string): string {
	const lines = value.split("\n");
	while (lines.length > 0) {
		const tail = lines[lines.length - 1]?.trim() || "";
		if (!tail) {
			lines.pop();
			continue;
		}
		if (isSymbolNoiseToken(tail)) {
			lines.pop();
			continue;
		}
		break;
	}

	let output = lines.join("\n");
	output = output.replace(/(^|[\s.,;:!?()[\]{}'"-])[#+]{6,}\s*$/g, "$1");
	return output.replace(/\s+$/, "");
}

function isSymbolNoiseToken(value: string): boolean {
	return value.length >= 6 && /^[#+]+$/.test(value);
}

function stripAsciiControlChars(value: string): string {
	let output = "";
	for (const char of value) {
		const code = char.charCodeAt(0);
		const isControl = (code >= 0x00 && code <= 0x1f) || code === 0x7f;
		const isAllowedWhitespace = code === 0x09 || code === 0x0a || code === 0x0d;
		if (isControl && !isAllowedWhitespace) continue;
		output += char;
	}
	return output;
}
