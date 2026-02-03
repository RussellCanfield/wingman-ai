import type { LogLevel } from "../../logger.js";
import type { OutputMode } from "../types.js";

/**
 * Init command arguments
 */
export interface InitCommandArgs {
	subcommand: string;
	args: string[];
	verbosity: LogLevel;
	outputMode: OutputMode;
	options: Record<string, unknown>;
	agent?: string;
}
