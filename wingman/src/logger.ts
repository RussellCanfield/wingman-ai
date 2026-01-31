import {
	appendFileSync,
	existsSync,
	mkdirSync,
	renameSync,
	statSync,
	unlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

interface LogWriter {
	write(chunk: string): void;
}

const DEFAULT_LOG_FILE_NAME = "wingman.log";
const DEFAULT_LOG_DIR = join(homedir(), ".wingman", "logs");
const DEFAULT_MAX_BYTES = parsePositiveInt(
	process.env.WINGMAN_LOG_MAX_BYTES,
	5 * 1024 * 1024,
);
const DEFAULT_MAX_FILES = parsePositiveInt(
	process.env.WINGMAN_LOG_MAX_FILES,
	5,
);

function serializeLogArg(arg: unknown): unknown {
	if (Error.isError(arg)) {
		return {
			name: arg.name,
			message: arg.message,
			stack: arg.stack,
		};
	}
	return arg;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
	if (!value) {
		return fallback;
	}
	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveDefaultLogFileName(): string {
	const isoDate = new Date().toISOString().slice(0, 10);
	return `wingman-${isoDate}.log`;
}

function resolveLogFilePath(): string {
	const explicitFile = process.env.WINGMAN_LOG_FILE;
	if (explicitFile && explicitFile.trim().length > 0) {
		return explicitFile;
	}

	const logDir = process.env.WINGMAN_LOG_DIR?.trim() || DEFAULT_LOG_DIR;
	return join(logDir, resolveDefaultLogFileName() || DEFAULT_LOG_FILE_NAME);
}

export function getLogFilePath(): string {
	return resolveLogFilePath();
}

export function writeToLogFile(chunk: string | Buffer): void {
	const text = typeof chunk === "string" ? chunk : chunk.toString("utf-8");
	getSharedFileWriter().write(text);
}

class RollingFileWriter implements LogWriter {
	private currentSize = 0;
	private initialized = false;
	private readonly filePath: string;
	private readonly maxBytes: number;
	private readonly maxFiles: number;

	constructor(filePath: string, maxBytes: number, maxFiles: number) {
		this.filePath = filePath;
		this.maxBytes = Math.max(1, maxBytes);
		this.maxFiles = Math.max(1, maxFiles);
	}

	write(chunk: string): void {
		try {
			this.ensureInitialized();
			const bytes = Buffer.byteLength(chunk);
			if (this.currentSize + bytes > this.maxBytes) {
				this.rotate();
				this.currentSize = 0;
			}
			appendFileSync(this.filePath, chunk);
			this.currentSize += bytes;
		} catch {
			// Ignore logging failures to avoid breaking normal execution.
		}
	}

	private ensureInitialized(): void {
		if (this.initialized) {
			return;
		}
		this.initialized = true;
		mkdirSync(dirname(this.filePath), { recursive: true });
		if (existsSync(this.filePath)) {
			this.currentSize = statSync(this.filePath).size;
		}
	}

	private rotate(): void {
		try {
			const oldest = `${this.filePath}.${this.maxFiles}`;
			if (existsSync(oldest)) {
				unlinkSync(oldest);
			}

			for (let i = this.maxFiles - 1; i >= 1; i--) {
				const source = `${this.filePath}.${i}`;
				if (existsSync(source)) {
					renameSync(source, `${this.filePath}.${i + 1}`);
				}
			}

			if (existsSync(this.filePath)) {
				renameSync(this.filePath, `${this.filePath}.1`);
			}
		} catch {
			// Ignore rotation failures and keep appending to the current file.
		}
	}
}

let sharedFileWriter: RollingFileWriter | null = null;

function getSharedFileWriter(): LogWriter {
	if (!sharedFileWriter) {
		sharedFileWriter = new RollingFileWriter(
			resolveLogFilePath(),
			DEFAULT_MAX_BYTES,
			DEFAULT_MAX_FILES,
		);
	}
	return sharedFileWriter;
}

export interface Logger {
	debug(message: string, ...args: any[]): void;
	info(message: string, ...args: any[]): void;
	warn(message: string, ...args: any[]): void;
	error(message: string, ...args: any[]): void;
}

export class WingmanLogger implements Logger {
	constructor(
		private level: LogLevel = "info",
		private output: LogWriter = getSharedFileWriter(),
	) {}

	private shouldLog(level: LogLevel): boolean {
		const levels: LogLevel[] = ["debug", "info", "warn", "error", "silent"];
		const currentIndex = levels.indexOf(this.level);
		const messageIndex = levels.indexOf(level);

		return this.level !== "silent" && messageIndex >= currentIndex;
	}

	private log(level: LogLevel, message: string, ...args: any[]): void {
		if (!this.shouldLog(level)) return;

		const timestamp = new Date().toISOString();
		const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
		this.output.write(`${prefix} ${message}\n`);

		if (args.length > 0) {
			const serialized = args.map((arg) => serializeLogArg(arg));
			this.output.write(`${JSON.stringify(serialized, null, 2)}\n`);
		}
	}

	debug(message: string, ...args: any[]): void {
		this.log("debug", message, ...args);
	}

	info(message: string, ...args: any[]): void {
		this.log("info", message, ...args);
	}

	warn(message: string, ...args: any[]): void {
		this.log("warn", message, ...args);
	}

	error(message: string, ...args: any[]): void {
		this.log("error", message, ...args);
	}
}

// Silent logger for production/CLI use
export class SilentLogger implements Logger {
	debug(): void {}
	info(): void {}
	warn(): void {}
	error(): void {}
}

// Factory function
export function createLogger(
	level: LogLevel = (process.env.WINGMAN_LOG_LEVEL as LogLevel) || "info",
): Logger {
	if (level === "silent") {
		return new SilentLogger();
	}
	return new WingmanLogger(level);
}

// Serializable logger config for worker threads
export interface SerializableLoggerConfig {
	level: LogLevel;
}

// Create logger from serializable config (for worker threads)
export function createLoggerFromConfig(config: SerializableLoggerConfig): Logger {
	return createLogger(config.level);
}

// Event-based logger for CLI and programmatic usage
export type LogEventCallback = (event: {
	level: LogLevel;
	message: string;
	timestamp: string;
	args?: any[];
}) => void;

export class EventLogger implements Logger {
	constructor(
		private callback: LogEventCallback,
		private level: LogLevel = "info",
		private secondaryLogger?: Logger,
	) {}

	private shouldLog(level: LogLevel): boolean {
		const levels: LogLevel[] = ["debug", "info", "warn", "error", "silent"];
		const currentIndex = levels.indexOf(this.level);
		const messageIndex = levels.indexOf(level);

		return this.level !== "silent" && messageIndex >= currentIndex;
	}

	private log(level: LogLevel, message: string, ...args: any[]): void {
		if (!this.shouldLog(level)) return;

		this.callback({
			level,
			message,
			timestamp: new Date().toISOString(),
			args: args.length > 0 ? args : undefined,
		});

		if (!this.secondaryLogger) {
			return;
		}

		switch (level) {
			case "debug":
				this.secondaryLogger.debug(message, ...args);
				break;
			case "info":
				this.secondaryLogger.info(message, ...args);
				break;
			case "warn":
				this.secondaryLogger.warn(message, ...args);
				break;
			case "error":
				this.secondaryLogger.error(message, ...args);
				break;
			case "silent":
				break;
		}
	}

	debug(message: string, ...args: any[]): void {
		this.log("debug", message, ...args);
	}

	info(message: string, ...args: any[]): void {
		this.log("info", message, ...args);
	}

	warn(message: string, ...args: any[]): void {
		this.log("warn", message, ...args);
	}

	error(message: string, ...args: any[]): void {
		this.log("error", message, ...args);
	}
}

// Create event-based logger
export function createEventLogger(
	callback: LogEventCallback,
	level: LogLevel = "info",
): Logger {
	return new EventLogger(callback, level, createLogger(level));
}
