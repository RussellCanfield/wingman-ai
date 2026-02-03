/**
 * Hook Configuration Merger
 *
 * Merges global and agent-specific hook configurations
 */

import type { HooksConfig } from "@/types/hooks.js";

/**
 * Merge global and agent-specific hooks configurations
 *
 * Both global and agent hooks are executed. Hooks from both sources are concatenated
 * for each event type. No deduplication is performed - if the same hook is defined
 * in both places, it will run twice.
 *
 * @param globalHooks - Hooks from wingman.config.json
 * @param agentHooks - Hooks from agent.json
 * @returns Merged hooks configuration
 */
export function mergeHooks(
	globalHooks: HooksConfig | undefined,
	agentHooks: HooksConfig | undefined,
): HooksConfig | undefined {
	// If neither has hooks, return undefined
	if (!globalHooks && !agentHooks) {
		return undefined;
	}

	// If only one has hooks, return that one
	if (!globalHooks) return agentHooks;
	if (!agentHooks) return globalHooks;

	// Merge both configurations
	const merged: HooksConfig = {};

	// Merge PreToolUse hooks
	if (globalHooks.PreToolUse || agentHooks.PreToolUse) {
		merged.PreToolUse = [
			...(globalHooks.PreToolUse || []),
			...(agentHooks.PreToolUse || []),
		];
	}

	// Merge PostToolUse hooks
	if (globalHooks.PostToolUse || agentHooks.PostToolUse) {
		merged.PostToolUse = [
			...(globalHooks.PostToolUse || []),
			...(agentHooks.PostToolUse || []),
		];
	}

	// Merge Stop hooks
	if (globalHooks.Stop || agentHooks.Stop) {
		merged.Stop = [...(globalHooks.Stop || []), ...(agentHooks.Stop || [])];
	}

	return merged;
}
