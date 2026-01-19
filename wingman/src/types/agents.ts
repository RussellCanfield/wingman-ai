import type { createDeepAgent } from "deepagents";

export type WingmanAgent = Pick<
	NonNullable<Parameters<typeof createDeepAgent>[0]>,
	"name" | "systemPrompt" | "tools" | "skills" | "model" | "subagents"
> & {
	description?: string;
};
