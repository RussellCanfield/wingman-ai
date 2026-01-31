/**
 * Hook Input Builder
 *
 * Constructs JSON input data for hooks following Claude Code's HookInput format
 */

import type { HookInput, HookEventName } from "@/types/hooks.js";
import type { HookExecutionContext } from "./types.js";

/**
 * Build hook input JSON from execution context
 *
 * @param eventName - The hook event name
 * @param context - The execution context containing all runtime data
 * @returns HookInput object to be serialized and passed to hook via stdin
 */
export function buildHookInput(
	eventName: HookEventName,
	context: HookExecutionContext,
): HookInput {
	const input: HookInput = {
		session_id: context.sessionId,
		cwd: context.cwd,
		hook_event_name: eventName,
	};

	// Add tool-specific data for PreToolUse and PostToolUse
		if (eventName === "PreToolUse" || eventName === "PostToolUse") {
			if (context.toolCallRequest?.tool) {
				const { tool, toolCall } = context.toolCallRequest;

				input.tool_name = String(tool.name);
				input.tool_use_id = toolCall.id;

			// Add tool input parameters
			if (toolCall.args) {
				input.tool_input = toolCall.args as Record<string, unknown>;
			}
		}
	}

	// Add tool output for PostToolUse
	if (eventName === "PostToolUse" && context.toolResult) {
		// Content can be string or complex type - serialize appropriately
		const content = context.toolResult.content;
		input.tool_output = typeof content === "string" ? content : content;
	}

	return input;
}
