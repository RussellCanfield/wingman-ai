import type { OutputMode } from "../types.js";
import type { LogLevel } from "../../logger.js";

export interface ProviderCommandArgs {
	subcommand: string;
	args: string[];
	verbosity: LogLevel;
	outputMode: OutputMode;
	options: Record<string, unknown>;
}
