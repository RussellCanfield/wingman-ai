import {
	buildSmsHelpMessage,
	interpretSmsInboundMessage,
	type SmsControlCommand,
} from "./commands.js";
import type { SmsPolicyRecord, SmsPolicyStore } from "./policyStore.js";

export type SmsControlResolution =
	| {
			handled: false;
			passThroughText: string;
			policy: SmsPolicyRecord;
	  }
	| {
			handled: true;
			command: SmsControlCommand;
			responseText: string;
			policy: SmsPolicyRecord;
	  };

function formatPauseRemaining(untilMs: number, nowMs: number): string {
	const remaining = Math.max(untilMs - nowMs, 0);
	const totalMinutes = Math.ceil(remaining / 60_000);
	if (totalMinutes < 60) {
		return `${totalMinutes}m`;
	}
	const hours = Math.ceil(totalMinutes / 60);
	if (hours < 24) {
		return `${hours}h`;
	}
	const days = Math.ceil(hours / 24);
	return `${days}d`;
}

function formatPolicyStatus(policy: SmsPolicyRecord, nowMs: number): string {
	const lines = [
		`SMS status for ${policy.target}:`,
		`- stop: ${policy.stopEnabled ? "enabled" : "disabled"}`,
	];

	if (policy.paused) {
		if (policy.pausedUntil) {
			lines.push(
				`- proactive alerts: paused (${formatPauseRemaining(policy.pausedUntil, nowMs)} remaining)`,
			);
		} else {
			lines.push("- proactive alerts: paused (until RESUME)");
		}
	} else {
		lines.push("- proactive alerts: active");
	}
	lines.push(`- alert mode: ${policy.alertMode}`);
	return lines.join("\n");
}

export function applySmsControlCommand(params: {
	store: SmsPolicyStore;
	target: string;
	text: string;
	nowMs?: number;
}): SmsControlResolution {
	const { store, target, text, nowMs = Date.now() } = params;
	const parsed = interpretSmsInboundMessage(text);
	if (parsed.type === "text") {
		return {
			handled: false,
			passThroughText: parsed.content,
			policy: store.resolve(target, nowMs),
		};
	}

	const command = parsed.command;
	if (command.name === "help") {
		const policy = store.resolve(target, nowMs);
		return {
			handled: true,
			command,
			responseText: buildSmsHelpMessage(),
			policy,
		};
	}
	if (command.name === "status") {
		const policy = store.resolve(target, nowMs);
		return {
			handled: true,
			command,
			responseText: formatPolicyStatus(policy, nowMs),
			policy,
		};
	}
	if (command.name === "pause") {
		const pausedUntil =
			typeof command.durationMs === "number"
				? nowMs + command.durationMs
				: null;
		const policy = store.upsert(
			target,
			{
				paused: true,
				pausedUntil,
			},
			nowMs,
		);
		return {
			handled: true,
			command,
			responseText: pausedUntil
				? `Proactive SMS alerts paused for ${formatPauseRemaining(pausedUntil, nowMs)}.`
				: "Proactive SMS alerts paused until you send RESUME.",
			policy,
		};
	}
	if (command.name === "resume") {
		const policy = store.upsert(
			target,
			{
				paused: false,
				pausedUntil: null,
			},
			nowMs,
		);
		return {
			handled: true,
			command,
			responseText: "Proactive SMS alerts resumed.",
			policy,
		};
	}

	const policy = store.upsert(
		target,
		{
			stopEnabled: true,
		},
		nowMs,
	);
	return {
		handled: true,
		command,
		responseText:
			"SMS chat is now stopped for this sender. Re-enable in Wingman settings/API.",
		policy,
	};
}
