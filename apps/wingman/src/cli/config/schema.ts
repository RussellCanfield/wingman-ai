import * as z from "zod";
import { HooksConfigSchema } from "@/agent/middleware/hooks/types.js";
import { InternalHooksConfigSchema } from "@/gateway/hooks/types.js";
import { MCPServersConfigSchema } from "@/types/mcp.js";
import { VoiceConfigSchema } from "@/types/voice.js";

// Zod schema for search configuration
export const SearchConfigSchema = z.object({
	provider: z
		.enum(["duckduckgo", "perplexity"])
		.default("duckduckgo")
		.describe("Search provider to use"),
	maxResults: z
		.number()
		.min(1)
		.max(20)
		.optional()
		.default(5)
		.describe("Maximum number of search results to return"),
});

export type SearchConfig = z.infer<typeof SearchConfigSchema>;

// Zod schema for skills configuration
export const SkillsConfigSchema = z.object({
	repositoryOwner: z
		.string()
		.default("anthropics")
		.describe("GitHub repository owner for skills"),
	repositoryName: z
		.string()
		.default("skills")
		.describe("GitHub repository name for skills"),
	githubToken: z
		.string()
		.optional()
		.describe("GitHub personal access token for higher API rate limits"),
	skillsDirectory: z
		.string()
		.default("skills")
		.describe("Directory to install skills in"),
});

export type SkillsConfig = z.infer<typeof SkillsConfigSchema>;

export const BrowserTransportSchema = z
	.enum(["auto", "playwright", "relay"])
	.describe("Browser automation transport preference");

export type BrowserTransport = z.infer<typeof BrowserTransportSchema>;

export const BrowserConfigSchema = z.object({
	profilesDir: z
		.string()
		.optional()
		.default(".wingman/browser-profiles")
		.describe(
			"Base directory for named browser_control profiles (relative to workspace unless absolute)",
		),
	profiles: z
		.record(z.string(), z.string())
		.optional()
		.default({})
		.describe(
			"Optional mapping of profile ID to explicit profile path (relative to workspace unless absolute)",
		),
	extensionsDir: z
		.string()
		.optional()
		.default(".wingman/browser-extensions")
		.describe(
			"Base directory for named browser extensions (relative to workspace unless absolute)",
		),
	extensions: z
		.record(z.string(), z.string())
		.optional()
		.default({})
		.describe(
			"Optional mapping of extension ID to unpacked extension path (relative to workspace unless absolute)",
		),
	defaultExtensions: z
		.array(z.string().min(1))
		.optional()
		.default([])
		.describe(
			"Optional default extension IDs loaded for browser profile open and browser_control runs",
		),
	defaultProfile: z
		.string()
		.min(1)
		.optional()
		.describe(
			"Optional default browser profile ID used when an agent does not specify browserProfile",
		),
	transport: BrowserTransportSchema.optional()
		.default("auto")
		.describe(
			'Default browser transport preference for browser_control ("auto", "playwright", or "relay")',
		),
	relay: z
		.object({
			enabled: z
				.boolean()
				.optional()
				.default(false)
				.describe("Enable local browser relay server for extension/CDP bridging"),
			host: z
				.string()
				.optional()
				.default("127.0.0.1")
				.describe("Relay bind host (security: keep this loopback)"),
			port: z
				.number()
				.int()
				.min(1)
				.max(65535)
				.optional()
				.default(18792)
				.describe("Relay bind port"),
			requireAuth: z
				.boolean()
				.optional()
				.default(true)
				.describe("Require relay clients to authenticate with a token"),
			authToken: z
				.string()
				.min(16)
				.optional()
				.describe("Relay shared secret for extension/CDP clients"),
			maxMessageBytes: z
				.number()
				.int()
				.min(1024)
				.max(2_097_152)
				.optional()
				.default(262_144)
				.describe("Maximum relay websocket message size"),
		})
		.optional()
		.default({
			enabled: false,
			host: "127.0.0.1",
			port: 18792,
			requireAuth: true,
			maxMessageBytes: 262_144,
		}),
});

export type BrowserConfig = z.infer<typeof BrowserConfigSchema>;

export const SummarizationConfigSchema = z.object({
	enabled: z
		.boolean()
		.optional()
		.default(true)
		.describe("Enable conversation history summarization"),
	maxTokensBeforeSummary: z
		.number()
		.min(1000)
		.max(1000000)
		.optional()
		.default(12000)
		.describe("Token threshold before summarizing conversation history"),
	messagesToKeep: z
		.number()
		.min(2)
		.max(100)
		.optional()
		.default(8)
		.describe("How many most recent messages to keep after summarization"),
});

export type SummarizationConfig = z.infer<typeof SummarizationConfigSchema>;

const RetryOnFailureSchema = z.enum(["continue", "error"]);

