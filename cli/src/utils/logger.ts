import pino from "pino";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// Check for CLI arguments that enable logging
function isLoggingEnabledByArgs(): boolean {
	const args = process.argv;
	return args.includes('--verbose') || 
		   args.includes('-v') || 
		   args.includes('--debug') || 
		   args.includes('-d') ||
		   args.includes('--log');
}

// Get log level from environment, CLI args, or default to 'silent'
function getLogLevel(): pino.Level {
	const envLevel = process.env.WINGMAN_LOG_LEVEL?.toLowerCase();
	const validLevels: pino.Level[] = [
		"trace",
		"debug",
		"info",
		"warn",
		"error",
		"fatal",
		"silent",
	];

	// If explicitly set via environment variable, use that
	if (envLevel && validLevels.includes(envLevel as pino.Level)) {
		return envLevel as pino.Level;
	}

	// Check CLI arguments for logging flags
	const args = process.argv;
	if (args.includes('--debug') || args.includes('-d')) {
		return 'debug';
	}
	if (args.includes('--verbose') || args.includes('-v')) {
		return 'info';
	}
	if (args.includes('--log')) {
		return 'info';
	}

	// Default to silent - no logging unless explicitly enabled
	return 'silent';
}

// Only create log directory if logging is enabled
function ensureLogDirectory(): string | null {
	const logLevel = getLogLevel();
	if (logLevel === 'silent') {
		return null;
	}
	
	const logDir = join(process.cwd(), ".wingman");
	if (!existsSync(logDir)) {
		mkdirSync(logDir, { recursive: true });
	}
	return logDir;
}

const logLevel = getLogLevel();
const logDirectory = ensureLogDirectory();
const isLoggingEnabled = logLevel !== 'silent';

const isDevelopment = process.env.NODE_ENV === "development";

// Only create transport if logging is enabled
const transport = isLoggingEnabled
	? isDevelopment
		? pino.transport({
				targets: [
					{
						target: "pino-pretty",
						options: {
							colorize: true,
							levelFirst: true,
							translateTime: "SYS:standard",
						},
						level: logLevel,
					},
					...(logDirectory ? [{
						target: "pino-roll",
						options: {
							file: join(logDirectory, "debug"),
							extension: ".log",
							frequency: "daily",
							dateFormat: "yyyy-MM-dd",
							mkdir: true,
							size: "10M",
							files: 5,
						},
						level: logLevel,
					}] : []),
				],
			})
		: logDirectory
		? pino.transport({
				target: "pino-roll",
				options: {
					file: join(logDirectory, "debug"),
					extension: ".log",
					frequency: "daily",
					dateFormat: "yyyy-MM-dd",
					mkdir: true,
					size: "10M",
					files: 5,
				},
			})
		: pino.transport({
				target: "pino/file",
				options: {
					destination: 1, // stdout
				},
			})
	: pino.transport({
			target: "pino/file",
			options: {
				destination: "/dev/null", // Discard all logs
			},
		});

export const logger = pino(
	{
		level: logLevel,
	},
	transport,
);

// Create child loggers for different components
export const createComponentLogger = (component: string) => {
	return logger.child({ component });
};

// Convenience loggers for main components
export const cliLogger = createComponentLogger("CLI");
export const uiLogger = createComponentLogger("UI");
export const inputLogger = createComponentLogger("Input");
export const agentLogger = createComponentLogger("Agent");
export const reducerLogger = createComponentLogger("Reducer");

// Utility functions for common logging patterns
export const logStartup = (data: Record<string, any>) => {
	if (isLoggingEnabled) {
		cliLogger.info({ event: "startup", ...data }, "Wingman CLI starting");
	}
};

export const logShutdown = (data?: Record<string, any>) => {
	if (isLoggingEnabled) {
		cliLogger.info({ event: "shutdown", ...data }, "Wingman CLI shutting down");
	}
};

export const logInputEvent = (event: string, data: Record<string, any>) => {
	if (isLoggingEnabled) {
		inputLogger.info({ event, ...data }, `Input event: ${event}`);
	}
};

export const logStateChange = (
	action: string,
	prevState: any,
	newState: any,
) => {
	if (isLoggingEnabled) {
		reducerLogger.debug(
			{
				event: "state_change",
				action,
				prevState: JSON.stringify(prevState),
				newState: JSON.stringify(newState),
			},
			`State change: ${action}`,
		);
	}
};

export const logAgentInteraction = (
	event: string,
	data: Record<string, any>,
) => {
	if (isLoggingEnabled) {
		agentLogger.info({ event, ...data }, `Agent interaction: ${event}`);
	}
};

export const logError = (
	component: string,
	error: Error,
	context?: Record<string, any>,
) => {
	if (isLoggingEnabled) {
		const componentLogger = createComponentLogger(component);
		componentLogger.error(
			{
				event: "error",
				error: {
					name: error.name,
					message: error.message,
					stack: error.stack,
				},
				...context,
			},
			`Error in ${component}: ${error.message}`,
		);
	}
};

export const logPerformance = (
	component: string,
	operation: string,
	duration: number,
	data?: Record<string, any>,
) => {
	if (isLoggingEnabled) {
		const componentLogger = createComponentLogger(component);
		componentLogger.debug(
			{
				event: "performance",
				operation,
				duration,
				...data,
			},
			`${operation} completed in ${duration}ms`,
		);
	}
};

// Export the current log level and file path for CLI info
export const getLogInfo = () => {
	return {
		level: logLevel,
		file: logDirectory ? join(logDirectory, "debug.log") : null,
		enabled: isLoggingEnabled,
	};
};

// Export helper to check if logging is enabled
export const isLoggingActive = () => isLoggingEnabled;