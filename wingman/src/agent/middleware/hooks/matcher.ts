/**
 * Pattern Matching Utilities for Hooks
 *
 * Implements tool name pattern matching following Claude Code's behavior:
 * - Pipe-separated tool names: "write_file|edit_file"
 * - Wildcard: "*" or empty string
 * - Regex patterns: ".*_file"
 * - Case-sensitive matching
 */

import type { HookMatcher } from "@/types/hooks.js";
import type { Hook } from "@/types/hooks.js";

/**
 * Check if a tool name matches a pattern
 *
 * @param toolName - The tool name to match (e.g., "write_file")
 * @param pattern - The pattern to match against
 * @returns true if the tool name matches the pattern
 */
export function matchesToolPattern(toolName: string, pattern?: string): boolean {
	// Empty string or undefined means match all
	if (!pattern || pattern === "") {
		return true;
	}

	// Wildcard "*" matches all
	if (pattern === "*") {
		return true;
	}

	// Check for pipe-separated list (exact match)
	if (pattern.includes("|")) {
		const toolNames = pattern.split("|").map(t => t.trim());
		return toolNames.includes(toolName);
	}

	// Try as exact match first
	if (pattern === toolName) {
		return true;
	}

	// Try as regex pattern
	try {
		const regex = new RegExp(pattern);
		return regex.test(toolName);
	} catch (error) {
		// If regex is invalid, fall back to exact match
		return pattern === toolName;
	}
}

/**
 * Find all hooks that match a given tool name
 *
 * @param matchers - Array of hook matchers to search
 * @param toolName - The tool name to match
 * @returns Array of all matching hooks (flattened)
 */
export function findMatchingHooks(
	matchers: HookMatcher[] | undefined,
	toolName: string,
): Hook[] {
	if (!matchers || matchers.length === 0) {
		return [];
	}

	const matchingHooks: Hook[] = [];

	for (const matcher of matchers) {
		if (matchesToolPattern(toolName, matcher.matcher)) {
			matchingHooks.push(...matcher.hooks);
		}
	}

	return matchingHooks;
}
