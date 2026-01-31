import type { createDeepAgent } from "deepagents";
import type { HooksConfig } from "./hooks.js";
import type { MCPServersConfig } from "./mcp.js";
import type { AgentVoiceConfig } from "./voice.js";

export type WingmanAgent = Pick<
	NonNullable<Parameters<typeof createDeepAgent>[0]>,
	"name" | "systemPrompt" | "tools" | "skills" | "model" | "subagents"
> & {
	description?: string;
	toolHooks?: HooksConfig;
	mcpConfig?: MCPServersConfig;
	mcpUseGlobal?: boolean;
	voice?: AgentVoiceConfig;
};
