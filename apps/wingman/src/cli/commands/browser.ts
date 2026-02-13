import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { spawn, spawnSync, type SpawnOptions } from "node:child_process";
import { randomBytes } from "node:crypto";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger, getLogFilePath } from "@/logger.js";
import { OutputManager } from "../core/outputManager.js";
import type { BrowserCommandArgs } from "../types/browser.js";

const DEFAULT_CONFIG_DIR = ".wingman";
const DEFAULT_PROFILES_DIR = ".wingman/browser-profiles";
const DEFAULT_EXTENSIONS_DIR = ".wingman/browser-extensions";
const DEFAULT_BUNDLED_EXTENSION_ID = "wingman";
const BUNDLED_EXTENSION_RELATIVE_PATH =
	"../../../extensions/wingman-browser-extension";
const PROFILE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

type JsonObject = Record<string, unknown>;
type BrowserSpawn = (
	command: string,
	args: readonly string[],
	options: SpawnOptions,
) => {
	unref: () => void;
};

export interface BrowserCommandOptions {
	workspace?: string;
	configDir?: string;
	spawnProcess?: BrowserSpawn;
	resolveExecutablePath?: (explicitPath?: string) => string;
}

export async function executeBrowserCommand(
	args: BrowserCommandArgs,
	options: BrowserCommandOptions = {},
): Promise<void> {
	const outputManager = new OutputManager(args.outputMode);

	try {
		switch (args.subcommand) {
			case "profile":
				await executeBrowserProfileCommand(args, outputManager, options);
				break;
			case "extension":
				await executeBrowserExtensionCommand(args, outputManager, options);
				break;
			case "":
			case "help":
			case "--help":
			case "-h":
				showBrowserHelp(outputManager);
				break;
			default:
				throw new Error(
					`Unknown subcommand: ${args.subcommand}. Run 'wingman browser help' for usage.`,
				);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const logFile = getLogFilePath();
		createLogger().error("Browser command failed", { error: message });

		if (outputManager.getMode() === "interactive") {
			console.error(`\nError: ${message}`);
			console.error(`Logs: ${logFile}`);
			process.exit(1);
		} else {
			outputManager.emitAgentError(error as Error);
			process.exit(1);
		}
	}
}

async function executeBrowserProfileCommand(
	args: BrowserCommandArgs,
	outputManager: OutputManager,
	options: BrowserCommandOptions,
): Promise<void> {
	const action = args.args[0] || "";

	switch (action) {
		case "init":
			await handleProfileInit(args, outputManager, options);
			break;
		case "open":
			await handleProfileOpen(args, outputManager, options);
			break;
		case "":
		case "help":
		case "--help":
		case "-h":
			showBrowserProfileHelp(outputManager);
			break;
		default:
			throw new Error(
				`Unknown browser profile subcommand: ${action}. Run 'wingman browser profile help' for usage.`,
			);
	}
}

async function executeBrowserExtensionCommand(
	args: BrowserCommandArgs,
	outputManager: OutputManager,
	options: BrowserCommandOptions,
): Promise<void> {
	const action = args.args[0] || "";

	switch (action) {
		case "install":
			await handleExtensionInstall(args, outputManager, options);
			break;
		case "path":
			await handleExtensionPath(args, outputManager, options);
			break;
		case "list":
			await handleExtensionList(args, outputManager, options);
			break;
		case "pair":
			await handleExtensionPair(args, outputManager, options);
			break;
		case "":
		case "help":
		case "--help":
		case "-h":
			showBrowserExtensionHelp(outputManager);
			break;
		default:
			throw new Error(
				`Unknown browser extension subcommand: ${action}. Run 'wingman browser extension help' for usage.`,
			);
	}
}

async function handleProfileInit(
	args: BrowserCommandArgs,
	outputManager: OutputManager,
	options: BrowserCommandOptions,
): Promise<void> {
	const profileArg = getPositionalArg(args.args, 1);
	if (!profileArg) {
		throw new Error(
			"Profile ID required. Usage: wingman browser profile init <profile-id>",
		);
	}

	const profileId = validateProfileId(profileArg);
	const workspace = options.workspace || process.cwd();
	const configDir = options.configDir || DEFAULT_CONFIG_DIR;
	const configRoot = join(workspace, configDir);
	const configPath = join(configRoot, "wingman.config.json");
	const config = readConfigObject(configPath);

	const browserConfig = readObject(config.browser);
	const profiles = readStringRecord(browserConfig.profiles);
	const force = getBooleanOption(args.options, "force");

	const profilesDirOption =
		getStringOption(args.options, "profiles-dir") ||
		getStringOption(args.options, "profilesDir");
	if (profilesDirOption) {
		browserConfig.profilesDir = profilesDirOption;
	}

	const baseProfilesDir = resolveProfilesDir(browserConfig.profilesDir);
	const profilePathOption = getStringOption(args.options, "path");
	const profilePath = profilePathOption
		? profilePathOption
		: normalizePathForConfig(join(baseProfilesDir, profileId));

	const existingProfilePath = profiles[profileId];
	if (
		existingProfilePath &&
		existingProfilePath !== profilePath &&
		!force
	) {
		throw new Error(
			`Browser profile "${profileId}" already exists at ${existingProfilePath}. Use --force to overwrite.`,
		);
	}

	profiles[profileId] = profilePath;
	browserConfig.profiles = profiles;
	browserConfig.profilesDir = baseProfilesDir;

	const requestedDefault = getBooleanOption(args.options, "default");
	const shouldSetDefault =
		requestedDefault || typeof browserConfig.defaultProfile !== "string";
	if (shouldSetDefault) {
		browserConfig.defaultProfile = profileId;
	}

	config.browser = browserConfig;

	const absoluteProfilePath = resolveProfilePath(workspace, profilePath);
	mkdirSync(absoluteProfilePath, { recursive: true });
	mkdirSync(configRoot, { recursive: true });
	writeFileSync(configPath, JSON.stringify(config, null, 2));

	writeLine(outputManager, `Initialized browser profile "${profileId}".`);
	writeLine(outputManager, `Profile directory: ${absoluteProfilePath}`);
	if (shouldSetDefault) {
		writeLine(outputManager, `Default browser profile: ${profileId}`);
	}
	writeLine(outputManager, `Saved config: ${configPath}`);
}

async function handleProfileOpen(
	args: BrowserCommandArgs,
	outputManager: OutputManager,
	options: BrowserCommandOptions,
): Promise<void> {
	const workspace = options.workspace || process.cwd();
	const configDir = options.configDir || DEFAULT_CONFIG_DIR;
	const configRoot = join(workspace, configDir);
	const configPath = join(configRoot, "wingman.config.json");
	const config = readConfigObject(configPath);
	const browserConfig = readObject(config.browser);

	const requestedProfile = getPositionalArg(args.args, 1);
	const defaultProfile =
		typeof browserConfig.defaultProfile === "string"
			? browserConfig.defaultProfile.trim()
			: "";
	const resolvedProfileId = validateProfileId(
		requestedProfile || defaultProfile || "",
	);

	const profiles = readStringRecord(browserConfig.profiles);
	const profilePath =
		profiles[resolvedProfileId] ||
		normalizePathForConfig(
			join(resolveProfilesDir(browserConfig.profilesDir), resolvedProfileId),
		);
	const absoluteProfilePath = resolveProfilePath(workspace, profilePath);
	mkdirSync(absoluteProfilePath, { recursive: true });

	const url =
		getStringOption(args.options, "url") ||
		getStringOption(args.options, "target-url") ||
		"https://example.com";
	const headless = getBooleanOption(args.options, "headless");
	const explicitExecutablePath =
		getStringOption(args.options, "executable-path") ||
		getStringOption(args.options, "executablePath");

	const resolveExecutable =
		options.resolveExecutablePath || resolveChromeExecutablePath;
	const executablePath = resolveExecutable(explicitExecutablePath);

	const defaultExtensionIds = readStringArray(browserConfig.defaultExtensions);
	const extensionArgs = resolveExtensionArgs(
		workspace,
		browserConfig,
		defaultExtensionIds,
	);
	const chromeArgs = [
		`--user-data-dir=${absoluteProfilePath}`,
		"--no-default-browser-check",
		"--no-first-run",
		"--disable-background-networking",
		"--disable-sync",
		"--mute-audio",
		...extensionArgs,
	];
	if (headless) {
		chromeArgs.push("--headless=new");
	}
	chromeArgs.push(url);

	const spawnProcess = options.spawnProcess || spawn;
	const chromeProcess = spawnProcess(executablePath, chromeArgs, {
		detached: true,
		stdio: "ignore",
	});
	chromeProcess.unref();

	writeLine(
		outputManager,
		`Opened profile "${resolvedProfileId}" at ${url} using ${absoluteProfilePath}`,
	);
	if (defaultExtensionIds.length > 0) {
		writeLine(
			outputManager,
			`Loaded default extension(s): ${defaultExtensionIds.join(", ")}`,
		);
	}
}

async function handleExtensionInstall(
	args: BrowserCommandArgs,
	outputManager: OutputManager,
	options: BrowserCommandOptions,
): Promise<void> {
	const extensionArg = getPositionalArg(args.args, 1);
	const extensionIdOption = getStringOption(args.options, "id");
	const extensionPathOption = getStringOption(args.options, "path");
	const sourcePathOption =
		getStringOption(args.options, "source") ||
		getStringOption(args.options, "from");
	const selectedId = extensionArg || extensionIdOption;
	const shouldInstallBundled = !selectedId && !extensionPathOption && !sourcePathOption;
	if (!selectedId && !shouldInstallBundled) {
		throw new Error(
			"Extension ID required when using --source/--path. Usage: wingman browser extension install [extension-id] [options]",
		);
	}

	const extensionId = validateProfileId(
		selectedId || DEFAULT_BUNDLED_EXTENSION_ID,
	);
	const workspace = options.workspace || process.cwd();
	const configDir = options.configDir || DEFAULT_CONFIG_DIR;
	const configRoot = join(workspace, configDir);
	const configPath = join(configRoot, "wingman.config.json");
	const config = readConfigObject(configPath);
	const browserConfig = readObject(config.browser);
	const force = getBooleanOption(args.options, "force");

	const extensions = readStringRecord(browserConfig.extensions);
	const extensionsDirOption =
		getStringOption(args.options, "extensions-dir") ||
		getStringOption(args.options, "extensionsDir");
	if (extensionsDirOption) {
		browserConfig.extensionsDir = extensionsDirOption;
	}
	const extensionsDir = resolveExtensionsDir(browserConfig.extensionsDir);
	const extensionPath = extensionPathOption
		? extensionPathOption
		: normalizePathForConfig(join(extensionsDir, extensionId));
	const absoluteExtensionPath = resolveProfilePath(workspace, extensionPath);
	const sourcePath =
		sourcePathOption ||
		(shouldInstallBundled ? resolveBundledExtensionSourcePath() : undefined);
	if (sourcePath) {
		const absoluteSourcePath = resolveProfilePath(workspace, sourcePath);
		if (!existsSync(absoluteSourcePath)) {
			throw new Error(`Extension source does not exist: ${absoluteSourcePath}`);
		}
		if (!statSync(absoluteSourcePath).isDirectory()) {
			throw new Error(`Extension source must be a directory: ${absoluteSourcePath}`);
		}
		if (existsSync(absoluteExtensionPath) && !force) {
			throw new Error(
				`Extension target already exists at ${absoluteExtensionPath}. Use --force to overwrite.`,
			);
		}
		cpSync(absoluteSourcePath, absoluteExtensionPath, {
			recursive: true,
			force,
		});
	}

	if (!existsSync(absoluteExtensionPath)) {
		throw new Error(
			`Extension path does not exist: ${absoluteExtensionPath}. Provide --source or --path to an unpacked extension directory.`,
		);
	}
	if (!statSync(absoluteExtensionPath).isDirectory()) {
		throw new Error(
			`Extension path must be a directory: ${absoluteExtensionPath}.`,
		);
	}
	const manifestPath = join(absoluteExtensionPath, "manifest.json");
	if (!existsSync(manifestPath)) {
		throw new Error(
			`manifest.json not found in extension directory: ${absoluteExtensionPath}.`,
		);
	}

	const existingExtensionPath = extensions[extensionId];
	if (
		existingExtensionPath &&
		existingExtensionPath !== extensionPath &&
		!force
	) {
		throw new Error(
			`Extension "${extensionId}" already exists at ${existingExtensionPath}. Use --force to overwrite.`,
		);
	}

	extensions[extensionId] = extensionPath;
	browserConfig.extensions = extensions;
	browserConfig.extensionsDir = extensionsDir;

	const setAsDefault = getBooleanOption(args.options, "default");
	if (setAsDefault) {
		const defaults = new Set(readStringArray(browserConfig.defaultExtensions));
		defaults.add(extensionId);
		browserConfig.defaultExtensions = Array.from(defaults);
	}

	config.browser = browserConfig;
	mkdirSync(configRoot, { recursive: true });
	writeFileSync(configPath, JSON.stringify(config, null, 2));

	writeLine(outputManager, `Registered extension "${extensionId}".`);
	writeLine(outputManager, `Extension directory: ${absoluteExtensionPath}`);
	if (shouldInstallBundled) {
		writeLine(
			outputManager,
			`Installed bundled Wingman extension as "${extensionId}".`,
		);
	}
	if (setAsDefault) {
		writeLine(outputManager, `Added "${extensionId}" to browser.defaultExtensions`);
	}
	writeLine(outputManager, `Saved config: ${configPath}`);
}

async function handleExtensionPath(
	args: BrowserCommandArgs,
	outputManager: OutputManager,
	options: BrowserCommandOptions,
): Promise<void> {
	const extensionArg = getPositionalArg(args.args, 1);
	if (!extensionArg) {
		throw new Error(
			"Extension ID required. Usage: wingman browser extension path <extension-id>",
		);
	}

	const extensionId = validateProfileId(extensionArg);
	const workspace = options.workspace || process.cwd();
	const configDir = options.configDir || DEFAULT_CONFIG_DIR;
	const configRoot = join(workspace, configDir);
	const configPath = join(configRoot, "wingman.config.json");
	const config = readConfigObject(configPath);
	const browserConfig = readObject(config.browser);
	const extensions = readStringRecord(browserConfig.extensions);
	const configuredPath = extensions[extensionId];
	if (!configuredPath) {
		throw new Error(
			`Extension "${extensionId}" is not configured. Run wingman browser extension install ${extensionId} --path <dir> first.`,
		);
	}

	const absoluteExtensionPath = resolveProfilePath(workspace, configuredPath);
	writeLine(outputManager, absoluteExtensionPath);
}

async function handleExtensionList(
	args: BrowserCommandArgs,
	outputManager: OutputManager,
	options: BrowserCommandOptions,
): Promise<void> {
	const workspace = options.workspace || process.cwd();
	const configDir = options.configDir || DEFAULT_CONFIG_DIR;
	const configRoot = join(workspace, configDir);
	const configPath = join(configRoot, "wingman.config.json");
	const config = readConfigObject(configPath);
	const browserConfig = readObject(config.browser);
	const extensions = readStringRecord(browserConfig.extensions);
	const defaults = new Set(readStringArray(browserConfig.defaultExtensions));

	const entries = Object.entries(extensions);
	if (entries.length === 0) {
		writeLine(outputManager, "No browser extensions configured.");
		return;
	}

	for (const [extensionId, extensionPath] of entries) {
		const marker = defaults.has(extensionId) ? " (default)" : "";
		writeLine(outputManager, `${extensionId}${marker}: ${extensionPath}`);
	}
}

async function handleExtensionPair(
	args: BrowserCommandArgs,
	outputManager: OutputManager,
	options: BrowserCommandOptions,
): Promise<void> {
	const workspace = options.workspace || process.cwd();
	const configDir = options.configDir || DEFAULT_CONFIG_DIR;
	const configRoot = join(workspace, configDir);
	const configPath = join(configRoot, "wingman.config.json");
	const config = readConfigObject(configPath);
	const browserConfig = readObject(config.browser);

	const relayConfig = readObject(browserConfig.relay);
	const relayHost = getStringOption(args.options, "host") || "127.0.0.1";
	if (!["127.0.0.1", "localhost", "::1"].includes(relayHost)) {
		throw new Error(
			`Relay host must be loopback (127.0.0.1, localhost, ::1). Received "${relayHost}".`,
		);
	}

	const relayPort =
		getNumberOption(args.options, "port") ||
		(typeof relayConfig.port === "number" ? relayConfig.port : 18792);
	if (!Number.isInteger(relayPort) || relayPort < 1 || relayPort > 65535) {
		throw new Error("Relay port must be an integer between 1 and 65535.");
	}

	const configuredToken = getStringOption(args.options, "token");
	const token = configuredToken || createRelayToken();
	if (token.length < 16) {
		throw new Error("Relay token must be at least 16 characters.");
	}

	relayConfig.enabled = true;
	relayConfig.host = relayHost;
	relayConfig.port = relayPort;
	relayConfig.requireAuth = true;
	relayConfig.authToken = token;
	if (typeof relayConfig.maxMessageBytes !== "number") {
		relayConfig.maxMessageBytes = 262_144;
	}
	browserConfig.relay = relayConfig;

	const extensionsDir = resolveExtensionsDir(browserConfig.extensionsDir);
	const extensions = readStringRecord(browserConfig.extensions);
	if (!extensions[DEFAULT_BUNDLED_EXTENSION_ID]) {
		const extensionPath = normalizePathForConfig(
			join(extensionsDir, DEFAULT_BUNDLED_EXTENSION_ID),
		);
		const absoluteExtensionPath = resolveProfilePath(workspace, extensionPath);
		const bundledSourcePath = resolveBundledExtensionSourcePath();
		mkdirSync(absoluteExtensionPath, { recursive: true });
		cpSync(bundledSourcePath, absoluteExtensionPath, {
			recursive: true,
			force: true,
		});
		extensions[DEFAULT_BUNDLED_EXTENSION_ID] = extensionPath;
	}
	browserConfig.extensions = extensions;
	browserConfig.extensionsDir = extensionsDir;

	const defaults = new Set(readStringArray(browserConfig.defaultExtensions));
	defaults.add(DEFAULT_BUNDLED_EXTENSION_ID);
	browserConfig.defaultExtensions = Array.from(defaults);

	config.browser = browserConfig;

	mkdirSync(configRoot, { recursive: true });
	writeFileSync(configPath, JSON.stringify(config, null, 2));

	writeLine(outputManager, "Configured secure browser relay pairing.");
	writeLine(outputManager, `Relay host: ${relayHost}`);
	writeLine(outputManager, `Relay port: ${relayPort}`);
	writeLine(outputManager, `Relay token: ${token}`);
	writeLine(outputManager, `Saved config: ${configPath}`);
	writeLine(
		outputManager,
		"Next: open the extension options page and set the same relay token.",
	);
}

function showBrowserHelp(outputManager: OutputManager): void {
	if (outputManager.getMode() === "interactive") {
		console.log(`
Wingman Browser Tools

Usage:
  wingman browser profile init <profile-id> [options]
  wingman browser profile open [profile-id] [options]
  wingman browser extension install [extension-id] [options]
  wingman browser extension pair [options]
  wingman browser extension path <extension-id>
  wingman browser extension list
  wingman browser extension help
  wingman browser profile help
  wingman browser help

Examples:
  wingman browser profile init trading
  wingman browser profile open trading --url https://robinhood.com/login
  wingman browser extension install --default
  wingman browser extension pair
  wingman browser extension install relay --source ./my-extension --default
  wingman browser extension path relay
  wingman browser profile init shopping --default
  wingman browser profile init work --path .wingman/profiles/work

Options:
  --workspace <dir>          Workspace root (defaults to nearest ancestor with .wingman/)
  --path <dir>               Path for profile/extension (relative to workspace or absolute)
  --profiles-dir <dir>       Base profile directory used when --path is omitted
  --extensions-dir <dir>     Base extension directory used when --path is omitted
  --source <dir>             Source directory to copy from during extension install
  --url <url>                Target URL for profile open
  --headless                 Open profile in headless mode
  --default                  Set as browser.defaultProfile or add to browser.defaultExtensions
  --force                    Overwrite existing profile/extension mapping
  --host <host>              Relay host for extension pairing (must be loopback)
  --port <port>              Relay port for extension pairing
  --token <token>            Explicit relay token for extension pairing
`);
		return;
	}

	outputManager.emitLog("info", "Browser help requested");
}

function showBrowserProfileHelp(outputManager: OutputManager): void {
	if (outputManager.getMode() === "interactive") {
		console.log(`
Wingman Browser Profile Manager

Usage:
  wingman browser profile init <profile-id> [options]
  wingman browser profile open [profile-id] [options]
  wingman browser profile help

Examples:
  wingman browser profile init trading
  wingman browser profile init work --path .wingman/profiles/work --default
  wingman browser profile open trading --url https://robinhood.com/login
`);
		return;
	}

	outputManager.emitLog("info", "Browser profile help requested");
}

function showBrowserExtensionHelp(outputManager: OutputManager): void {
	if (outputManager.getMode() === "interactive") {
		console.log(`
Wingman Browser Extension Manager

Usage:
  wingman browser extension install [extension-id] [options]
  wingman browser extension pair [options]
  wingman browser extension path <extension-id>
  wingman browser extension list
  wingman browser extension help

Examples:
  wingman browser extension install --default
  wingman browser extension pair
  wingman browser extension install relay --path .wingman/browser-extensions/relay
  wingman browser extension install relay --source ./relay-extension --default
  wingman browser extension path relay
  wingman browser extension list
`);
		return;
	}

	outputManager.emitLog("info", "Browser extension help requested");
}

function readConfigObject(configPath: string): JsonObject {
	if (!existsSync(configPath)) {
		return {};
	}

	const raw = readFileSync(configPath, "utf-8");
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error(
			"Existing wingman.config.json is invalid JSON. Fix the file or run wingman init --force.",
		);
	}

	if (!isObject(parsed)) {
		throw new Error("Existing wingman.config.json must be a JSON object.");
	}

	return { ...parsed };
}

