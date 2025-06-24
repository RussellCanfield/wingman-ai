import { z } from "zod";

export const WingmanConfigSchema = z.object({
	provider: z.enum(["openai", "anthropic"]).default("openai"),
	model: z.string().default("gpt-4o"),
});

export type WingmanConfig = z.infer<typeof WingmanConfigSchema>;
