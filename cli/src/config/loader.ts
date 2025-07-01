import { WingmanConfigSchema, type WingmanConfig } from "./schema";
import path from "node:path";
import fs from "node:fs";
import { ZodError } from "zod/v4";
import dotenv from "dotenv";
import { DEFAULT_BLOCKED_COMMANDS } from "@wingman-ai/agent";

const defaultConfig: WingmanConfig = {
	provider: "openai",
	model: "gpt-4o",
	toolAbilities: {
		blockedCommands: DEFAULT_BLOCKED_COMMANDS,
	},
};

export const loadConfig = (): WingmanConfig => {
	const wingmanDir = path.join(process.cwd(), ".wingman");
	const configPath = path.join(wingmanDir, "wingman.config.json");
	const envPath = path.join(wingmanDir, ".env");

	// Load environment variables from .wingman/.env
	if (fs.existsSync(envPath)) {
		dotenv.config({ path: envPath });
	}

	if (!fs.existsSync(configPath)) {
		console.warn("wingman.config.json not found, using default configuration.");
		return defaultConfig;
	}

	try {
		const fileContent = fs.readFileSync(configPath, "utf-8");
		const jsonContent = JSON.parse(fileContent);
		return WingmanConfigSchema.parse(jsonContent);
	} catch (error) {
		if (error instanceof ZodError) {
			console.error(
				"Invalid configuration in wingman.config.json:",
				error.message,
			);
		} else {
			console.error("Error reading or parsing wingman.config.json:", error);
		}
		return defaultConfig;
	}
};
