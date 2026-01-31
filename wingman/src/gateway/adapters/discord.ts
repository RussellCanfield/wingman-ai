import {
	ChannelType,
	Client,
	GatewayIntentBits,
	Partials,
	type Message,
	type TextBasedChannel,
} from "discord.js";
import { createLogger, type Logger } from "@/logger.js";
import type { AgentRequestPayload, RoutingInfo } from "../types.js";
import { GatewayRpcClient } from "../rpcClient.js";
import { parseStreamChunk } from "../../cli/core/streamParser.js";

type SendableChannel = {
	send: (content: string) => Promise<unknown>;
	sendTyping?: () => Promise<unknown>;
};

export interface DiscordAdapterConfig {
	enabled: boolean;
	token?: string;
	mentionOnly: boolean;
	allowBots: boolean;
	allowedGuilds: string[];
	allowedChannels: string[];
	channelSessions?: Record<string, string>;
	sessionCommand: string;
	gatewayUrl?: string;
	gatewayToken?: string;
	gatewayPassword?: string;
	responseChunkSize: number;
}

export interface DiscordAdapterGatewayConfig {
	url: string;
	token?: string;
	password?: string;
}

export const DEFAULT_DISCORD_RESPONSE_CHUNK = 1900;

export function splitDiscordMessage(text: string, maxLength = DEFAULT_DISCORD_RESPONSE_CHUNK): string[] {
	const normalized = text.trim();
	if (!normalized) {
		return [];
	}
	const chunks: string[] = [];
	let current = "";
	for (const char of normalized) {
		if (current.length + 1 > maxLength) {
			chunks.push(current);
			current = "";
		}
		current += char;
	}
	if (current) {
		chunks.push(current);
	}
	return chunks;
}

export function stripDiscordBotMention(content: string, botId: string): string {
	if (!content) {
		return content;
	}
	const mention = new RegExp(`<@!?${botId}>`, "g");
	return content.replace(mention, "").trim();
}

export function extractSessionOverride(
	content: string,
	command: string,
): { sessionKey?: string; content: string; matched: boolean } {
	const trimmed = content.trim();
	if (!command || !trimmed.toLowerCase().startsWith(command.toLowerCase())) {
		return { content, matched: false };
	}
	const withoutCommand = trimmed.slice(command.length).trim();
	if (!withoutCommand) {
		return { content: "", matched: true };
	}
	const [sessionKey, ...rest] = withoutCommand.split(/\s+/);
	return { sessionKey, content: rest.join(" "), matched: true };
}

export function resolveDiscordChannelSessionKey(
	channelId: string,
	channelSessions?: Record<string, string>,
	parentChannelId?: string,
): string | undefined {
	if (!channelSessions) {
		return undefined;
	}
	const direct = channelSessions[channelId];
	if (direct) {
		return direct;
	}
	if (parentChannelId) {
		return channelSessions[parentChannelId];
	}
	return undefined;
}

export function parseAgentIdFromSessionKey(sessionKey?: string): string | undefined {
	if (!sessionKey) {
		return undefined;
	}
	const match = sessionKey.match(/^agent:([^:]+):/);
	return match?.[1];
}

function buildRoutingInfo(message: Message, botUserId: string): RoutingInfo {
	const routing: RoutingInfo = {
		channel: "discord",
		accountId: botUserId,
	};

	if (message.guildId) {
		routing.guildId = message.guildId;
	}

	const channel = message.channel;
	if (channel.isDMBased()) {
		if (channel.type === ChannelType.DM) {
			routing.peer = { kind: "dm", id: message.author.id };
		} else {
			routing.peer = { kind: "group", id: channel.id };
		}
		return routing;
	}

	if (channel.isThread()) {
		routing.threadId = channel.id;
		routing.peer = {
			kind: "channel",
			id: channel.parentId || channel.id,
		};
		return routing;
	}

	routing.peer = { kind: "channel", id: channel.id };
	return routing;
}

export class DiscordGatewayAdapter {
	private client: Client | null = null;
	private gatewayClient: GatewayRpcClient | null = null;
	private logger: Logger;
	private started = false;

	constructor(
		private config: DiscordAdapterConfig,
		private gateway: DiscordAdapterGatewayConfig,
		logger?: Logger,
	) {
		this.logger = logger || createLogger();
	}

	async start(): Promise<void> {
		if (this.started) {
			return;
		}
		if (!this.config.enabled) {
			return;
		}
		if (!this.config.token) {
			this.logger.warn("Discord adapter enabled but no token configured.");
			return;
		}

		this.gatewayClient = new GatewayRpcClient(this.gateway.url, {
			token: this.gateway.token,
			password: this.gateway.password,
			clientType: "discord",
		});

		await this.gatewayClient.connect();

		this.client = new Client({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.DirectMessages,
				GatewayIntentBits.MessageContent,
			],
			partials: [Partials.Channel],
		});

		this.client.on("clientReady", () => {
			this.logger.info("Discord adapter connected.");
		});

		this.client.on("error", (error) => {
			this.logger.error("Discord adapter error", error);
		});

		this.client.on("messageCreate", (message) => {
			void this.handleMessage(message);
		});

