import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateConfig, type WingmanConfigType } from "./schema.js";
import { collectConfigWarnings } from "./warnings.js";
import { getGatewayTokenFromEnv } from "@/gateway/env.js";
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
			const finalConfig = this.applyGatewayAuthEnvOverrides(this.getDefaultConfig());
			this.logConfigWarnings(finalConfig);
			return finalConfig;
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

			const finalConfig = this.applyGatewayAuthEnvOverrides(validation.data);
			this.logConfigWarnings(finalConfig);
			return finalConfig;
		} catch (error) {
			if (error instanceof SyntaxError) {
				this.logger.error(
					`Warning: Invalid JSON in ${configPath}: ${error.message}`,
				);
			} else {
				this.logger.error(`Warning: Failed to load config: ${error}`);
			}
			this.logger.error("Using default configuration");
			const finalConfig = this.applyGatewayAuthEnvOverrides(this.getDefaultConfig());
			this.logConfigWarnings(finalConfig);
			return finalConfig;
		}
	}

	private applyGatewayAuthEnvOverrides(config: WingmanConfigType): WingmanConfigType {
		const token = getGatewayTokenFromEnv();
		if (
			token &&
			config.gateway?.auth?.mode === "token" &&
			!config.gateway.auth.token
		) {
			return {
				...config,
				gateway: {
					...config.gateway,
					auth: {
						...config.gateway.auth,
						token,
					},
				},
			};
		}

		return config;
	}

	private getDefaultConfig(): WingmanConfigType {
		return {
			logLevel: "info",
			recursionLimit: 5000,
			summarization: {
				enabled: true,
				maxTokensBeforeSummary: 12000,
				messagesToKeep: 8,
			},
			modelRetry: {
				enabled: true,
				maxRetries: 2,
				backoffFactor: 2,
				initialDelayMs: 1000,
				maxDelayMs: 60000,
				jitter: true,
				onFailure: "continue",
			},
			toolRetry: {
				enabled: false,
				maxRetries: 2,
				backoffFactor: 2,
				initialDelayMs: 1000,
				maxDelayMs: 60000,
				jitter: true,
				onFailure: "continue",
			},
			humanInTheLoop: {
				enabled: false,
				interruptOn: {},
			},
			search: {
				provider: "duckduckgo",
				maxResults: 5,
			},
			voice: {
				provider: "web_speech",
				defaultPolicy: "off",
				webSpeech: {},
				elevenlabs: {},
			},
			cli: {
				theme: "default",
				outputMode: "auto",
			},
			skills: {
				provider: "github",
				repositoryOwner: "anthropics",
				repositoryName: "skills",
				clawhubBaseUrl: "https://clawhub.ai",
				skillsDirectory: "skills",
				security: {
					scanOnInstall: true,
					scannerCommand: "uvx",
					scannerArgs: [
						"--from",
						"mcp-scan>=0.4,<0.5",
						"mcp-scan",
						"--json",
						"--skills",
					],
					blockIssueCodes: [
						"MCP501",
						"MCP506",
						"MCP507",
						"MCP508",
						"MCP509",
						"MCP510",
						"MCP511",
					],
				},
			},
			browser: {
				profilesDir: ".wingman/browser-profiles",
				profiles: {},
				extensionsDir: ".wingman/browser-extensions",
				extensions: {},
				defaultExtensions: [],
				transport: "auto",
				relay: {
					enabled: false,
					host: "127.0.0.1",
					port: 18792,
					requireAuth: true,
					maxMessageBytes: 262_144,
				},
			},
			gateway: {
				host: "127.0.0.1",
				port: 18789,
				fsRoots: [],
				auth: {
					mode: "none",
					allowTailscale: false,
				},
				controlUi: {
					enabled: true,
					port: 18790,
					pairingRequired: true,
					allowInsecureAuth: false,
				},
				dynamicUiEnabled: true,
				mcpProxy: {
					enabled: false,
					command: "uvx",
					baseArgs: ["invariant-gateway@latest", "mcp"],
					projectName: "wingman-gateway",
					pushExplorer: false,
				},
				adapters: {},
			},
			agents: {
				list: [],
				bindings: [],
			},
		};
	}

	private logConfigWarnings(config: WingmanConfigType): void {
		const warnings = collectConfigWarnings(config);
		for (const warning of warnings) {
			this.logger.warn(`Config warning: ${warning.message}`);
		}
	}
}
