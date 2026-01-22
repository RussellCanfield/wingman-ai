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

// Output event interfaces
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
	chunk: any; // Raw chunk from deepagents/LangGraph for client-side interpretation
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

export interface SkillBrowseEvent {
	type: "skill-browse";
	skills: Array<{ name: string; description: string }>;
	timestamp: string;
}

export interface SkillInstallProgressEvent {
	type: "skill-install-progress";
	skill: string;
	status: string;
	timestamp: string;
}

export interface SkillInstallCompleteEvent {
	type: "skill-install-complete";
	skill: string;
	path: string;
	timestamp: string;
}

export interface SkillListEvent {
	type: "skill-list";
	skills: Array<{ name: string; description: string; path: string }>;
	timestamp: string;
}

export interface SkillRemoveEvent {
	type: "skill-remove";
	skill: string;
	timestamp: string;
}

// Output events union type
export type OutputEvent =
	| LogEvent
	| AgentStartEvent
	| AgentStreamEvent
	| AgentCompleteEvent
	| AgentErrorEvent
	| SkillBrowseEvent
	| SkillInstallProgressEvent
	| SkillInstallCompleteEvent
	| SkillListEvent
	| SkillRemoveEvent;

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
