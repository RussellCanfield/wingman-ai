/**
 * Hooks System Types
 *
 * Following Claude Code's hooks pattern for consistency.
 * Hooks are user-configurable shell commands that execute at specific lifecycle points.
 */

/**
 * Hook type - currently only "command" is supported
 */
export type HookType = "command";

/**
 * Individual hook configuration
 */
export interface Hook {
	/** Type of hook - currently only "command" is supported */
	type: HookType;
	/** Shell command to execute */
	command: string;
	/** Timeout in seconds (default: 60) */
	timeout?: number;
}

/**
 * Hook matcher for tool-specific hooks (PreToolUse, PostToolUse)
 * Supports pattern matching to selectively execute hooks
 */
export interface HookMatcher {
	/**
	 * Pattern to match tool names. Supports:
	 * - Pipe-separated tool names: "write_file|edit_file"
	 * - Single tool name: "command_execute"
	 * - Wildcard: "*" or empty string
	 * - Regex patterns: ".*_file"
	 *
	 * Case-sensitive matching
	 */
	matcher?: string;
	/** Array of hooks to execute when pattern matches */
	hooks: Hook[];
}

/**
 * Stop hook configuration (no matcher needed)
 */
export interface StopHook {
	/** Array of hooks to execute when agent stops */
	hooks: Hook[];
}

/**
 * Complete hooks configuration
 * Can be defined globally in wingman.config.json or per-agent in agent.json
 */
export interface HooksConfig {
	/** Hooks that fire before tool execution (can block) */
	PreToolUse?: HookMatcher[];
	/** Hooks that fire after tool completes successfully (non-blocking) */
	PostToolUse?: HookMatcher[];
	/** Hooks that fire when agent completes (non-blocking) */
	Stop?: StopHook[];
}

/**
 * Hook event names
 */
export type HookEventName = "PreToolUse" | "PostToolUse" | "Stop";

/**
 * Input data passed to hooks via stdin as JSON
 * Following Claude Code's HookInput format
 */
export interface HookInput {
	/** Unique session identifier */
	session_id: string;
	/** Current working directory */
	cwd: string;
	/** Name of the hook event that triggered this hook */
	hook_event_name: HookEventName;
	/** Tool name (for PreToolUse/PostToolUse hooks) */
	tool_name?: string;
	/** Tool input parameters (for PreToolUse/PostToolUse hooks) */
	tool_input?: Record<string, unknown>;
	/** Tool use ID (for PreToolUse/PostToolUse hooks) */
	tool_use_id?: string;
	/** Tool output (for PostToolUse hooks only) */
	tool_output?: unknown;
}
