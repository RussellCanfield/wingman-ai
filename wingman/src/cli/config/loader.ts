import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateConfig, type WingmanConfigType } from "./schema.js";

export class WingmanConfigLoader {
	constructor(
		private configDir = ".wingman",
		private workspace: string = process.cwd(),
	) {}

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
			return this.getDefaultConfig();
		}

		try {
			const content = readFileSync(configPath, "utf-8");
			const json = JSON.parse(content);

			const validation = validateConfig(json);
			if (!validation.success || !validation.data) {
				console.error(
					`Warning: Invalid wingman.config.json: ${validation.error}`,
				);
				console.error("Using default configuration");
				return this.getDefaultConfig();
			}

			return validation.data;
		} catch (error) {
			if (error instanceof SyntaxError) {
				console.error(
					`Warning: Invalid JSON in ${configPath}: ${error.message}`,
				);
			} else {
				console.error(`Warning: Failed to load config: ${error}`);
			}
			console.error("Using default configuration");
			return this.getDefaultConfig();
		}
	}

	private getDefaultConfig(): WingmanConfigType {
		return {
			logLevel: "info",
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
