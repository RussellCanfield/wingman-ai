import type { LogLevel } from "../logger.js";

// Output modes for CLI
export type OutputMode = "interactive" | "json";

// CLI Configuration
export interface WingmanConfig {
	logLevel?: LogLevel;
	defaultAgent?: string;
	gateway?: {
		host?: string;
		port?: number;
		stateDir?: string;
		auth?: {
			mode?: "token" | "password" | "none";
			token?: string;
			password?: string;
			allowTailscale?: boolean;
		};
		controlUi?: {
			enabled?: boolean;
			port?: number;
			pairingRequired?: boolean;
			allowInsecureAuth?: boolean;
		};
		adapters?: {
			discord?: {
				enabled?: boolean;
				token?: string;
				mentionOnly?: boolean;
				allowBots?: boolean;
				allowedGuilds?: string[];
				allowedChannels?: string[];
				sessionCommand?: string;
				gatewayUrl?: string;
				gatewayToken?: string;
				gatewayPassword?: string;
				responseChunkSize?: number;
			};
		};
	};
	agents?: {
		list?: Array<{
			id: string;
			name?: string;
			default?: boolean;
			workspace?: string;
			agentDir?: string;
			model?: string;
		}>;
		bindings?: Array<{
			agentId: string;
			match: {
				channel: string;
				accountId?: string;
				guildId?: string;
				teamId?: string;
				peer?: { kind: "dm" | "group" | "channel"; id: string };
			};
		}>;
	};
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
	logFile?: string;
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

// Content Block types for rich UI
export interface TextBlock {
	content: string;
	isStreaming: boolean;
}

export interface ToolCallBlock {
	name: string;
	args: Record<string, any>;
	status: "running" | "complete" | "error";
	startTime: number;
	endTime?: number;
	result?: {
		output: string;
		truncated: boolean;
		error?: string;
	};
}

export interface ToolResultBlock {
	toolCallId: string;
	output: string;
	truncated: boolean;
	error?: string;
}

export type ContentBlockData = TextBlock | ToolCallBlock | ToolResultBlock;

export interface ContentBlock {
	id: string;
	type: "text" | "tool-call" | "tool-result";
	timestamp: number;
	data: ContentBlockData;
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