function resolveProfilesDir(rawProfilesDir: unknown): string {
	if (typeof rawProfilesDir === "string" && rawProfilesDir.trim()) {
		return rawProfilesDir.trim();
	}
	return DEFAULT_PROFILES_DIR;
}

function resolveExtensionsDir(rawExtensionsDir: unknown): string {
	if (typeof rawExtensionsDir === "string" && rawExtensionsDir.trim()) {
		return rawExtensionsDir.trim();
	}
	return DEFAULT_EXTENSIONS_DIR;
}

function validateProfileId(value: string): string {
	const profileId = value.trim();
	if (!profileId) {
		throw new Error("Profile ID cannot be empty.");
	}
	if (!PROFILE_ID_PATTERN.test(profileId)) {
		throw new Error(
			`Invalid profile ID "${value}". Use letters, numbers, dot, underscore, or dash.`,
		);
	}
	return profileId;
}

function isObject(value: unknown): value is JsonObject {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readObject(value: unknown): JsonObject {
	if (!isObject(value)) {
		return {};
	}
	return { ...value };
}

function readStringRecord(value: unknown): Record<string, string> {
	if (!isObject(value)) {
		return {};
	}
	const result: Record<string, string> = {};
	for (const [key, innerValue] of Object.entries(value)) {
		if (key.trim() && typeof innerValue === "string") {
			result[key] = innerValue;
		}
	}
	return result;
}

function readStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim())
		.filter(Boolean);
}

