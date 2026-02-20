import {
	CloudAdapter,
	ConfigurationBotFrameworkAuthentication,
	type Activity,
	type TurnContext,
} from "botbuilder";
import { parseStreamChunk } from "@/cli/core/streamParser.js";
import { createLogger, type Logger } from "@/logger.js";
import type { AgentRequestPayload, RoutingInfo } from "../types.js";
import { GatewayRpcClient } from "../rpcClient.js";
import {
	extractSessionOverride,
	extractUiMeta,
	parseAgentIdFromSessionKey,
} from "./discord.js";

type TeamsMessageActivity = Activity & {
	text?: string;
};

type BotBuilderResponse = {
	status: (code: number) => BotBuilderResponse;
	header: (name: string, value: string) => BotBuilderResponse;
	send: (body?: unknown) => void;
	end: (body?: unknown) => void;
	socket: unknown;
};

type ActivityEntity = {
	type?: string;
	text?: string;
	mentioned?: {
		id?: string;
		name?: string;
	};
};

export interface TeamsAdapterConfig {
	enabled: boolean;
	appId?: string;
	appPassword?: string;
	appType:
		| "MultiTenant"
		| "SingleTenant"
		| "UserAssignedMsi"
		| "UserAssignedMSI";
	tenantId?: string;
	endpointPath: string;
	mentionOnly: boolean;
	allowBots: boolean;
	allowedTeamIds: string[];
	allowedChannelIds: string[];
	channelSessions?: Record<string, string>;
	sessionCommand: string;
	gatewayUrl?: string;
	gatewayToken?: string;
	gatewayPassword?: string;
	responseChunkSize: number;
}

export interface TeamsAdapterGatewayConfig {
	url: string;
	token?: string;
	password?: string;
}

export const DEFAULT_TEAMS_ENDPOINT_PATH = "/api/adapters/teams/messages";
export const DEFAULT_TEAMS_RESPONSE_CHUNK = 3500;

export function normalizeTeamsEndpointPath(path: string | undefined): string {
	const fallback = DEFAULT_TEAMS_ENDPOINT_PATH;
	if (!path || typeof path !== "string") {
		return fallback;
	}
	const trimmed = path.trim();
	if (!trimmed) {
		return fallback;
	}
	return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function splitTeamsMessage(
	text: string,
	maxLength = DEFAULT_TEAMS_RESPONSE_CHUNK,
): string[] {
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

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getEntities(activity: Activity): ActivityEntity[] {
	if (!Array.isArray(activity.entities)) {
		return [];
	}
	return activity.entities as ActivityEntity[];
}

export function extractTeamsMentionTexts(
	activity: Activity,
	botAccountId?: string,
): string[] {
	const recipientName = activity.recipient?.name?.trim().toLowerCase();
	const texts = new Set<string>();
	for (const entity of getEntities(activity)) {
		if (entity.type !== "mention" || typeof entity.text !== "string") {
			continue;
		}
		const mentionedId = entity.mentioned?.id?.trim();
		const mentionedName = entity.mentioned?.name?.trim().toLowerCase();
		if (
			(botAccountId && mentionedId === botAccountId) ||
			(recipientName && mentionedName === recipientName)
		) {
			texts.add(entity.text);
		}
	}
	return Array.from(texts);
}

export function stripTeamsBotMention(
	content: string,
	mentionTexts: string[] = [],
): string {
	if (!content) {
		return content;
	}
	let next = content;
	for (const text of mentionTexts) {
		next = next.replace(new RegExp(escapeRegex(text), "gi"), " ");
	}
	return next.replace(/<at>.*?<\/at>/gi, " ").replace(/\s+/g, " ").trim();
}

export function isTeamsBotMentioned(
	activity: Activity,
	botAccountId?: string,
): boolean {
	if (extractTeamsMentionTexts(activity, botAccountId).length > 0) {
		return true;
	}
	const text = activity.text || "";
	const recipientName = activity.recipient?.name?.trim();
	if (recipientName) {
		const regex = new RegExp(`<at>\\s*${escapeRegex(recipientName)}\\s*</at>`, "i");
		return regex.test(text);
	}
	return false;
}

export function resolveTeamsChannelSessionKey(
	channelId: string,
	channelSessions?: Record<string, string>,
): string | undefined {
	if (!channelSessions) {
		return undefined;
	}
	return channelSessions[channelId];
}

function toHeaderRecord(headers: Headers): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [key, value] of headers.entries()) {
		result[key] = value;
	}
	if (!result.Authorization && result.authorization) {
		result.Authorization = result.authorization;
	}
	return result;
}

