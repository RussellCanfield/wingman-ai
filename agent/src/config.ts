import type { BaseCheckpointSaver } from "@langchain/langgraph";
import type { Logger } from "./logger";
import { z } from "zod/v4";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { DEFAULT_BLOCKED_COMMANDS } from "./tools/cmd_execute";
import type { ChatXAI } from "@langchain/xai";

export const AvailableTools = [
	"background_agent",
	"integrate_background_work",
	"web_search",
	"thinking",
	"command_execute",
	"read_file",
	"list_directory",
	"edit_file",
	"research",
	"file_inspector",
] as const;
export type AvailableToolsType = (typeof AvailableTools)[number];

/**
 * Configuration schema for Wingman AI Agent
 *
 * @example
 * ```typescript
 * import { WingmanAgent } from '@wingman-ai/agent';
 * import { ChatOpenAI } from '@langchain/openai';
 *
 * const agent = new WingmanAgent({
 *   name: "My Coding Assistant",
 *   model: new ChatOpenAI({ model: "gpt-4" }),
 *   workingDirectory: "/path/to/project",
 *   mode: "vibe",
 *   backgroundAgentConfig: {
 *     pushToRemote: true,
 *     createPullRequest: true,
 *     pullRequestTitle: "🤖 {agentName}: {input}",
 *     pullRequestBody: "Automated changes by {agentName}\n\nTask: {input}\n\nFiles changed:\n{changedFiles}"
 *   },
 *   tools: ["background_agent", "edit_file", "command_execute"]
 * });
 * ```
 */
export const WingmanAgentConfigSchema = z.object({
	/**
	 * Display name for the agent
	 * @example "My Coding Assistant"
	 */
	name: z.string().min(1, "Agent name is required"),

	/**
	 * Custom system prompt to override the default system prompt
	 * If not provided, the agent will use the built-in system prompt
	 * @example "You are a senior TypeScript developer focused on clean code and best practices."
	 */
	prompt: z.string().optional(),

	/**
	 * Additional instructions that augment the system prompt
	 * These are appended to the system prompt to provide specific guidance
	 * @example "Always use TypeScript strict mode and prefer functional programming patterns."
	 */
	instructions: z
		.string()
		.describe(
			"Additional instructions for the agent that augment the system prompt",
		)
		.optional(),

	/**
	 * LangChain chat model instance for the agent
	 * Supports OpenAI, Anthropic, Google, and other LangChain-compatible models
	 * @example new ChatOpenAI({ model: "gpt-4", temperature: 0.1 })
	 * @example new ChatAnthropic({ model: "claude-3-sonnet-20240229" })
	 */
	model: z.custom<BaseChatModel | ChatXAI>().refine(
		(val) => {
			return val && (val.lc_namespace as string[]).includes("langchain");
		},
		{
			message: "Agent model must be a valid LangChain model.",
		},
	),

	/**
	 * Working directory for the agent
	 * If not specified, uses the current working directory
	 * @example "/Users/username/projects/my-app"
	 * @default process.cwd()
	 */
	workingDirectory: z.string().optional(),

	/**
	 * Agent interaction mode
	 * - "interactive": More conversational, asks for confirmation
	 * - "vibe": More autonomous, takes action based on context
	 * @default "vibe"
	 */
	mode: z.enum(["interactive", "vibe"]).default("vibe"),

	/**
	 * Memory/checkpoint saver for conversation persistence
	 * If not provided, uses in-memory storage
	 * @example new RedisSaver(redisClient)
	 */
	memory: z.custom<BaseCheckpointSaver>().optional(),

	/**
	 * Logger instance for controlling output verbosity
	 * @default createLogger() // Uses WINGMAN_LOG_LEVEL env var or 'info'
	 */
	logger: z.custom<Logger>().optional(),

	/**
	 * Log level for built-in logger
	 * @default 'info'
	 */
	logLevel: z.enum(["debug", "info", "warn", "error", "silent"]).optional(),

	/**
	 * Configuration for background agent behavior
	 * Controls how background agents integrate their work back into the main branch
	 */
	backgroundAgentConfig: z
		.object({
			/**
			 * Whether background agents should push their branches to the remote repository
			 * - false: Local-only integration (merge directly in local repo)
			 * - true: Push to remote before integration
			 * @default false
			 * @example true // Enable remote push for team collaboration
			 */
			pushToRemote: z
				.boolean()
				.describe(
					"Whether background agents should push their branches to the remote repository (defaults to false for local-only integration)",
				)
				.default(false),

			/**
			 * Whether to automatically create a pull request when pushing to remote
			 * Requires pushToRemote to be true
			 * When enabled, creates PR instead of direct merge
			 * @default false
			 * @example true // Create PRs for code review
			 */
			createPullRequest: z
				.boolean()
				.describe(
					"Whether to automatically create a pull request when pushing to remote (requires pushToRemote to be true)",
				)
				.default(false),

			/**
			 * Template for pull request title
			 * Available placeholders:
			 * - {agentName}: Name of the background agent
			 * - {input}: The task description given to the agent
			 * @default "Background Agent: {agentName}"
			 * @example "🤖 Automated: {agentName} - {input}"
			 */
			pullRequestTitle: z
				.string()
				.describe(
					"Template for pull request title. Use {agentName} and {input} placeholders",
				)
				.default("Background Agent: {agentName}"),

			/**
			 * Template for pull request body
			 * Available placeholders:
			 * - {agentName}: Name of the background agent
			 * - {input}: The task description given to the agent
			 * - {changedFiles}: List of files that were modified
			 * @default "This pull request was automatically created by background agent: **{agentName}**\n\n## Task\n{input}\n\n## Changed Files\n{changedFiles}"
			 * @example "## Automated Changes\n\nAgent: **{agentName}**\nTask: {input}\n\n### Files Modified\n{changedFiles}\n\n---\n*This PR was created automatically by Wingman AI*"
			 */
			pullRequestBody: z
				.string()
				.describe(
					"Template for pull request body. Use {agentName}, {input}, and {changedFiles} placeholders",
				)
				.default(
					"This pull request was automatically created by background agent: **{agentName}**\n\n## Task\n{input}\n\n## Changed Files\n{changedFiles}",
				),
		})
		.optional(),

	/**
	 * Tool-specific capabilities and restrictions
	 */
	toolAbilities: z
		.object({
			/**
			 * Symbol retrieval capabilities for code analysis
			 * Provides the agent with the ability to understand code structure
			 * @example symbolRetriever // Your symbol retriever instance
			 */
			symbolRetriever: z
				.any()
				.describe("Symbol retrieval capabilities")
				.optional(),

			/**
			 * File diagnostics capabilities for error detection
			 * Enables the agent to detect and analyze code issues
			 * @example diagnosticRetriever // Your diagnostic retriever instance
			 */
			fileDiagnostics: z
				.any()
				.describe("File diagnostics capabilities")
				.optional(),

			/**
			 * List of commands that the agent should not execute
			 * Prevents potentially destructive operations
			 * @default ["rm", "rmdir", "del", "format", "fdisk", "mkfs", "dd", "sudo rm", "sudo rmdir", "chmod 777", "chown", "passwd", "su", "sudo su"]
			 * @example ["rm", "sudo", "chmod 777"] // Block dangerous commands
			 */
			blockedCommands: z
				.array(z.string())
				.optional()
				.describe(
					"List of commands that the agent should not execute. Defaults to common destructive commands.",
				)
				.default(DEFAULT_BLOCKED_COMMANDS),

			/**
			 * Whether the agent is allowed to execute scripts or commands
			 * When false, prevents all command execution for safety
			 * @default true
			 * @example false // Disable all command execution
			 */
			allowScriptExecution: z
				.boolean()
				.describe(
					"Whether the agent is allowed to execute scripts or commands that can modify the system.",
				)
				.default(true),
		})
		.optional(),

	/**
	 * List of available tools for the agent
	 * Controls which capabilities the agent has access to
	 * @default All available tools
	 * @example ["edit_file", "read_file", "command_execute"] // Minimal toolset
	 * @example ["background_agent", "web_search", "research"] // Research-focused
	 */
	tools: z
		.array(z.enum(AvailableTools))
		.default([...AvailableTools])
		.optional()
		.describe("List of available tools for the agent"),
});