function getStringOption(
	options: Record<string, unknown>,
	key: string,
): string | undefined {
	const value = options[key];
	if (typeof value === "string" && value.trim()) {
		return value.trim();
	}
	return undefined;
}

function getNumberOption(
	options: Record<string, unknown>,
	key: string,
): number | undefined {
	const value = options[key];
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string") {
		const parsed = Number.parseInt(value.trim(), 10);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}
	return undefined;
}

function getBooleanOption(
	options: Record<string, unknown>,
	key: string,
): boolean {
	const value = options[key];
	if (typeof value === "boolean") {
		return value;
	}
	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		if (["true", "1", "yes", "y", "on"].includes(normalized)) {
			return true;
		}
		if (["false", "0", "no", "n", "off"].includes(normalized)) {
			return false;
		}
	}
	return false;
}

function getPositionalArg(args: string[], index: number): string | undefined {
	const value = args[index];
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	if (!trimmed || trimmed.startsWith("--")) {
		return undefined;
	}
	return trimmed;
}

function normalizePathForConfig(pathValue: string): string {
	if (isAbsolute(pathValue)) {
		return pathValue;
	}
	return pathValue.split("\\").join("/");
}

function resolveProfilePath(workspace: string, profilePath: string): string {
	if (isAbsolute(profilePath)) {
		return profilePath;
	}
	return resolve(workspace, profilePath);
}

