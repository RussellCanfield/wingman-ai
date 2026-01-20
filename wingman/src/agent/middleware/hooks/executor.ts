/**
 * Hook Executor
 *
 * Core execution engine for running hooks at lifecycle points
 * Handles command execution, timeout enforcement, and exit code handling
 */

import { spawn } from "node:child_process";
import type {
	Hook,
	HookEventName,
	HookMatcher,
	StopHook,
} from "@/types/hooks.js";
import type { HookInput } from "@/types/hooks.js";
import type { HookExecutionContext } from "./types.js";
import { buildHookInput } from "./input-builder.js";
import { findMatchingHooks } from "./matcher.js";
import type { Logger } from "@/logger.js";

/**
 * Hook execution result
 */
interface HookExecutionResult {
	success: boolean;
	stdout?: string;
	stderr?: string;
	exitCode?: number;
	timedOut?: boolean;
}

/**
 * Hook executor class
 * Manages hook execution with proper error handling and timeout enforcement
 */
export class HookExecutor {
	constructor(
		private workspace: string,
		private logger: Logger,
	) {}

	/**
	 * Execute hooks for a specific event with tool filtering
	 *
	 * @param eventName - The hook event name
	 * @param matchers - Array of hook matchers (for PreToolUse/PostToolUse)
	 * @param context - Execution context
	 * @param blocking - Whether hook failures should block execution (PreToolUse only)
	 */
	async executeHooksForEvent(
		eventName: "PreToolUse" | "PostToolUse",
		matchers: HookMatcher[] | undefined,
		context: HookExecutionContext,
		blocking = false,
	): Promise<void> {
		if (!matchers || matchers.length === 0) {
			return;
		}

		// Extract tool name from context
		const toolName = context.toolCallRequest?.tool.name;
		if (!toolName || typeof toolName !== "string") {
			this.logger.debug("No tool name in context, skipping hook execution");
			return;
		}

		// Find matching hooks
		const hooks = findMatchingHooks(matchers, toolName as string);
		if (hooks.length === 0) {
			this.logger.debug(`No hooks matched tool: ${toolName}`);
			return;
		}

		this.logger.debug(
			`Executing ${hooks.length} ${eventName} hooks for tool: ${toolName}`,
		);

		// Build hook input
		const hookInput = buildHookInput(eventName, context);

		// Execute each hook
		for (const hook of hooks) {
			await this.executeHook(hook, hookInput, eventName, blocking);
		}
	}

	/**
	 * Execute Stop hooks (no filtering needed)
	 *
	 * @param stopHooks - Array of Stop hook configurations
	 * @param context - Execution context
	 */
	async executeStopHooks(
		stopHooks: StopHook[] | undefined,
		context: HookExecutionContext,
	): Promise<void> {
		if (!stopHooks || stopHooks.length === 0) {
			return;
		}

		this.logger.debug(`Executing ${stopHooks.length} Stop hook groups`);

		// Build hook input
		const hookInput = buildHookInput("Stop", context);

		// Execute all hooks from all Stop hook groups
		for (const stopHook of stopHooks) {
			for (const hook of stopHook.hooks) {
				// Stop hooks are always non-blocking
				await this.executeHook(hook, hookInput, "Stop", false);
			}
		}
	}

	/**
	 * Execute a single hook command
	 *
	 * @param hook - The hook configuration
	 * @param hookInput - Input data to pass via stdin
	 * @param eventName - The event name (for logging)
	 * @param blocking - Whether failures should throw errors
	 */
	private async executeHook(
		hook: Hook,
		hookInput: HookInput,
		eventName: HookEventName,
		blocking: boolean,
	): Promise<void> {
		const startTime = Date.now();
		const timeoutMs = (hook.timeout || 60) * 1000;

		this.logger.debug(
			`Executing ${eventName} hook: ${hook.command} (timeout: ${hook.timeout || 60}s)`,
		);

		try {
			const result = await this.runCommand(hook.command, hookInput, timeoutMs);
			const duration = Date.now() - startTime;

			if (result.timedOut) {
				this.logger.warn(
					`Hook timed out after ${timeoutMs}ms: ${hook.command}`,
				);
				if (blocking) {
					throw new Error(`Hook timed out: ${hook.command}`);
				}
				return;
			}

			// Handle exit codes
			// Exit 0 = success
			// Exit 2 = blocking error
			// Other = non-blocking error
			if (result.exitCode === 0) {
				this.logger.info(
					`Hook completed successfully in ${duration}ms: ${hook.command}`,
				);
				if (result.stdout) {
					this.logger.debug(`Hook stdout: ${result.stdout}`);
				}
			} else if (result.exitCode === 2) {
				// Blocking error - always throw
				const errorMsg =
					result.stderr || `Hook failed with exit code 2: ${hook.command}`;
				this.logger.error(`Blocking hook error: ${errorMsg}`);
				throw new Error(errorMsg);
			} else {
				// Non-blocking error
				const errorMsg =
					result.stderr ||
					`Hook failed with exit code ${result.exitCode}: ${hook.command}`;
				this.logger.warn(`Hook failed (non-blocking): ${errorMsg}`);
				if (blocking) {
					throw new Error(errorMsg);
				}
			}
		} catch (error) {
			const duration = Date.now() - startTime;
			this.logger.error(
				`Hook execution error after ${duration}ms: ${error instanceof Error ? error.message : String(error)}`,
			);
			if (blocking) {
				throw error;
			}
		}
	}

	/**
	 * Run a shell command with JSON input via stdin
	 *
	 * @param command - The command to execute
	 * @param input - JSON input to pass via stdin
	 * @param timeoutMs - Timeout in milliseconds
	 * @returns Execution result with stdout/stderr/exitCode
	 */
	private runCommand(
		command: string,
		input: HookInput,
		timeoutMs: number,
	): Promise<HookExecutionResult> {
		return new Promise((resolve) => {
			const inputJson = JSON.stringify(input);

			// Spawn the command with shell=true to support complex commands
			const child = spawn(command, {
				cwd: this.workspace,
				shell: true,
				timeout: timeoutMs,
			});

			let stdout = "";
			let stderr = "";
			let timedOut = false;

			// Collect stdout
			child.stdout?.on("data", (data) => {
				stdout += data.toString();
			});

			// Collect stderr
			child.stderr?.on("data", (data) => {
				stderr += data.toString();
			});

			// Handle timeout
			child.on("error", (error) => {
				if (error.message.includes("ETIMEDOUT")) {
					timedOut = true;
				}
			});

			// Handle exit
			child.on("exit", (code) => {
				resolve({
					success: code === 0,
					stdout: stdout.trim(),
					stderr: stderr.trim(),
					exitCode: code || undefined,
					timedOut,
				});
			});

			// Send JSON input via stdin
			if (child.stdin) {
				child.stdin.write(inputJson);
				child.stdin.end();
			}
		});
	}
}