/**
 * Type definition for Wingman Agent configuration
 *
 * @example
 * ```typescript
 * const config: WingmanAgentConfig = {
 *   name: "Code Assistant",
 *   model: new ChatOpenAI({ model: "gpt-4" }),
 *   backgroundAgentConfig: {
 *     pushToRemote: true,
 *     createPullRequest: true
 *   }
 * };
 * ```
 */
export type WingmanAgentConfig = z.infer<typeof WingmanAgentConfigSchema>;

const WingmanInternalConfigSchema = WingmanAgentConfigSchema.extend({
	workingDirectory: z.string(),
	logger: z.custom<Logger>(),
	instructions: z
		.string()
		.describe(
			"Additional instructions for the agent that augment the system prompt",
		)
		.optional(),
	backgroundAgentConfig: z.object({
		pushToRemote: z.boolean().default(false),
		createPullRequest: z.boolean().default(false),
		pullRequestTitle: z.string().default("Background Agent: {agentName}"),
		pullRequestBody: z
			.string()
			.default(
				"This pull request was automatically created by background agent: **{agentName}**\n\n## Task\n{input}\n\n## Changed Files\n{changedFiles}",
			),
	}),
	toolAbilities: z.object({
		symbolRetriever: z
			.any()
			.describe("Symbol retrieval capabilities")
			.optional(),
		fileDiagnostics: z
			.any()
			.describe("File diagnostics capabilities")
			.optional(),
		blockedCommands: z
			.array(z.string())
			.optional()
			.describe("List of commands that the agent should not execute")
			.default(DEFAULT_BLOCKED_COMMANDS),
		allowScriptExecution: z
			.boolean()
			.describe(
				"Whether the agent is allowed to execute scripts or commands that can modify the system.",
			)
			.default(true),
	}),
	tools: z
		.array(z.enum(AvailableTools))
		.optional()
		.default([...AvailableTools])
		.describe("List of available tools for the agent"),
});

export type WingmanConfig = z.infer<typeof WingmanInternalConfigSchema>;
