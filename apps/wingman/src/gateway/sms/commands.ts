const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MAX_PAUSE_DURATION_MS = 30 * DAY_MS;

export type SmsControlCommand =
	| {
			name: "pause";
			durationMs: number | null;
	  }
	| {
			name: "resume" | "status" | "help" | "stop";
	  };

export type SmsInboundInterpretation =
	| {
			type: "text";
			content: string;
	  }
	| {
			type: "command";
			command: SmsControlCommand;
	  };

function parsePauseDurationMs(raw: string): number | null {
	const trimmed = raw.trim();
	const match = trimmed.match(/^(\d+)\s*([mhd])$/i);
	if (!match) {
		return null;
	}

	const amount = Number(match[1]);
	if (!Number.isInteger(amount) || amount <= 0) {
		return null;
	}

	const unit = match[2].toLowerCase();
	const multiplier = unit === "m" ? MINUTE_MS : unit === "h" ? HOUR_MS : DAY_MS;
	const durationMs = amount * multiplier;
	if (durationMs <= 0 || durationMs > MAX_PAUSE_DURATION_MS) {
		return null;
	}

	return durationMs;
}

export function interpretSmsInboundMessage(
	raw: string,
): SmsInboundInterpretation {
	const trimmed = raw.trim();
	if (!trimmed) {
		return {
			type: "text",
			content: "",
		};
	}

	if (trimmed.startsWith("\\")) {
		return {
			type: "text",
			content: trimmed.slice(1).trimStart(),
		};
	}

	const normalized = trimmed.toLowerCase();
	if (normalized === "help") {
		return { type: "command", command: { name: "help" } };
	}
	if (normalized === "status") {
		return { type: "command", command: { name: "status" } };
	}
	if (normalized === "resume") {
		return { type: "command", command: { name: "resume" } };
	}
	if (normalized === "stop") {
		return { type: "command", command: { name: "stop" } };
	}

	const pauseMatch = trimmed.match(/^pause(?:\s+(.+))?$/i);
	if (pauseMatch) {
		const durationRaw = pauseMatch[1]?.trim();
		if (!durationRaw) {
			return {
				type: "command",
				command: {
					name: "pause",
					durationMs: null,
				},
			};
		}
		const durationMs = parsePauseDurationMs(durationRaw);
		if (durationMs !== null) {
			return {
				type: "command",
				command: {
					name: "pause",
					durationMs,
				},
			};
		}
	}

	return {
		type: "text",
		content: trimmed,
	};
}

export function buildSmsHelpMessage(): string {
	return [
		"Commands:",
		"- STATUS",
		"- PAUSE [15m|2h|1d]",
		"- RESUME",
		"- STOP",
		"- HELP",
		'Use "\\<command>" to send a command word as normal text.',
	].join("\n");
}