const BaseRetryConfigSchema = z.object({
	enabled: z
		.boolean()
		.optional()
		.default(false)
		.describe("Enable retry middleware"),
	maxRetries: z
		.number()
		.min(0)
		.max(20)
		.optional()
		.default(2)
		.describe("Maximum number of retry attempts"),
	backoffFactor: z
		.number()
		.min(0)
		.max(10)
		.optional()
		.default(2)
		.describe("Exponential backoff multiplier"),
	initialDelayMs: z
		.number()
		.min(0)
		.max(120000)
		.optional()
		.default(1000)
		.describe("Initial delay before first retry in milliseconds"),
	maxDelayMs: z
		.number()
		.min(0)
		.max(300000)
		.optional()
		.default(60000)
		.describe("Maximum backoff delay in milliseconds"),
	jitter: z
		.boolean()
		.optional()
		.default(true)
		.describe("Add randomized jitter to retry delays"),
	onFailure: RetryOnFailureSchema.optional()
		.default("continue")
		.describe("Behavior when retries are exhausted"),
});

export const ModelRetryConfigSchema = BaseRetryConfigSchema;
export type ModelRetryConfig = z.infer<typeof ModelRetryConfigSchema>;

export const ToolRetryConfigSchema = BaseRetryConfigSchema.extend({
	tools: z
		.array(z.string().min(1))
		.optional()
		.describe("Optional list of tool names to apply retry logic to"),
});
export type ToolRetryConfig = z.infer<typeof ToolRetryConfigSchema>;

const AllowedDecisionSchema = z.enum(["approve", "edit", "reject"]);
const InterruptOnToolConfigSchema = z.union([
	z.boolean(),
	z.object({
		allowedDecisions: z
			.array(AllowedDecisionSchema)
			.min(1)
			.describe("Allowed decisions for this tool"),
		description: z
			.string()
			.optional()
			.describe("Optional custom review prompt for this tool"),
		argsSchema: z
			.record(z.string(), z.any())
			.optional()
			.describe("Optional argument schema for edit decisions"),
	}),
]);

export const HumanInTheLoopConfigSchema = z.object({
	enabled: z
		.boolean()
		.optional()
		.default(false)
		.describe("Enable human-in-the-loop tool approval"),
	interruptOn: z
		.record(z.string(), InterruptOnToolConfigSchema)
		.optional()
		.default({})
		.describe("Per-tool approval policy mapping"),
});
export type HumanInTheLoopConfig = z.infer<typeof HumanInTheLoopConfigSchema>;

const GatewayAuthSchema = z
	.object({
		mode: z.enum(["token", "password", "none"]).default("none"),
		token: z.string().optional(),
		password: z.string().optional(),
		allowTailscale: z.boolean().optional().default(false),
	})
	.default({
		mode: "none",
		allowTailscale: false,
	});

const GatewayControlUiSchema = z
	.object({
		enabled: z.boolean().default(true),
		port: z.number().min(1).max(65535).default(18790),
		pairingRequired: z.boolean().default(true),
		allowInsecureAuth: z.boolean().default(false),
	})
	.default({
		enabled: true,
		port: 18790,
		pairingRequired: true,
		allowInsecureAuth: false,
	});

const DiscordAdapterSchema = z
	.object({
		enabled: z.boolean().default(false),
		token: z.string().optional(),
		mentionOnly: z.boolean().default(true),
		allowBots: z.boolean().default(false),
		allowedGuilds: z.array(z.string()).default([]),
		allowedChannels: z.array(z.string()).default([]),
		channelSessions: z.record(z.string(), z.string()).default({}),
		sessionCommand: z.string().default("!session"),
		gatewayUrl: z.string().optional(),
		gatewayToken: z.string().optional(),
		gatewayPassword: z.string().optional(),
		responseChunkSize: z.number().min(500).max(2000).default(1900),
	})
	.default({
		enabled: false,
		mentionOnly: true,
		allowBots: false,
		allowedGuilds: [],
		allowedChannels: [],
		channelSessions: {},
		sessionCommand: "!session",
		responseChunkSize: 1900,
	});

const GatewayAdaptersSchema = z
	.object({
		discord: DiscordAdapterSchema.optional(),
	})
	.default({});

export const GatewayConfigSchema = z
	.object({
		host: z.string().default("127.0.0.1"),
		port: z.number().min(1).max(65535).default(18789),
		stateDir: z.string().optional(),
		fsRoots: z.array(z.string()).optional().default([]),
		auth: GatewayAuthSchema.optional().default({
			mode: "none",
			allowTailscale: false,
		}),
		controlUi: GatewayControlUiSchema.optional().default({
			enabled: true,
			port: 18790,
			pairingRequired: true,
			allowInsecureAuth: false,
		}),
		dynamicUiEnabled: z.boolean().optional().default(true),
		adapters: GatewayAdaptersSchema.optional().default({}),
	})
	.default({
		host: "127.0.0.1",
		port: 18789,
		fsRoots: [],
		auth: {
			mode: "none",
			allowTailscale: false,
		},
		controlUi: {
			enabled: true,
			port: 18790,
			pairingRequired: true,
			allowInsecureAuth: false,
		},
		dynamicUiEnabled: true,
		adapters: {},
	});

