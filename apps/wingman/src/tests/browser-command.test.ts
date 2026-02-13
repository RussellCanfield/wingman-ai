import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeBrowserCommand } from "@/cli/commands/browser.js";

describe("browser command", () => {
	let workspace: string;

	beforeEach(() => {
		workspace = join(tmpdir(), `wingman-browser-command-${Date.now()}`);
		mkdirSync(workspace, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(workspace)) {
			rmSync(workspace, { recursive: true, force: true });
		}
	});

	it("initializes a profile and writes browser config when config is missing", async () => {
		await executeBrowserCommand(
			{
				subcommand: "profile",
				args: ["init", "trading"],
				verbosity: "silent",
				outputMode: "json",
				options: {},
			},
			{ workspace },
		);

		const configPath = join(workspace, ".wingman", "wingman.config.json");
		const profilePath = join(workspace, ".wingman", "browser-profiles", "trading");

		expect(existsSync(configPath)).toBe(true);
		expect(existsSync(profilePath)).toBe(true);

		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		expect(config.browser?.profilesDir).toBe(".wingman/browser-profiles");
		expect(config.browser?.defaultProfile).toBe("trading");
		expect(config.browser?.profiles?.trading).toBe(
			".wingman/browser-profiles/trading",
		);
	});

	it("uses existing browser.profilesDir when creating profile mapping", async () => {
		const configRoot = join(workspace, ".wingman");
		const configPath = join(configRoot, "wingman.config.json");
		mkdirSync(configRoot, { recursive: true });
		writeFileSync(
			configPath,
			JSON.stringify(
				{
					logLevel: "info",
					browser: {
						profilesDir: ".wingman/profiles",
						profiles: {},
					},
				},
				null,
				2,
			),
		);

		await executeBrowserCommand(
			{
				subcommand: "profile",
				args: ["init", "work"],
				verbosity: "silent",
				outputMode: "json",
				options: {},
			},
			{ workspace },
		);

		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		expect(config.browser?.profiles?.work).toBe(".wingman/profiles/work");
		expect(existsSync(join(workspace, ".wingman", "profiles", "work"))).toBe(true);
	});

	it("fails when overwriting an existing profile mapping without --force", async () => {
		const configRoot = join(workspace, ".wingman");
		const configPath = join(configRoot, "wingman.config.json");
		mkdirSync(configRoot, { recursive: true });
		writeFileSync(
			configPath,
			JSON.stringify(
				{
					browser: {
						profilesDir: ".wingman/browser-profiles",
						profiles: {
							trading: ".wingman/browser-profiles/trading",
						},
					},
				},
				null,
				2,
			),
		);

		const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
			code?: number,
		) => {
			throw new Error(`process.exit(${code ?? "undefined"})`);
		}) as never);

		try {
			await expect(
				executeBrowserCommand(
					{
						subcommand: "profile",
						args: ["init", "trading"],
						verbosity: "silent",
						outputMode: "json",
						options: {
							path: ".wingman/alternate/trading",
						},
					},
					{ workspace },
				),
			).rejects.toThrow("process.exit(1)");
		} finally {
			exitSpy.mockRestore();
		}
	});

	it("registers an unpacked extension and marks it default", async () => {
		const sourceExtensionDir = join(workspace, "relay-extension");
		mkdirSync(sourceExtensionDir, { recursive: true });
		writeFileSync(
			join(sourceExtensionDir, "manifest.json"),
			JSON.stringify({
				manifest_version: 3,
				name: "Relay",
				version: "1.0.0",
			}),
		);

		await executeBrowserCommand(
			{
				subcommand: "extension",
				args: ["install", "relay"],
				verbosity: "silent",
				outputMode: "json",
				options: {
					source: sourceExtensionDir,
					default: true,
				},
			},
			{ workspace },
		);

		const configPath = join(workspace, ".wingman", "wingman.config.json");
		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		expect(config.browser?.extensionsDir).toBe(".wingman/browser-extensions");
		expect(config.browser?.extensions?.relay).toBe(
			".wingman/browser-extensions/relay",
		);
		expect(config.browser?.defaultExtensions).toContain("relay");
		expect(
			existsSync(join(workspace, ".wingman", "browser-extensions", "relay")),
		).toBe(true);
	});

	it("installs bundled Wingman extension when no ID/source is provided", async () => {
		await executeBrowserCommand(
			{
				subcommand: "extension",
				args: ["install"],
				verbosity: "silent",
				outputMode: "json",
				options: {
					default: true,
				},
			},
			{ workspace },
		);

		const configPath = join(workspace, ".wingman", "wingman.config.json");
		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		expect(config.browser?.extensions?.wingman).toBe(
			".wingman/browser-extensions/wingman",
		);
		expect(config.browser?.defaultExtensions).toContain("wingman");
		const manifestPath = join(
			workspace,
			".wingman",
			"browser-extensions",
			"wingman",
			"manifest.json",
		);
		expect(existsSync(manifestPath)).toBe(true);
		const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
		expect(manifest.name).toBe("Wingman Browser Relay");
		expect(manifest.background?.service_worker).toBe("background.js");
		expect(manifest.action?.default_title).toContain("Wingman Relay");
	});

	it("pairs extension relay with secure defaults and token", async () => {
		await executeBrowserCommand(
			{
				subcommand: "extension",
				args: ["pair"],
				verbosity: "silent",
				outputMode: "json",
				options: {
					token: "test-relay-token-123456",
					port: 18792,
				},
			},
			{ workspace },
		);

		const configPath = join(workspace, ".wingman", "wingman.config.json");
		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		expect(config.browser?.relay).toMatchObject({
			enabled: true,
			host: "127.0.0.1",
			port: 18792,
			requireAuth: true,
			authToken: "test-relay-token-123456",
		});
		expect(config.browser?.defaultExtensions).toContain("wingman");
		expect(config.browser?.extensions?.wingman).toBe(
			".wingman/browser-extensions/wingman",
		);
	});

	it("opens a profile with configured default extensions", async () => {
		const profileDir = join(workspace, ".wingman", "browser-profiles", "trading");
		const extensionDir = join(
			workspace,
			".wingman",
			"browser-extensions",
			"relay",
		);
		mkdirSync(profileDir, { recursive: true });
		mkdirSync(extensionDir, { recursive: true });
		writeFileSync(
			join(extensionDir, "manifest.json"),
			JSON.stringify({
				manifest_version: 3,
				name: "Relay",
				version: "1.0.0",
			}),
		);

		const configRoot = join(workspace, ".wingman");
		const configPath = join(configRoot, "wingman.config.json");
		mkdirSync(configRoot, { recursive: true });
		writeFileSync(
			configPath,
			JSON.stringify(
				{
					browser: {
						profilesDir: ".wingman/browser-profiles",
						defaultProfile: "trading",
						profiles: {
							trading: ".wingman/browser-profiles/trading",
						},
						extensionsDir: ".wingman/browser-extensions",
						extensions: {
							relay: ".wingman/browser-extensions/relay",
						},
						defaultExtensions: ["relay"],
					},
				},
				null,
				2,
			),
		);

		let spawnedCommand = "";
		let spawnedArgs: readonly string[] = [];
		let unrefCalled = false;
		await executeBrowserCommand(
			{
				subcommand: "profile",
				args: ["open"],
				verbosity: "silent",
				outputMode: "json",
				options: {
					url: "https://example.com/login",
				},
			},
			{
				workspace,
				resolveExecutablePath: () => "/Applications/Google Chrome.app/chrome",
				spawnProcess: (command, args) => {
					spawnedCommand = command;
					spawnedArgs = args;
					return {
						unref: () => {
							unrefCalled = true;
						},
					};
				},
			},
		);

		expect(spawnedCommand).toContain("Google Chrome");
		expect(spawnedArgs).toContain("https://example.com/login");
		expect(
			spawnedArgs.some((arg) => arg.startsWith("--user-data-dir=")),
		).toBe(true);
		expect(
			spawnedArgs.some((arg) => arg.startsWith("--load-extension=")),
		).toBe(true);
		expect(unrefCalled).toBe(true);
	});
});