function buildBotBuilderResponse(resolve: (response: Response) => void): BotBuilderResponse {
	let statusCode = 200;
	const headers = new Headers();
	let body: string | undefined;

	const finalize = (payload?: unknown): void => {
		if (payload !== undefined) {
			if (typeof payload === "string") {
				body = payload;
			} else {
				body = JSON.stringify(payload);
				if (!headers.get("Content-Type")) {
					headers.set("Content-Type", "application/json");
				}
			}
		}
		resolve(
			new Response(body, {
				status: statusCode,
				headers,
			}),
		);
	};

	return {
		status(code: number) {
			statusCode = code;
			return this;
		},
		header(name: string, value: string) {
			headers.set(name, value);
			return this;
		},
		send(payload?: unknown) {
			finalize(payload);
		},
		end(payload?: unknown) {
			finalize(payload);
		},
		socket: {},
	};
}

function extractTeamId(activity: Activity): string | undefined {
	const raw = (activity.channelData as any)?.team?.id;
	if (typeof raw === "string" && raw.trim()) {
		return raw;
	}
	return undefined;
}

function extractChannelId(activity: Activity): string | undefined {
	const channelId = (activity.channelData as any)?.channel?.id;
	if (typeof channelId === "string" && channelId.trim()) {
		return channelId;
	}
	const conversationId = activity.conversation?.id;
	if (typeof conversationId === "string" && conversationId.trim()) {
		return conversationId;
	}
	return undefined;
}

function extractThreadId(activity: Activity): string | undefined {
	if (activity.replyToId && activity.replyToId.trim()) {
		return activity.replyToId;
	}
	const conversationId = activity.conversation?.id;
	if (!conversationId) {
		return undefined;
	}
	const match = conversationId.match(/;messageid=([^;]+)/i);
	if (!match?.[1]) {
		return undefined;
	}
	try {
		return decodeURIComponent(match[1]);
	} catch {
		return match[1];
	}
}

function isDirectMessage(activity: Activity): boolean {
	return activity.conversation?.conversationType === "personal";
}

function buildRoutingInfo(activity: Activity, botAccountId?: string): RoutingInfo {
	const routing: RoutingInfo = {
		channel: "teams",
		accountId: botAccountId,
	};

	const teamId = extractTeamId(activity);
	if (teamId) {
		routing.teamId = teamId;
	}

	const conversationType = activity.conversation?.conversationType;
	if (conversationType === "personal") {
		const dmId = activity.from?.aadObjectId || activity.from?.id;
		if (dmId) {
			routing.peer = { kind: "dm", id: dmId };
		}
	} else if (conversationType === "groupChat") {
		if (activity.conversation?.id) {
			routing.peer = { kind: "group", id: activity.conversation.id };
		}
	} else {
		const channelId = extractChannelId(activity);
		if (channelId) {
			routing.peer = { kind: "channel", id: channelId };
		}
	}

	const threadId = extractThreadId(activity);
	if (threadId) {
		routing.threadId = threadId;
	}

	return routing;
}

function isBotMessage(activity: Activity): boolean {
	return activity.from?.role === "bot";
}

export class TeamsGatewayAdapter {
	private adapter: CloudAdapter | null = null;
	private gatewayClient: GatewayRpcClient | null = null;
	private logger: Logger;
	private started = false;

	constructor(
		private config: TeamsAdapterConfig,
		private gateway: TeamsAdapterGatewayConfig,
		logger?: Logger,
	) {
		this.logger = logger || createLogger();
	}

	get endpointPath(): string {
		return normalizeTeamsEndpointPath(this.config.endpointPath);
	}

	async start(): Promise<void> {
		if (this.started) {
			return;
		}
		if (!this.config.enabled) {
			return;
		}
		if (!this.config.appId || !this.config.appPassword) {
			this.logger.warn(
				"Teams adapter enabled but Microsoft app credentials are incomplete.",
			);
			return;
		}

		this.gatewayClient = new GatewayRpcClient(this.gateway.url, {
			token: this.gateway.token,
			password: this.gateway.password,
			clientType: "teams",
		});
		await this.gatewayClient.connect();

		const authConfig: Record<string, string> = {
			MicrosoftAppId: this.config.appId,
			MicrosoftAppPassword: this.config.appPassword,
			MicrosoftAppType: this.config.appType,
		};
		if (this.config.tenantId) {
			authConfig.MicrosoftAppTenantId = this.config.tenantId;
		}

		const authentication = new ConfigurationBotFrameworkAuthentication(authConfig);
		this.adapter = new CloudAdapter(authentication);
		this.adapter.onTurnError = async (context, error) => {
			this.logger.error("Teams adapter turn error", error);
			try {
				await context.sendActivity("Sorry, I hit an error running that request.");
			} catch {
				// Ignore failures when reporting the error.
			}
		};
		this.started = true;
	}

