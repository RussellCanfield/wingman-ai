import { z } from "zod";

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
 * Subagent configuration schema (cannot have its own subagents)
 */
export const SubAgentConfigSchema = z
	.object({
		name: z
			.string()
			.min(1)
			.describe("Unique agent name (e.g., 'data-analyst')"),
		description: z
			.string()
			.min(1)
			.describe(
				"Action-oriented description of what the agent does (helps parent agent decide when to delegate)",
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
	})
	.strict()
	.refine(
		(data) => {
			// Explicitly reject if subagents field exists
			return !("subagents" in data);
		},
		{
			message: "Subagents cannot have their own subagents.",
		},
	);

export type SubAgentConfig = z.infer<typeof SubAgentConfigSchema>;

/**
 * User-defined agent configuration schema (can have subagents)
 */
export const UserAgentConfigSchema = z
	.object({
		name: z
			.string()
			.min(1)
			.describe("Unique agent name (e.g., 'data-analyst')"),
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
		subagents: z
			.array(SubAgentConfigSchema)
			.optional()
			.describe(
				"Array of subagents for this agent. Subagents cannot have their own subagents (max 1 level of nesting).",
			),
	})
	.refine(
		(data) => {
			// Ensure subagents don't have their own subagents
			if (data.subagents) {
				for (const subagent of data.subagents) {
					if ("subagents" in subagent && (subagent as any).subagents) {
						return false;
					}
				}
			}
			return true;
		},
		{
			message:
				"Subagents cannot have their own subagents. Maximum nesting level is 1.",
		},
	);

export type UserAgentConfig = z.infer<typeof UserAgentConfigSchema>;

/**
 * Schema for agents.config.json file
 */
export const AgentsConfigFileSchema = z.object({
	agents: z
		.array(UserAgentConfigSchema)
		.describe("Array of user-defined agent configurations"),
});

export type AgentsConfigFile = z.infer<typeof AgentsConfigFileSchema>;

/**
 * Validate a single agent configuration
 */
export function validateAgentConfig(
	config: unknown,
): { success: true; data: UserAgentConfig } | { success: false; error: string } {
	try {
		const data = UserAgentConfigSchema.parse(config);
		return { success: true, data };
	} catch (error) {
		if (error instanceof z.ZodError) {
			const messages = error.issues
				.map((err: z.ZodIssue) => `  - ${err.path.join(".")}: ${err.message}`)
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

/**
 * Validate agents config file
 */
export function validateAgentsConfigFile(
	config: unknown,
):
	| { success: true; data: AgentsConfigFile }
	| { success: false; error: string } {
	try {
		const data = AgentsConfigFileSchema.parse(config);
		return { success: true, data };
	} catch (error) {
		if (error instanceof z.ZodError) {
			const messages = error.issues
				.map((err: z.ZodIssue) => `  - ${err.path.join(".")}: ${err.message}`)
				.join("\n");
			return {
				success: false,
				error: `Invalid agents config file:\n${messages}`,
			};
		}
		return {
			success: false,
			error: `Unknown validation error: ${error}`,
		};
	}
}
