import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { z } from "zod/v4";
import fs from "node:fs";
import path from "node:path";

const CapabilitiesConfigSchema = z.object({
	language: z.enum(["typescript", "javascript", "python", "csharp", "rust"]),
});

const WingmanConfigSchema = z.object({
	model: z
		.instanceof(BaseChatModel)
		.describe("The chat model to use for the agent"),
	capabilities: CapabilitiesConfigSchema.optional(),
});

export type WingmanConfig = z.infer<typeof WingmanConfigSchema>;

export const getWingmanConfig = (): WingmanConfig => {
	const configPath = path.join(process.cwd(), ".wingman", "config.json");
	if (!fs.existsSync(configPath)) {
		throw new Error(`Wingman config file not found at: ${configPath}`);
	}
	const configFile = fs.readFileSync(configPath, "utf-8");
	const config = JSON.parse(configFile);

	const validatedConfig = WingmanConfigSchema.parse(config);

	return validatedConfig;
};