		await this.client.login(this.config.token);
		this.started = true;
	}

	async stop(): Promise<void> {
		if (!this.started) {
			return;
		}
		this.started = false;

		if (this.client) {
			await this.client.destroy();
			this.client = null;
		}

		if (this.gatewayClient) {
			this.gatewayClient.disconnect();
			this.gatewayClient = null;
		}
	}

	private async handleMessage(message: Message): Promise<void> {
		if (!this.client || !this.gatewayClient) {
			return;
		}
		if (!message.content && message.attachments.size === 0) {
			return;
		}
		if (message.author.bot) {
			if (!this.config.allowBots) {
				return;
			}
			if (message.author.id === this.client.user?.id) {
				return;
			}
		}

		const botUserId = this.client.user?.id;
		if (!botUserId) {
			return;
		}

		if (!message.channel.isTextBased()) {
			return;
		}
		const channel = message.channel as TextBasedChannel;
		if (!("send" in channel)) {
			return;
		}
		const sendChannel = channel as SendableChannel;

		if (this.config.allowedGuilds.length > 0 && message.guildId) {
			if (!this.config.allowedGuilds.includes(message.guildId)) {
				return;
			}
		}

		if (this.config.allowedChannels.length > 0) {
			if (!this.config.allowedChannels.includes(message.channelId)) {
				return;
			}
		}

		const isDm = message.channel.isDMBased();
		const mentioned = message.mentions.has(botUserId);
		if (this.config.mentionOnly && !isDm && !mentioned) {
			return;
		}

		const cleaned = stripDiscordBotMention(message.content || "", botUserId);
		const attachments = Array.from(message.attachments.values()).map(
			(attachment) => attachment.url,
		);
		const attachmentText =
			attachments.length > 0
				? `\n\nAttachments:\n${attachments.map((url) => `- ${url}`).join("\n")}`
				: "";

		let content = `${cleaned}${attachmentText}`.trim();
		const { sessionKey, content: nextContent, matched } = extractSessionOverride(
			content,
			this.config.sessionCommand,
		);
		let resolvedSessionKey = sessionKey;
		let usedChannelMapping = false;
		if (matched) {
			content = nextContent.trim();
			if (!sessionKey) {
				await sendChannel.send(
					`Provide a session key after \`${this.config.sessionCommand}\`.`,
				);
				return;
			}
		}
		if (!matched) {
			const parentChannelId = message.channel.isThread()
				? message.channel.parentId ?? undefined
				: undefined;
			resolvedSessionKey = resolveDiscordChannelSessionKey(
				message.channelId,
				this.config.channelSessions,
				parentChannelId,
			);
			usedChannelMapping = Boolean(resolvedSessionKey);
		}
		const inferredAgentId = parseAgentIdFromSessionKey(resolvedSessionKey);
		if (usedChannelMapping && !inferredAgentId) {
			this.logger.warn(
				`Discord channel session mapping for channel ${message.channelId} does not include an agent prefix. ` +
					'Use "agent:<id>:..." to auto-select an agent.',
				{ sessionKey: resolvedSessionKey },
			);
		}

		if (!content) {
			return;
		}

		const payload: AgentRequestPayload = {
			agentId: inferredAgentId,
			content,
			routing: buildRoutingInfo(message, botUserId),
			sessionKey: resolvedSessionKey,
		};

		try {
			if (sendChannel.sendTyping) {
				await sendChannel.sendTyping();
			}

			let fallbackText = "";
			const textByMessageId = new Map<string, string>();
			const messageOrder: string[] = [];

			await this.gatewayClient.requestAgent(payload, (event) => {
				if (!event || typeof event !== "object") {
					return;
				}
				if ((event as any).type === "agent-error") {
					fallbackText += `\n${(event as any).error || "Agent error"}`;
					return;
				}
				if ((event as any).type !== "agent-stream") {
					return;
				}
				const parsedChunks = parseStreamChunk((event as any).chunk);
				for (const chunk of parsedChunks) {
					if (chunk.type !== "text" || !chunk.text) {
						continue;
					}
					if (chunk.messageId) {
						if (!textByMessageId.has(chunk.messageId)) {
							messageOrder.push(chunk.messageId);
							textByMessageId.set(chunk.messageId, chunk.text);
							continue;
						}
						const current = textByMessageId.get(chunk.messageId) || "";
						textByMessageId.set(
							chunk.messageId,
							chunk.isDelta ? current + chunk.text : chunk.text,
						);
						continue;
					}
					fallbackText += chunk.text;
				}
			});

			const orderedText = messageOrder
				.map((id) => textByMessageId.get(id))
				.filter((value): value is string => Boolean(value))
				.join("\n\n");
			const responseText = `${fallbackText}${fallbackText && orderedText ? "\n\n" : ""}${orderedText}`.trim();
			if (!responseText) {
				return;
			}

			const chunks = splitDiscordMessage(
				responseText,
				this.config.responseChunkSize,
			);
				for (const chunk of chunks) {
					await sendChannel.send(chunk);
				}
		} catch (error) {
			this.logger.error("Discord adapter failed to handle message", error);
			try {
				await sendChannel.send("Sorry, I hit an error running that request.");
			} catch {
				// Ignore failures when reporting the error.
			}
		}
	}
}
