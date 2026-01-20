/**
 * Hooks Middleware
 *
 * Integrates with deepagent's middleware system to execute user-defined hooks
 * at specific lifecycle points (PreToolUse, PostToolUse, Stop)
 */

import { MIDDLEWARE_BRAND, type AgentMiddleware } from "langchain";
import type { HooksConfig } from "@/types/hooks.js";
import { HookExecutor } from "./hooks/executor.js";
import type { HookExecutionContext } from "./hooks/types.js";
import type { Logger } from "@/logger.js";

/**
 * Create hooks middleware for deepagent
 *
 * @param hooksConfig - Merged hooks configuration (global + agent-specific)
 * @param workspace - Workspace directory path
 * @param sessionId - Unique session identifier
 * @param logger - Logger instance
 * @returns AgentMiddleware instance
 */
export function createHooksMiddleware(
	hooksConfig: HooksConfig,
	workspace: string,
	sessionId: string,
	logger: Logger,
): AgentMiddleware {
	const executor = new HookExecutor(workspace, logger);

	return {
		name: "hooks-middleware",
		[MIDDLEWARE_BRAND]: true,

		/**
		 * Wrap tool calls to execute PreToolUse and PostToolUse hooks
		 */
		wrapToolCall: async (request, handler) => {
			const context: HookExecutionContext = {
				sessionId,
				cwd: workspace,
				toolCallRequest: request,
			};

			// Execute PreToolUse hooks (blocking - can prevent tool execution)
			if (hooksConfig.PreToolUse && hooksConfig.PreToolUse.length > 0) {
				try {
					await executor.executeHooksForEvent(
						"PreToolUse",
						hooksConfig.PreToolUse,
						context,
						true, // blocking
					);
				} catch (error) {
					// PreToolUse hook blocked the tool execution
					logger.error(`PreToolUse hook blocked tool execution: ${error instanceof Error ? error.message : String(error)}`);
					throw error;
				}
			}

			// Execute the actual tool
			const result = await handler(request);

			// Execute PostToolUse hooks (non-blocking)
			// Only execute if result is a ToolMessage (not a Command)
			if (hooksConfig.PostToolUse && hooksConfig.PostToolUse.length > 0 && "content" in result) {
				const postContext: HookExecutionContext = {
					...context,
					toolResult: result,
				};

				// Fire and forget - errors are logged but don't stop execution
				executor.executeHooksForEvent(
					"PostToolUse",
					hooksConfig.PostToolUse,
					postContext,
					false, // non-blocking
				).catch(error => {
					logger.warn(`PostToolUse hook failed (non-blocking): ${error instanceof Error ? error.message : String(error)}`);
				});
			}

			return result;
		},

		/**
		 * Execute Stop hooks after agent completes
		 */
		afterAgent: async () => {
			if (hooksConfig.Stop && hooksConfig.Stop.length > 0) {
				const context: HookExecutionContext = {
					sessionId,
					cwd: workspace,
				};

				// Fire and forget - errors are logged but don't stop agent
				executor.executeStopHooks(hooksConfig.Stop, context).catch(error => {
					logger.warn(`Stop hook failed (non-blocking): ${error instanceof Error ? error.message : String(error)}`);
				});
			}

			return undefined; // Pass through
		},
	};
}
