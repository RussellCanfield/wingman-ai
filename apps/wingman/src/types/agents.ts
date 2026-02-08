import type { HooksConfig } from "./hooks.js";
import type { MCPServersConfig } from "./mcp.js";
import type { AgentVoiceConfig } from "./voice.js";

export type WingmanAgentTool = {
	name: string;
	description?: string;
	schema?: unknown;
	invoke?: (...args: any[]) => unknown;
};

export type PromptRefinementConfig = {
	enabled?: boolean;
	instructionsPath?: string;
};

export type WingmanAgent = {
	name: string;
	systemPrompt: string;
	tools?: WingmanAgentTool[];
	skills?: string[];
	model?: unknown;
	subagents?: WingmanAgent[];
	description?: string;
	toolHooks?: HooksConfig;
	mcpConfig?: MCPServersConfig;
	mcpUseGlobal?: boolean;
	voice?: AgentVoiceConfig;
	promptRefinement?: PromptRefinementConfig;
};
