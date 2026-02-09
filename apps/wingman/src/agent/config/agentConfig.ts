import { z } from "zod";
import { HooksConfigSchema } from "@/agent/middleware/hooks/types.js";
import { MCPServersConfigSchema } from "@/types/mcp.js";
import { AgentVoiceConfigSchema } from "@/types/voice.js";

export const WingmanDirectory = ".wingman";

/**
 * Available tool names for user-defined agents
 */
export const AvailableToolNames = z.enum([
	"internet_search",
	"web_crawler",
	"command_execute",
	"think",
	"code_search",
	"git_status",
	"ui_registry_list",
	"ui_registry_get",
	"ui_present",
]);

export type AvailableToolName = z.infer<typeof AvailableToolNames>;

const PromptRefinementSchema = z.preprocess(
	(value) => {
		if (value === undefined) return undefined;
		if (typeof value === "boolean") return { enabled: value };
		return value;
	},
	z
		.object({
			enabled: z
				.boolean()
				.optional()
				.default(true)
				.describe("Whether prompt refinement is enabled for this agent"),
			instructionsPath: z
				.string()
				.min(1)
				.optional()
				.describe(
					"Path (virtual) to store the agent's prompt refinement overlay (defaults under /memories/)",
				),
		})
		.strict(),
);

export type PromptRefinementConfig = z.infer<typeof PromptRefinementSchema>;

/**
 * Base agent configuration schema
 */
const BaseAgentConfigSchema = z.object({
	name: z.string().min(1).describe("Unique agent name (e.g., 'data-analyst')"),
	description: z
		.string()
		.min(1)
		.describe(
			"Action-oriented description of what the agent does (helps root agent decide when to delegate)",
		),
	systemPrompt: z
		.string()
		.min(1)
		.describe(
			"Detailed instructions for the agent, including tool usage guidance and output formatting",
		),
	tools: z
		.array(AvailableToolNames)
		.optional()
		.describe(
			"List of available tools for this agent. Keep minimal and focused.",
		),
	model: z
		.string()
		.optional()
		.describe(
			'Model override in format "provider:model-name" (e.g., "anthropic:claude-opus-4-5", "codex:codex-mini-latest", "openrouter:openai/gpt-4o", "copilot:gpt-4o")',
		),
	blockedCommands: z
		.array(z.string())
		.optional()
		.describe(
			"List of blocked commands for command_execute tool (e.g., ['rm', 'mv'])",
		),
	allowScriptExecution: z
		.boolean()
		.optional()
		.default(true)
		.describe("Whether to allow script execution in command_execute tool"),
	commandTimeout: z
		.number()
		.optional()
		.default(300000)
		.describe("Command execution timeout in milliseconds (default: 300000)"),
	toolHooks: HooksConfigSchema.optional().describe(
		"Agent-specific tool hooks configuration",
	),
	mcp: MCPServersConfigSchema.optional().describe(
		"Agent-specific MCP server configurations",
	),
	mcpUseGlobal: z
		.boolean()
		.optional()
		.default(false)
		.describe(
			"Whether this agent should also load global MCP servers from wingman.config.json",
		),
	voice: AgentVoiceConfigSchema.optional().describe(
		"Agent-specific voice configuration",
	),
	promptRefinement: PromptRefinementSchema.optional().describe(
		"Optional per-agent prompt refinement settings",
	),
});

export const AgentConfigSchema = BaseAgentConfigSchema.extend({
	subAgents: z
		.array(BaseAgentConfigSchema)
		.optional()
		.describe(
			"List of sub-agents that this agent can delegate to (each may include its own model override)",
		),
}).superRefine((config, ctx) => {
	if (!config.subAgents || config.subAgents.length === 0) {
		return;
	}

	const parentName = config.name.trim().toLowerCase();
	const seenSubAgentNames = new Set<string>();

	for (const [index, subAgent] of config.subAgents.entries()) {
		const normalizedName = subAgent.name.trim().toLowerCase();

		if (normalizedName === parentName) {
			ctx.addIssue({
				code: "custom",
				path: ["subAgents", index, "name"],
				message: "Sub-agent name must be different from parent agent name",
			});
		}

		if (seenSubAgentNames.has(normalizedName)) {
			ctx.addIssue({
				code: "custom",
				path: ["subAgents", index, "name"],
				message: "Sub-agent names must be unique within the same parent agent",
			});
			continue;
		}

		seenSubAgentNames.add(normalizedName);
	}
});

export type WingmanAgentConfig = z.infer<typeof AgentConfigSchema>;

/**
 * Validate a single agent configuration
 */
export function validateAgentConfig(
	config: unknown,
):
	| { success: true; data: WingmanAgentConfig }
	| { success: false; error: string } {
	try {
		const data = AgentConfigSchema.parse(config);
		return { success: true, data };
	} catch (error) {
		if (error instanceof z.ZodError) {
			const messages = error.issues
				.map(
					(err: z.core.$ZodIssue) =>
						`  - ${err.path.join(".")}: ${err.message}`,
				)
				.join("\n");
			return {
				success: false,
				error: `Invalid agent configuration:\n${messages}`,
			};
		}
		return {
			success: false,
			error: `Unknown validation error: ${error}`,
		};
	}
}
