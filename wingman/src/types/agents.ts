import type { createDeepAgent } from "deepagents";
import type { HooksConfig } from "./hooks.js";
import type { MCPServersConfig } from "./mcp.js";

export type WingmanAgent = Pick<
	NonNullable<Parameters<typeof createDeepAgent>[0]>,
	"name" | "systemPrompt" | "tools" | "skills" | "model" | "subagents"
> & {
	description?: string;
	hooks?: HooksConfig;
	mcpConfig?: MCPServersConfig;
};