	async stop(): Promise<void> {
		if (!this.started) {
			return;
		}
		this.started = false;
		this.adapter = null;
		if (this.gatewayClient) {
			this.gatewayClient.disconnect();
			this.gatewayClient = null;
		}
	}

	async handleHttpRequest(req: Request, url: URL): Promise<Response | null> {
		if (url.pathname !== this.endpointPath) {
			return null;
		}
		if (req.method !== "POST") {
			return new Response("Method Not Allowed", {
				status: 405,
				headers: { Allow: "POST" },
			});
		}
		if (!this.started || !this.adapter || !this.gatewayClient) {
			return new Response("Teams adapter not started", { status: 503 });
		}
		const adapter = this.adapter;

		let body: unknown;
		try {
			body = await req.json();
		} catch {
			return new Response("Invalid JSON payload", { status: 400 });
		}

		const activity = body as TeamsMessageActivity;
		return new Promise<Response>((resolve) => {
			const response = buildBotBuilderResponse(resolve);
			void adapter
				.process(
					{
						method: req.method,
						headers: toHeaderRecord(req.headers),
						body: activity,
					} as any,
					response as any,
					async (context) => this.handleMessage(context),
				)
				.catch((error) => {
					this.logger.error("Teams adapter failed to process request", error);
					resolve(new Response("Failed to process Teams request", { status: 500 }));
				});
		});
	}

	private async handleMessage(context: TurnContext): Promise<void> {
		if (!this.gatewayClient) {
			return;
		}

		const activity = context.activity as TeamsMessageActivity;
		if (activity.type !== "message") {
			return;
		}

		if (!activity.text && !activity.attachments?.length) {
			return;
		}
		if (isBotMessage(activity)) {
			if (!this.config.allowBots) {
				return;
			}
			if (activity.from?.id && activity.from.id === activity.recipient?.id) {
				return;
			}
		}

		const teamId = extractTeamId(activity);
		if (this.config.allowedTeamIds.length > 0 && teamId) {
			if (!this.config.allowedTeamIds.includes(teamId)) {
				return;
			}
		}

		const channelId = extractChannelId(activity);
		if (this.config.allowedChannelIds.length > 0) {
			if (!channelId || !this.config.allowedChannelIds.includes(channelId)) {
				return;
			}
		}

		const botAccountId = activity.recipient?.id || this.config.appId;
		if (
			this.config.mentionOnly &&
			!isDirectMessage(activity) &&
			!isTeamsBotMentioned(activity, botAccountId)
		) {
			return;
		}

		const mentionTexts = extractTeamsMentionTexts(activity, botAccountId);
		const cleaned = stripTeamsBotMention(activity.text || "", mentionTexts);
		const attachments = (activity.attachments || [])
			.map((attachment) => attachment.contentUrl)
			.filter((url): url is string => Boolean(url));
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
				await context.sendActivity(
					`Provide a session key after \`${this.config.sessionCommand}\`.`,
				);
				return;
			}
		}
		if (!matched && channelId) {
			resolvedSessionKey = resolveTeamsChannelSessionKey(
				channelId,
				this.config.channelSessions,
			);
			usedChannelMapping = Boolean(resolvedSessionKey);
		}
		const inferredAgentId = parseAgentIdFromSessionKey(resolvedSessionKey);
		if (usedChannelMapping && !inferredAgentId) {
			this.logger.warn(
				`Teams channel session mapping for channel ${channelId} does not include an agent prefix. ` +
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
			routing: buildRoutingInfo(activity, botAccountId),
			sessionKey: resolvedSessionKey,
		};

		try {
			await context.sendActivity({ type: "typing" });

			let fallbackText = "";
			let uiFallbackText = "";
			let uiOnlyDetected = false;
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
					if (chunk.type === "tool-result" && chunk.toolResult?.output) {
						const meta = extractUiMeta(chunk.toolResult.output);
						if (meta.uiOnly === true) {
							uiOnlyDetected = true;
						}
						if (meta.textFallback) {
							uiFallbackText = meta.textFallback;
						}
					}
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
			let responseText = `${fallbackText}${fallbackText && orderedText ? "\n\n" : ""}${orderedText}`.trim();
			if (uiFallbackText && (uiOnlyDetected || !responseText)) {
				responseText = uiFallbackText.trim();
			}
			if (!responseText) {
				return;
			}

			const chunks = splitTeamsMessage(responseText, this.config.responseChunkSize);
			for (const chunk of chunks) {
				await context.sendActivity(chunk);
			}
		} catch (error) {
			this.logger.error("Teams adapter failed to handle message", error);
			try {
				await context.sendActivity("Sorry, I hit an error running that request.");
			} catch {
				// Ignore failures when reporting the error.
			}
		}
	}
}
