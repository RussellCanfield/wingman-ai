import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateConfig, type WingmanConfigType } from "./schema.js";
import { createLogger, Logger } from "@/logger.js";

export class WingmanConfigLoader {
	private logger: Logger = createLogger();

	constructor(
		private configDir = ".wingman",
		private workspace: string = process.cwd(),
	) {
	}

	/**
	 * Load wingman.config.json from .wingman/ directory
	 * Returns default config if file doesn't exist or is invalid
	 */
	loadConfig(): WingmanConfigType {
		const configPath = join(
			this.workspace,
			this.configDir,
			"wingman.config.json",
		);

		// Return default config if file doesn't exist
		if (!existsSync(configPath)) {
			this.logger.info(
				`Config file not found at ${configPath}, using default configuration`,
			);
			return this.getDefaultConfig();
		}

		try {
			const content = readFileSync(configPath, "utf-8");
			const json = JSON.parse(content);

			const validation = validateConfig(json);
			if (!validation.success || !validation.data) {
				this.logger.error(
					`Warning: Invalid wingman.config.json: ${validation.error}`,
				);
				this.logger.error("Using default configuration");
				return this.getDefaultConfig();
			}

			this.logger.debug(`Loaded configuration from ${configPath} with values: ${JSON.stringify(validation.data)}`);

			return validation.data;
		} catch (error) {
			if (error instanceof SyntaxError) {
				this.logger.error(
					`Warning: Invalid JSON in ${configPath}: ${error.message}`,
				);
			} else {
				this.logger.error(`Warning: Failed to load config: ${error}`);
			}
			this.logger.error("Using default configuration");
			return this.getDefaultConfig();
		}
	}

	private getDefaultConfig(): WingmanConfigType {
		return {
			logLevel: "info",
			recursionLimit: 5000,
			search: {
				provider: "duckduckgo",
				maxResults: 5,
			},
			cli: {
				theme: "default",
				outputMode: "auto",
			},
			skills: {
				repositoryOwner: "anthropics",
				repositoryName: "skills",
				skillsDirectory: "skills",
			},
		};
	}
}
