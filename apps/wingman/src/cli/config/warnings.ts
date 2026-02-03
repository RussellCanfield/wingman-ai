import type { WingmanConfigType } from "./schema.js";

export type ConfigWarning = {
	code: string;
	message: string;
};

const AGENT_PREFIX = /^agent:[^:]+:/;

const hasLeadingOrTrailingWhitespace = (value: string): boolean =>
	value.trim() !== value;

const isBlank = (value: string): boolean => value.trim().length === 0;

export function collectConfigWarnings(config: WingmanConfigType): ConfigWarning[] {
	const warnings: ConfigWarning[] = [];
	const discord = config.gateway?.adapters?.discord;
	if (!discord?.enabled) {
		return warnings;
	}

	if (!discord.token) {
		warnings.push({
			code: "discord-token-missing",
			message:
				"gateway.adapters.discord.enabled is true but gateway.adapters.discord.token is not set; the adapter will not start.",
		});
	}

	if (isBlank(discord.sessionCommand || "")) {
		warnings.push({
			code: "discord-session-command-blank",
			message:
				'gateway.adapters.discord.sessionCommand is blank; it will fall back to "!session".',
		});
	}

	for (const [rawKey, rawValue] of Object.entries(
		discord.channelSessions ?? {},
	)) {
		const keyLabel = JSON.stringify(rawKey);
		const value = typeof rawValue === "string" ? rawValue : "";
		const valueLabel = JSON.stringify(value);

		if (hasLeadingOrTrailingWhitespace(rawKey)) {
			warnings.push({
				code: "discord-channel-sessions-key-whitespace",
				message: `gateway.adapters.discord.channelSessions key ${keyLabel} has leading/trailing whitespace.`,
			});
		}

		if (hasLeadingOrTrailingWhitespace(value)) {
			warnings.push({
				code: "discord-channel-sessions-value-whitespace",
				message: `gateway.adapters.discord.channelSessions[${keyLabel}] value ${valueLabel} has leading/trailing whitespace.`,
			});
		}

		if (isBlank(value)) {
			warnings.push({
				code: "discord-channel-sessions-value-blank",
				message: `gateway.adapters.discord.channelSessions[${keyLabel}] is empty; mapping will fall back to derived session keys.`,
			});
			continue;
		}

		if (!AGENT_PREFIX.test(value.trim())) {
			warnings.push({
				code: "discord-channel-sessions-missing-agent",
				message:
					`gateway.adapters.discord.channelSessions[${keyLabel}] does not include an agent prefix (agent:<id>:...); ` +
					"agent selection will use bindings/default.",
			});
		}
	}

	for (const entry of discord.allowedChannels ?? []) {
		const label = JSON.stringify(entry);
		if (isBlank(entry)) {
			warnings.push({
				code: "discord-allowed-channels-blank",
				message:
					"gateway.adapters.discord.allowedChannels contains a blank entry; remove empty strings.",
			});
			continue;
		}
		if (hasLeadingOrTrailingWhitespace(entry)) {
			warnings.push({
				code: "discord-allowed-channels-whitespace",
				message: `gateway.adapters.discord.allowedChannels contains ${label} with leading/trailing whitespace.`,
			});
		}
	}

	for (const entry of discord.allowedGuilds ?? []) {
		const label = JSON.stringify(entry);
		if (isBlank(entry)) {
			warnings.push({
				code: "discord-allowed-guilds-blank",
				message:
					"gateway.adapters.discord.allowedGuilds contains a blank entry; remove empty strings.",
			});
			continue;
		}
		if (hasLeadingOrTrailingWhitespace(entry)) {
			warnings.push({
				code: "discord-allowed-guilds-whitespace",
				message: `gateway.adapters.discord.allowedGuilds contains ${label} with leading/trailing whitespace.`,
			});
		}
	}

	return warnings;
}
