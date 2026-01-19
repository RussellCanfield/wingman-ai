import { createEventLogger, type LogLevel } from "../../logger.js";
import type { OutputManager } from "./outputManager.js";

/**
 * Create a logger that bridges to the OutputManager
 * This logger emits log events that are routed through OutputManager
 * for either Ink UI display or JSON output
 */
export function createBridgedLogger(
	outputManager: OutputManager,
	level: LogLevel = "info",
) {
	return createEventLogger((event) => {
		// Don't emit if level is silent
		if (event.level !== "silent") {
			outputManager.emitLog(event.level, event.message, event.args);
		}
	}, level);
}
