import { z } from "zod";
import { HooksConfigSchema } from "@/agent/middleware/hooks/types.js";
import { InternalHooksConfigSchema } from "@/gateway/hooks/types.js";
import { MCPServersConfigSchema } from "@/types/mcp.js";

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
	toolHooks: HooksConfigSchema.optional().describe("Global tool hooks configuration"),
	hooks: InternalHooksConfigSchema.optional().describe("Internal hook configuration"),
	search: SearchConfigSchema.optional().default({
		provider: "duckduckgo",
		maxResults: 5,
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