function resolveBundledExtensionSourcePath(): string {
	const bundledPath = resolve(
		fileURLToPath(new URL(BUNDLED_EXTENSION_RELATIVE_PATH, import.meta.url)),
	);
	const bundledManifest = join(bundledPath, "manifest.json");
	if (existsSync(bundledManifest)) {
		return bundledPath;
	}

	throw new Error(
		"Bundled Wingman extension assets were not found. Reinstall Wingman or provide --source <dir>.",
	);
}

function createRelayToken(): string {
	return randomBytes(24).toString("base64url");
}

function resolveExtensionArgs(
	workspace: string,
	browserConfig: JsonObject,
	extensionIds: string[],
): string[] {
	if (extensionIds.length === 0) {
		return ["--disable-extensions"];
	}

	const extensions = readStringRecord(browserConfig.extensions);
	const dirs = extensionIds.map((extensionId) => {
		const configuredPath = extensions[extensionId];
		if (!configuredPath) {
			throw new Error(
				`Extension "${extensionId}" is not configured in browser.extensions.`,
			);
		}
		const absolutePath = resolveProfilePath(workspace, configuredPath);
		if (!existsSync(absolutePath)) {
			throw new Error(
				`Configured extension path does not exist: ${absolutePath}.`,
			);
		}
		return absolutePath;
	});

	const joined = dirs.join(",");
	return [
		`--disable-extensions-except=${joined}`,
		`--load-extension=${joined}`,
	];
}

