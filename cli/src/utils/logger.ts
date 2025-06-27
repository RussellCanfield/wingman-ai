 import pino from "pino";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// Get log level from environment or default to 'info'
function getLogLevel(): pino.Level {
	const envLevel = process.env.WINGMAN_LOG_LEVEL?.toLowerCase();
	const validLevels: pino.Level[] = [
		"trace",
		"debug",
		"info",
		"warn",
		"error",
		"fatal",
	];

	if (envLevel && validLevels.includes(envLevel as pino.Level)) {
		return envLevel as pino.Level;
	}

	// Default to 'debug' in development, 'info' in production
	return process.env.NODE_ENV === "development" ? "debug" : "info";
}

// Ensure .wingman directory exists and return its path
function ensureLogDirectory(): string {
	const logDir = join(process.cwd(), ".wingman");
	if (!existsSync(logDir)) {
		mkdirSync(logDir, { recursive: true });
	}
	return logDir;
}

const logLevel = getLogLevel();
const logDirectory = ensureLogDirectory();

const isDevelopment = process.env.NODE_ENV === "development";

const transport = isDevelopment
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
				{
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
				},
			],
		})
	: pino.transport({
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
	cliLogger.info({ event: "startup", ...data }, "Wingman CLI starting");
};

export const logShutdown = (data?: Record<string, any>) => {
	cliLogger.info({ event: "shutdown", ...data }, "Wingman CLI shutting down");
};

export const logInputEvent = (event: string, data: Record<string, any>) => {
	inputLogger.info({ event, ...data }, `Input event: ${event}`);
};

export const logStateChange = (
	action: string,
	prevState: any,
	newState: any,
) => {
	reducerLogger.debug(
		{
			event: "state_change",
			action,
			prevState: JSON.stringify(prevState),
			newState: JSON.stringify(newState),
		},
		`State change: ${action}`,
	);
};

export const logAgentInteraction = (
	event: string,
	data: Record<string, any>,
) => {
	agentLogger.info({ event, ...data }, `Agent interaction: ${event}`);
};

export const logError = (
	component: string,
	error: Error,
	context?: Record<string, any>,
) => {
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
};

export const logPerformance = (
	component: string,
	operation: string,
	duration: number,
	data?: Record<string, any>,
) => {
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
};

// Export the current log level and file path for CLI info
export const getLogInfo = () => {
	return {
		level: logLevel,
		file: join(logDirectory, "debug.log"),
		//@ts-expect-error
		enabled: logLevel !== "silent",
	};
};
