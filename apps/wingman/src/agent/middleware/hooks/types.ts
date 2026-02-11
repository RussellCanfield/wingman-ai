/**
 * Internal Hooks Types and Zod Schemas
 *
 * Validation schemas for hook configurations and runtime execution context
 */

import * as z from "zod";
import type { ToolCallRequest, ToolMessage } from "langchain";

/**
 * Zod schema for individual hook configuration
 */
export const HookSchema = z.object({
	type: z.literal("command").describe("Type of hook - currently only 'command' is supported"),
	command: z.string().min(1).describe("Shell command to execute"),
	timeout: z.number().positive().optional().default(60).describe("Timeout in seconds (default: 60)"),
});

/**
 * Zod schema for hook matcher (PreToolUse, PostToolUse)
 */
export const HookMatcherSchema = z.object({
	matcher: z.string().optional().describe("Pattern to match tool names (pipe-separated, wildcard, or regex)"),
	hooks: z.array(HookSchema).min(1).describe("Array of hooks to execute when pattern matches"),
});

/**
 * Zod schema for Stop hooks (no matcher)
 */
export const StopHookSchema = z.object({
	hooks: z.array(HookSchema).min(1).describe("Array of hooks to execute when agent stops"),
});

/**
 * Zod schema for complete hooks configuration
 */
export const HooksConfigSchema = z.object({
	PreToolUse: z.array(HookMatcherSchema).optional().describe("Hooks that fire before tool execution (can block)"),
	PostToolUse: z.array(HookMatcherSchema).optional().describe("Hooks that fire after tool completes (non-blocking)"),
	Stop: z.array(StopHookSchema).optional().describe("Hooks that fire when agent completes (non-blocking)"),
});

/**
 * Hook event names
 */
export type HookEventName = "PreToolUse" | "PostToolUse" | "Stop";

/**
 * Runtime context for hook execution
 * Contains all data needed to execute hooks for a specific event
 */
export interface HookExecutionContext {
	/** Unique session identifier */
	sessionId: string;
	/** Current working directory */
	cwd: string;
	/** Tool call request (for PreToolUse/PostToolUse) */
	toolCallRequest?: ToolCallRequest;
	/** Tool result (for PostToolUse only) */
	toolResult?: ToolMessage;
}