export type GatewayConfig = z.infer<typeof GatewayConfigSchema>;

const AgentListItemSchema = z.object({
	id: z.string().min(1),
	name: z.string().optional(),
	default: z.boolean().optional(),
	workspace: z.string().optional(),
	agentDir: z.string().optional(),
	model: z.string().optional(),
});

const BindingPeerSchema = z.object({
	kind: z.enum(["dm", "group", "channel"]),
	id: z.string().min(1),
});

const BindingMatchSchema = z.object({
	channel: z.string().min(1),
	accountId: z.string().optional(),
	guildId: z.string().optional(),
	teamId: z.string().optional(),
	peer: BindingPeerSchema.optional(),
});

const BindingSchema = z.object({
	agentId: z.string().min(1),
	match: BindingMatchSchema,
});

export const AgentsConfigSchema = z
	.object({
		list: z.array(AgentListItemSchema).default([]),
		bindings: z.array(BindingSchema).default([]),
	})
	.default({
		list: [],
		bindings: [],
	});

export type AgentsConfig = z.infer<typeof AgentsConfigSchema>;

// Zod schema for wingman.config.json
export const WingmanConfigSchema = z.object({
	logLevel: z
		.enum(["debug", "info", "warn", "error", "silent"])
		.optional()
		.default("info"),
	defaultAgent: z.string().optional(),
	recursionLimit: z.number().min(1).max(1000000).optional().default(5000),
	summarization: SummarizationConfigSchema.optional().default({
		enabled: true,
		maxTokensBeforeSummary: 12000,
		messagesToKeep: 8,
	}),
	modelRetry: ModelRetryConfigSchema.optional().default({
		enabled: true,
		maxRetries: 2,
		backoffFactor: 2,
		initialDelayMs: 1000,
		maxDelayMs: 60000,
		jitter: true,
		onFailure: "continue",
	}),
	toolRetry: ToolRetryConfigSchema.optional().default({
		enabled: false,
		maxRetries: 2,
		backoffFactor: 2,
		initialDelayMs: 1000,
		maxDelayMs: 60000,
		jitter: true,
		onFailure: "continue",
	}),
	humanInTheLoop: HumanInTheLoopConfigSchema.optional().default({
		enabled: false,
		interruptOn: {},
	}),
	toolHooks: HooksConfigSchema.optional().describe("Global tool hooks configuration"),
	hooks: InternalHooksConfigSchema.optional().describe("Internal hook configuration"),
	search: SearchConfigSchema.optional().default({
		provider: "duckduckgo",
		maxResults: 5,
	}),
	voice: VoiceConfigSchema.optional().default({
		provider: "web_speech",
		defaultPolicy: "off",
		webSpeech: {},
		elevenlabs: {},
	}),
	cli: z
		.object({
			theme: z.string().default("default"),
			outputMode: z.enum(["auto", "interactive", "json"]).default("auto"),
		})
		.default({ theme: "default", outputMode: "auto" }),
	skills: SkillsConfigSchema.optional().default({
		repositoryOwner: "anthropics",
		repositoryName: "skills",
		skillsDirectory: "skills",
	}),
	browser: BrowserConfigSchema.optional().default({
		profilesDir: ".wingman/browser-profiles",
		profiles: {},
		extensionsDir: ".wingman/browser-extensions",
		extensions: {},
		defaultExtensions: [],
		transport: "auto",
		relay: {
			enabled: false,
			host: "127.0.0.1",
			port: 18792,
			requireAuth: true,
			maxMessageBytes: 262_144,
		},
	}),
	gateway: GatewayConfigSchema.optional().default({
		host: "127.0.0.1",
		port: 18789,
		fsRoots: [],
		auth: {
			mode: "none",
			allowTailscale: false,
		},
		controlUi: {
			enabled: true,
			port: 18790,
			pairingRequired: true,
			allowInsecureAuth: false,
		},
		dynamicUiEnabled: true,
		adapters: {},
	}),
	agents: AgentsConfigSchema.optional().default({
		list: [],
		bindings: [],
	}),
	mcp: MCPServersConfigSchema.optional().describe(
		"Global MCP server configurations",
	),
});

export type WingmanConfigType = z.infer<typeof WingmanConfigSchema>;

// Validation function
export function validateConfig(data: unknown): {
	success: boolean;
	data?: WingmanConfigType;
	error?: string;
} {
	try {
		const validated = WingmanConfigSchema.parse(data);
		return { success: true, data: validated };
	} catch (error) {
		if (error instanceof z.ZodError) {
			return {
				success: false,
				error: error.issues
					.map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`)
					.join(", "),
			};
		}
		return { success: false, error: String(error) };
	}
}
