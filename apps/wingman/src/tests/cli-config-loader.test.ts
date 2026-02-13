import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WingmanConfigLoader } from "../cli/config/loader";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("CLI Config Loader", () => {
	let testDir: string;
	let configDir: string;
	let originalGatewayToken: string | undefined;

	beforeEach(() => {
		originalGatewayToken = process.env.WINGMAN_GATEWAY_TOKEN;
		delete process.env.WINGMAN_GATEWAY_TOKEN;
		testDir = join(tmpdir(), `wingman-test-${Date.now()}`);
		configDir = join(testDir, ".wingman");
		mkdirSync(configDir, { recursive: true });
	});

	afterEach(() => {
		if (typeof originalGatewayToken === "string") {
			process.env.WINGMAN_GATEWAY_TOKEN = originalGatewayToken;
		} else {
			delete process.env.WINGMAN_GATEWAY_TOKEN;
		}
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true, force: true });
		}
	});

	describe("Default config", () => {
		it("should return default config when file doesn't exist", () => {
			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config).toEqual({
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
					repositoryOwner: "anthropics",
					repositoryName: "skills",
					skillsDirectory: "skills",
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
					adapters: {},
				},
				agents: {
					list: [],
					bindings: [],
				},
			});
		});

		it("should have default log level of info", () => {
			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config.logLevel).toBe("info");
		});

		it("should have default recursion limit of 5000", () => {
			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config.recursionLimit).toBe(5000);
		});

		it("should have default search provider as duckduckgo", () => {
			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config.search?.provider).toBe("duckduckgo");
		});

		it("should have default CLI output mode as auto", () => {
			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config.cli?.outputMode).toBe("auto");
		});
	});

	describe("Valid configuration", () => {
		it("should load valid minimal config", () => {
			const configData = {
				logLevel: "debug",
			};

			writeFileSync(
				join(configDir, "wingman.config.json"),
				JSON.stringify(configData)
			);

			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config.logLevel).toBe("debug");
		});

		it("should load complete config", () => {
			const configData = {
				logLevel: "debug",
				defaultAgent: "coder",
				recursionLimit: 5,
				summarization: {
					enabled: true,
					maxTokensBeforeSummary: 18000,
					messagesToKeep: 10,
				},
				search: {
					provider: "perplexity",
					maxResults: 10,
				},
				cli: {
					theme: "dark",
					outputMode: "json",
				},
				skills: {
					repositoryOwner: "myorg",
					repositoryName: "myskills",
					skillsDirectory: "custom-skills",
				},
			};

			writeFileSync(
				join(configDir, "wingman.config.json"),
				JSON.stringify(configData)
			);

			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config).toMatchObject(configData);
		});

		it("should load browser profile configuration", () => {
			const configData = {
				browser: {
					profilesDir: ".wingman/browser-profiles",
					defaultProfile: "trading",
					profiles: {
						trading: ".wingman/browser-profiles/trading",
					},
				},
			};

			writeFileSync(
				join(configDir, "wingman.config.json"),
				JSON.stringify(configData),
			);

			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config.browser).toEqual({
				...configData.browser,
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
			});
		});

		it("should allow disabling summarization middleware", () => {
			const configData = {
				summarization: {
					enabled: false,
				},
			};

			writeFileSync(
				join(configDir, "wingman.config.json"),
				JSON.stringify(configData),
			);

			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config.summarization).toEqual({
				enabled: false,
				maxTokensBeforeSummary: 12000,
				messagesToKeep: 8,
			});
		});

		it("should load retry and HITL middleware config", () => {
			const configData = {
				modelRetry: {
					enabled: true,
					maxRetries: 3,
					backoffFactor: 1.5,
					initialDelayMs: 250,
					maxDelayMs: 4000,
					jitter: false,
					onFailure: "error",
				},
				toolRetry: {
					enabled: true,
					maxRetries: 4,
					backoffFactor: 2,
					initialDelayMs: 500,
					maxDelayMs: 8000,
					jitter: true,
					onFailure: "continue",
					tools: ["internet_search", "web_crawler"],
				},
				humanInTheLoop: {
					enabled: true,
					interruptOn: {
						command_execute: {
							allowedDecisions: ["approve", "reject"],
						},
					},
				},
			};

			writeFileSync(
				join(configDir, "wingman.config.json"),
				JSON.stringify(configData),
			);

			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config).toMatchObject(configData);
		});

		it("should handle all valid log levels", () => {
			const levels = ["debug", "info", "warn", "error", "silent"];

			for (const level of levels) {
				const configData = { logLevel: level };
				writeFileSync(
					join(configDir, "wingman.config.json"),
					JSON.stringify(configData)
				);

				const loader = new WingmanConfigLoader(".wingman", testDir);
				const config = loader.loadConfig();

				expect(config.logLevel).toBe(level);
			}
		});

		it("should handle all valid search providers", () => {
			const providers = ["duckduckgo", "perplexity"];

			for (const provider of providers) {
				const configData = {
					search: { provider, maxResults: 5 },
				};
				writeFileSync(
					join(configDir, "wingman.config.json"),
					JSON.stringify(configData)
				);

				const loader = new WingmanConfigLoader(".wingman", testDir);
				const config = loader.loadConfig();

				expect(config.search?.provider).toBe(provider);
			}
		});

		it("should handle all valid CLI output modes", () => {
			const modes = ["auto", "interactive", "json"];

			for (const mode of modes) {
				const configData = {
					cli: { outputMode: mode, theme: "default" },
				};
				writeFileSync(
					join(configDir, "wingman.config.json"),
					JSON.stringify(configData)
				);

				const loader = new WingmanConfigLoader(".wingman", testDir);
				const config = loader.loadConfig();

				expect(config.cli?.outputMode).toBe(mode);
			}
		});
	});

	describe("Invalid configuration", () => {
		it("should return default config for invalid JSON", () => {
			writeFileSync(
				join(configDir, "wingman.config.json"),
				"{ invalid json }"
			);

			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config.logLevel).toBe("info");
		});

		it("should return default config for invalid log level", () => {
			const configData = {
				logLevel: "invalid",
			};

			writeFileSync(
				join(configDir, "wingman.config.json"),
				JSON.stringify(configData)
			);

			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config.logLevel).toBe("info");
		});

		it("should return default config for invalid recursion limit (too low)", () => {
			const configData = {
				recursionLimit: 0,
			};

			writeFileSync(
				join(configDir, "wingman.config.json"),
				JSON.stringify(configData)
			);

			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config.recursionLimit).toBe(5000);
		});

		it("should return default config for invalid recursion limit (too high)", () => {
			const configData = {
				recursionLimit: 1000001,
			};

			writeFileSync(
				join(configDir, "wingman.config.json"),
				JSON.stringify(configData)
			);

			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config.recursionLimit).toBe(5000);
		});

		it("should return default config for invalid search provider", () => {
			const configData = {
				search: {
					provider: "invalid",
					maxResults: 5,
				},
			};

			writeFileSync(
				join(configDir, "wingman.config.json"),
				JSON.stringify(configData)
			);

			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config.search?.provider).toBe("duckduckgo");
		});
	});

	describe("Partial configuration", () => {
		it("should merge partial config with defaults", () => {
			const configData = {
				logLevel: "debug",
			};

			writeFileSync(
				join(configDir, "wingman.config.json"),
				JSON.stringify(configData)
			);

			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config.logLevel).toBe("debug");
			expect(config.recursionLimit).toBeDefined();
			expect(config.search).toBeDefined();
		});

		it("should handle partial search config", () => {
			const configData = {
				search: {
					provider: "perplexity",
				},
			};

			writeFileSync(
				join(configDir, "wingman.config.json"),
				JSON.stringify(configData)
			);

			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config.search?.provider).toBe("perplexity");
			expect(config.search?.maxResults).toBeDefined();
		});

		it("should handle partial CLI config", () => {
			const configData = {
				cli: {
					outputMode: "json",
				},
			};

			writeFileSync(
				join(configDir, "wingman.config.json"),
				JSON.stringify(configData)
			);

			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config.cli?.outputMode).toBe("json");
			expect(config.cli?.theme).toBeDefined();
		});
	});

	describe("Custom config directory", () => {
		it("should support custom config directory name", () => {
			const customDir = join(testDir, ".custom-config");
			mkdirSync(customDir, { recursive: true });

			const configData = {
				logLevel: "debug",
			};

			writeFileSync(
				join(customDir, "wingman.config.json"),
				JSON.stringify(configData)
			);

			const loader = new WingmanConfigLoader(".custom-config", testDir);
			const config = loader.loadConfig();

			expect(config.logLevel).toBe("debug");
		});
	});

	describe("Edge cases", () => {
		it("should handle empty JSON object", () => {
			writeFileSync(join(configDir, "wingman.config.json"), "{}");

			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config).toBeDefined();
			expect(config.logLevel).toBeDefined();
		});

		it("should handle config file with extra fields", () => {
			const configData = {
				logLevel: "debug",
				extraField: "should be ignored",
				nested: {
					extra: "fields",
				},
			};

			writeFileSync(
				join(configDir, "wingman.config.json"),
				JSON.stringify(configData)
			);

			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config.logLevel).toBe("debug");
		});

		it("should handle empty file", () => {
			writeFileSync(join(configDir, "wingman.config.json"), "");

			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config.logLevel).toBe("info");
		});
	});

	describe("Environment overrides", () => {
		it("should apply WINGMAN_GATEWAY_TOKEN when auth mode is token", () => {
			process.env.WINGMAN_GATEWAY_TOKEN = "env-token";
			const configData = {
				gateway: {
					auth: {
						mode: "token",
					},
				},
			};

			writeFileSync(
				join(configDir, "wingman.config.json"),
				JSON.stringify(configData)
			);

			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config.gateway.auth.token).toBe("env-token");
		});

		it("should not override token when auth mode is none", () => {
			process.env.WINGMAN_GATEWAY_TOKEN = "env-token";
			const configData = {
				gateway: {
					auth: {
						mode: "none",
					},
				},
			};

			writeFileSync(
				join(configDir, "wingman.config.json"),
				JSON.stringify(configData)
			);

			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config.gateway.auth.token).toBeUndefined();
		});

		it("should prefer config token over environment token", () => {
			process.env.WINGMAN_GATEWAY_TOKEN = "env-token";
			const configData = {
				gateway: {
					auth: {
						mode: "token",
						token: "config-token",
					},
				},
			};

			writeFileSync(
				join(configDir, "wingman.config.json"),
				JSON.stringify(configData)
			);

			const loader = new WingmanConfigLoader(".wingman", testDir);
			const config = loader.loadConfig();

			expect(config.gateway.auth.token).toBe("config-token");
		});
	});
});