function getChromeCandidates(): string[] {
	const candidates = [
		process.env.WINGMAN_CHROME_EXECUTABLE,
		"google-chrome",
		"chromium-browser",
		"chromium",
	].filter((candidate): candidate is string => Boolean(candidate?.trim()));

	if (process.platform === "darwin") {
		candidates.push(
			"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
			"/Applications/Chromium.app/Contents/MacOS/Chromium",
		);
	}

	if (process.platform === "linux") {
		candidates.push(
			"/usr/bin/google-chrome",
			"/usr/bin/google-chrome-stable",
			"/usr/bin/chromium-browser",
			"/usr/bin/chromium",
		);
	}

	if (process.platform === "win32") {
		candidates.push(
			"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
			"C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
		);
	}

	return candidates;
}

function resolveBinaryFromPath(binaryName: string): string | null {
	const locator = process.platform === "win32" ? "where" : "which";
	const result = spawnSync(locator, [binaryName], { encoding: "utf-8" });
	if (result.status !== 0 || !result.stdout) {
		return null;
	}
	const firstLine = result.stdout
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find(Boolean);
	return firstLine || null;
}

function resolveChromeExecutablePath(explicitPath?: string): string {
	const candidatePool = explicitPath?.trim()
		? [explicitPath.trim()]
		: getChromeCandidates();

	for (const candidate of candidatePool) {
		if (!candidate) continue;
		if (isAbsolute(candidate) && existsSync(candidate)) {
			return candidate;
		}
		if (!isAbsolute(candidate)) {
			const fromPath = resolveBinaryFromPath(candidate);
			if (fromPath) return fromPath;
		}
	}

	if (explicitPath?.trim()) {
		throw new Error(
			`Chrome executable not found at "${explicitPath}". Provide a valid executable path.`,
		);
	}

	throw new Error(
		"No Chrome/Chromium executable found. Install Chrome/Chromium or set WINGMAN_CHROME_EXECUTABLE.",
	);
}

function writeLine(outputManager: OutputManager, message: string): void {
	if (outputManager.getMode() === "interactive") {
		console.log(message);
	} else {
		outputManager.emitLog("info", message);
	}
}
