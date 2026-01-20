import type { createDeepAgent } from "deepagents";
import type { HooksConfig } from "./hooks.js";

export type WingmanAgent = Pick<
	NonNullable<Parameters<typeof createDeepAgent>[0]>,
	"name" | "systemPrompt" | "tools" | "skills" | "model" | "subagents"
> & {
	description?: string;
	hooks?: HooksConfig;
};
