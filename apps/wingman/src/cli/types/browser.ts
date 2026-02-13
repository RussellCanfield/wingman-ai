import type { LogLevel } from "../../logger.js";
import type { OutputMode } from "../types.js";

export interface BrowserCommandArgs {
	subcommand: string;
	args: string[];
	verbosity: LogLevel;
	outputMode: OutputMode;
	options: Record<string, unknown>;
}
