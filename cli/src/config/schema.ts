import { z } from "zod";

export const WingmanConfigSchema = z.object({
	provider: z.enum(["openai", "anthropic", "google"]).default("openai"),
	model: z.string().default("gpt-4.1"),
});

export type WingmanConfig = z.infer<typeof WingmanConfigSchema>;
