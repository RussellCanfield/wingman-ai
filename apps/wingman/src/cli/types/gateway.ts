import type { LogLevel } from "../../logger.js";

/**
 * Gateway command arguments
 */
export interface GatewayCommandArgs {
	subcommand: string;
	args: string[];
	verbosity: LogLevel;

	// Start options
	host?: string;
	port?: number;
	daemon?: boolean;
	auth?: boolean;
	token?: string;

	// Join options
	url?: string;
	name?: string;

	// Logs options
	lines?: number;
	errors?: boolean;
}
