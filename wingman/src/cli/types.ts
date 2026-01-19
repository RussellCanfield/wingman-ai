import type { LogLevel } from "../logger.js";

// Output modes for CLI
export type OutputMode = "interactive" | "json";

// CLI Configuration
export interface WingmanConfig {
	logLevel?: LogLevel;
	defaultAgent?: string;
	cli?: {
		theme?: string;
		outputMode?: "auto" | OutputMode;
	};
}

// Output events for multi-process communication
export type OutputEvent =
	| LogEvent
	| AgentStartEvent
	| AgentStreamEvent
	| AgentCompleteEvent
	| AgentErrorEvent;

export interface LogEvent {
	type: "log";
	level: LogLevel;
	message: string;
	timestamp: string;
	args?: any[];
}

export interface AgentStartEvent {
	type: "agent-start";
	agent: string;
	prompt: string;
	timestamp: string;
}

export interface AgentStreamEvent {
	type: "agent-stream";
	content: string;
	timestamp: string;
}

export interface AgentCompleteEvent {
	type: "agent-complete";
	result: any;
	timestamp: string;
}

export interface AgentErrorEvent {
	type: "agent-error";
	error: string;
	stack?: string;
	timestamp: string;
}

// CLI Arguments
export interface AgentCommandArgs {
	agent?: string;
	verbosity: LogLevel;
	outputMode: OutputMode;
	prompt: string;
}

export interface ParsedArgs {
	command: string;
	args: string[];
	flags: {
		agent?: string;
		verbose?: string;
		help?: boolean;
	};
}
