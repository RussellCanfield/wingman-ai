import { z } from "zod";
import { HooksConfigSchema } from "@/agent/middleware/hooks/types.js";

export const WingmanDirectory = ".wingman";

/**
 * Available tool names for user-defined agents
 */
export const AvailableToolNames = z.enum([
	"internet_search",
	"web_crawler",
	"command_execute",
	"think",
]);

export type AvailableToolName = z.infer<typeof AvailableToolNames>;

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
			'Model override in format "provider:model-name" (e.g., "anthropic:claude-opus-4-5")',
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
	hooks: HooksConfigSchema.optional().describe("Agent-specific hooks configuration"),
});

export const AgentConfigSchema = BaseAgentConfigSchema.extend({
	subAgents: z
		.array(BaseAgentConfigSchema)
		.optional()
		.describe("List of sub-agents that this agent can delegate to"),
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
