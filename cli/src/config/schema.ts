import {
	WingmanAgentConfigSchema,
	DEFAULT_BLOCKED_COMMANDS,
} from "@wingman-ai/agent";
import { z } from "zod/v4";

const AgentConfig = WingmanAgentConfigSchema.pick({
	toolAbilities: true,
});

export const WingmanConfigSchema = AgentConfig.extend({
	provider: z.union([
		z.literal("openai"),
		z.literal("anthropic"),
		z.literal("google"),
	]),
	model: z.string(),
}).transform((data) => ({
	...data,
	toolAbilities: data.toolAbilities || {
		blockedCommands: DEFAULT_BLOCKED_COMMANDS,
		allowScriptExecution: true,
	},
}));

export type WingmanConfig = z.infer<typeof WingmanConfigSchema>;
