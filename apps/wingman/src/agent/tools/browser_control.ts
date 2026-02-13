import {
	type ChildProcessByStdio,
	spawn,
	spawnSync,
} from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { tool } from "langchain";
import * as z from "zod";
import { createLogger } from "@/logger.js";

const logger = createLogger();

const DEVTOOLS_ENDPOINT_REGEX = /DevTools listening on (ws:\/\/\S+)/i;
const DEFAULT_ACTION_TIMEOUT_MS = 30_000;
const MAX_ACTION_TIMEOUT_MS = 300_000;
const DEFAULT_LAUNCH_TIMEOUT_MS = 15_000;
const DEFAULT_RELAY_CONNECT_TIMEOUT_MS = 5_000;
const DEFAULT_RELAY_HOST = "127.0.0.1";
const DEFAULT_RELAY_PORT = 18792;
const DEFAULT_MAX_EXTRACT_CHARS = 5_000;
const MAX_EXTRACT_CHARS = 1_000_000;
const MAX_ACTIONS = 25;
const DEFAULT_PROFILES_ROOT = ".wingman/browser-profiles";
const DEFAULT_EXTENSIONS_ROOT = ".wingman/browser-extensions";
const DEFAULT_BUNDLED_EXTENSION_ID = "wingman";
const BUNDLED_EXTENSION_RELATIVE_PATH =
	"../../../extensions/wingman-browser-extension";
const PERSISTENT_PROFILE_IGNORE_DEFAULT_ARGS = [
	"--password-store=basic",
	"--use-mock-keychain",
];
const PROFILE_LOCK_FILENAME = ".wingman-browser.lock";
const PROFILE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const CHROME_COMMON_ARGS = [
	"--disable-extensions",
	"--disable-background-networking",
	"--disable-default-apps",
	"--no-default-browser-check",
	"--no-first-run",
	"--disable-sync",
	"--disable-component-update",
	"--mute-audio",
	"--hide-scrollbars",
];

const NavigateActionSchema = z.object({
	type: z.literal("navigate"),
	url: z.string().url().describe("Destination URL"),
});

const NavigateAliasActionSchema = z.object({
	type: z.literal("url"),
	url: z.string().url().describe("Destination URL"),
});

const NavigateOpenAliasActionSchema = z.object({
	type: z.literal("open"),
	url: z.string().url().describe("Destination URL"),
});

const NavigateGotoAliasActionSchema = z.object({
	type: z.literal("goto"),
	url: z.string().url().describe("Destination URL"),
});

const ClickActionSchema = z.object({
	type: z.literal("click"),
	selector: z.string().min(1).describe("CSS selector to click"),
});

const TypeActionSchema = z.object({
	type: z.literal("type"),
	selector: z.string().min(1).describe("CSS selector to target"),
	text: z.string().describe("Text value to enter"),
	submit: z
		.boolean()
		.optional()
		.default(false)
		.describe("Press Enter after typing"),
});

const PressActionSchema = z.object({
	type: z.literal("press"),
	key: z
		.string()
		.min(1)
		.describe("Keyboard key (for example Enter, Tab, ArrowDown)"),
});

const WaitActionSchema = z.object({
	type: z.literal("wait"),
	ms: z
		.number()
		.int()
		.min(1)
		.max(MAX_ACTION_TIMEOUT_MS)
		.optional()
		.describe("How long to wait in milliseconds"),
	selector: z
		.string()
		.min(1)
		.optional()
		.describe("Wait for this selector to become visible"),
	url: z
		.string()
		.min(1)
		.optional()
		.describe("Wait for this URL/glob pattern"),
	load: z
		.enum(["load", "domcontentloaded", "networkidle"])
		.optional()
		.describe("Wait for this load state"),
	fn: z
		.string()
		.min(1)
		.optional()
		.describe("Wait for this JavaScript predicate to become truthy"),
	timeoutMs: z
		.number()
		.int()
		.min(1)
		.max(MAX_ACTION_TIMEOUT_MS)
		.optional()
		.describe("Optional timeout override in milliseconds"),
}).refine(
	(action) =>
		Boolean(
			action.ms ||
				action.selector ||
				action.url ||
				action.load ||
				action.fn,
		),
	{
		message: "wait requires ms or one of selector/url/load/fn",
	},
);

const WaitAliasActionSchema = z.object({
	type: z.literal("ms"),
	ms: z
		.number()
		.int()
		.min(1)
		.max(MAX_ACTION_TIMEOUT_MS)
		.describe("How long to wait in milliseconds"),
});

const WaitSleepAliasActionSchema = z.object({
	type: z.literal("sleep"),
	ms: z
		.number()
		.int()
		.min(1)
		.max(MAX_ACTION_TIMEOUT_MS)
		.describe("How long to wait in milliseconds"),
});

const WaitPauseAliasActionSchema = z.object({
	type: z.literal("pause"),
	ms: z
		.number()
		.int()
		.min(1)
		.max(MAX_ACTION_TIMEOUT_MS)
		.describe("How long to wait in milliseconds"),
});

const WaitForActionBaseSchema = z.object({
	selector: z
		.string()
		.min(1)
		.optional()
		.describe("Wait for this selector to become visible"),
	url: z
		.string()
		.min(1)
		.optional()
		.describe("Wait for this URL/glob pattern"),
	load: z
		.enum(["load", "domcontentloaded", "networkidle"])
		.optional()
		.describe("Wait for this load state"),
	fn: z
		.string()
		.min(1)
		.optional()
		.describe("Wait for this JavaScript predicate to become truthy"),
	timeoutMs: z
		.number()
		.int()
		.min(1)
		.max(MAX_ACTION_TIMEOUT_MS)
		.optional()
		.describe("Optional timeout override in milliseconds"),
});

const WaitForActionSchema = WaitForActionBaseSchema.extend({
	type: z.literal("wait_for"),
}).refine(
	(action) => Boolean(action.selector || action.url || action.load || action.fn),
	{
		message: "wait_for requires at least one of selector/url/load/fn",
	},
);

const WaitUntilAliasActionSchema = WaitForActionBaseSchema.extend({
	type: z.literal("wait_until"),
}).refine(
	(action) => Boolean(action.selector || action.url || action.load || action.fn),
	{
		message: "wait_until requires at least one of selector/url/load/fn",
	},
);

const ExtractTextActionSchema = z.object({
	type: z.literal("extract_text"),
	selector: z
		.string()
		.min(1)
		.optional()
		.describe("Optional CSS selector; defaults to body"),
	maxChars: z
		.number()
		.int()
		.min(1)
		.max(MAX_EXTRACT_CHARS)
		.optional()
		.default(DEFAULT_MAX_EXTRACT_CHARS)
			.describe("Maximum returned characters"),
});

const ExtractTextAliasActionSchema = z.object({
	type: z.literal("selector"),
	selector: z.string().min(1).describe("CSS selector"),
	maxChars: z
		.number()
		.int()
		.min(1)
		.max(MAX_EXTRACT_CHARS)
		.optional()
		.default(DEFAULT_MAX_EXTRACT_CHARS)
		.describe("Maximum returned characters"),
});

const ExtractAliasActionSchema = z.object({
	type: z.literal("extract"),
	selector: z
		.string()
		.min(1)
		.optional()
		.describe("Optional CSS selector; defaults to body"),
	maxChars: z
		.number()
		.int()
		.min(1)
		.max(MAX_EXTRACT_CHARS)
		.optional()
		.default(DEFAULT_MAX_EXTRACT_CHARS)
		.describe("Maximum returned characters"),
});

const GetContentAliasActionSchema = z.object({
	type: z.literal("getContent"),
	selector: z
		.string()
		.min(1)
		.optional()
		.describe("Optional CSS selector; defaults to body"),
	maxChars: z
		.number()
		.int()
		.min(1)
		.max(MAX_EXTRACT_CHARS)
		.optional()
		.default(DEFAULT_MAX_EXTRACT_CHARS)
		.describe("Maximum returned characters"),
});

const GetContentSnakeAliasActionSchema = z.object({
	type: z.literal("get_content"),
	selector: z
		.string()
		.min(1)
		.optional()
		.describe("Optional CSS selector; defaults to body"),
	maxChars: z
		.number()
		.int()
		.min(1)
		.max(MAX_EXTRACT_CHARS)
		.optional()
		.default(DEFAULT_MAX_EXTRACT_CHARS)
		.describe("Maximum returned characters"),
});

const QuerySelectorAliasActionSchema = z.object({
	type: z.literal("querySelector"),
	selector: z
		.string()
		.min(1)
		.optional()
		.describe("Optional CSS selector; defaults to body"),
	maxChars: z
		.number()
		.int()
		.min(1)
		.max(MAX_EXTRACT_CHARS)
		.optional()
		.default(DEFAULT_MAX_EXTRACT_CHARS)
		.describe("Maximum returned characters"),
});

const QuerySelectorSnakeAliasActionSchema = z.object({
	type: z.literal("query_selector"),
	selector: z
		.string()
		.min(1)
		.optional()
		.describe("Optional CSS selector; defaults to body"),
	maxChars: z
		.number()
		.int()
		.min(1)
		.max(MAX_EXTRACT_CHARS)
		.optional()
		.default(DEFAULT_MAX_EXTRACT_CHARS)
		.describe("Maximum returned characters"),
});

const ScreenshotActionSchema = z.object({
	type: z.literal("screenshot"),
	path: z
		.string()
		.min(1)
		.optional()
		.describe("Relative output path within workspace"),
	fullPage: z
		.boolean()
		.optional()
		.default(true)
			.describe("Capture the full page"),
});

const ScreenshotAliasActionSchema = z.object({
	type: z.literal("path"),
	path: z.string().min(1).describe("Relative output path within workspace"),
	fullPage: z
		.boolean()
		.optional()
		.default(true)
		.describe("Capture the full page"),
});

const SnapshotAliasActionSchema = z.object({
	type: z.literal("snapshot"),
	path: z.string().min(1).describe("Relative output path within workspace"),
	fullPage: z
		.boolean()
		.optional()
		.default(true)
		.describe("Capture the full page"),
});

const CaptureAliasActionSchema = z.object({
	type: z.literal("capture"),
	path: z.string().min(1).describe("Relative output path within workspace"),
	fullPage: z
		.boolean()
		.optional()
		.default(true)
		.describe("Capture the full page"),
});

const EvaluateActionSchema = z.object({
	type: z.literal("evaluate"),
	expression: z
		.string()
		.min(1)
		.describe("JavaScript expression to evaluate in page context"),
});

const EvaluateAliasActionSchema = z.object({
	type: z.literal("expression"),
	expression: z
		.string()
		.min(1)
		.describe("JavaScript expression to evaluate in page context"),
});

const EvaluateJsAliasActionSchema = z.object({
	type: z.literal("js"),
	expression: z
		.string()
		.min(1)
		.describe("JavaScript expression to evaluate in page context"),
});

const EvaluateScriptAliasActionSchema = z.object({
	type: z.literal("script"),
	expression: z
		.string()
		.min(1)
		.describe("JavaScript expression to evaluate in page context"),
});

const BrowserActionSchema = z.discriminatedUnion("type", [
	NavigateActionSchema,
	NavigateAliasActionSchema,
	NavigateOpenAliasActionSchema,
	NavigateGotoAliasActionSchema,
	ClickActionSchema,
	TypeActionSchema,
	PressActionSchema,
	WaitActionSchema,
	WaitAliasActionSchema,
	WaitSleepAliasActionSchema,
	WaitPauseAliasActionSchema,
	WaitForActionSchema,
	WaitUntilAliasActionSchema,
	ExtractTextActionSchema,
	ExtractTextAliasActionSchema,
	ExtractAliasActionSchema,
	GetContentAliasActionSchema,
	GetContentSnakeAliasActionSchema,
	QuerySelectorAliasActionSchema,
	QuerySelectorSnakeAliasActionSchema,
	ScreenshotActionSchema,
	ScreenshotAliasActionSchema,
	SnapshotAliasActionSchema,
	CaptureAliasActionSchema,
	EvaluateActionSchema,
	EvaluateAliasActionSchema,
	EvaluateJsAliasActionSchema,
	EvaluateScriptAliasActionSchema,
]);

const BrowserControlInputSchema = z.object({
	url: z.string().url().optional().describe("Optional initial URL to open"),
	actions: z
		.array(BrowserActionSchema)
		.max(MAX_ACTIONS)
		.optional()
		.default([])
		.describe("Ordered browser actions to execute"),
	headless: z
		.boolean()
		.optional()
		.describe(
			"Launch browser in headless mode. Non-persistent runs default to headless; persistent browser profiles default to headed unless headless is explicitly requested.",
		),
	timeoutMs: z
		.number()
		.int()
		.min(1_000)
		.max(MAX_ACTION_TIMEOUT_MS)
		.optional()
		.default(DEFAULT_ACTION_TIMEOUT_MS)
		.describe("Per-action timeout in milliseconds"),
	executablePath: z
		.string()
		.min(1)
		.optional()
		.describe(
			"Optional path to Chrome/Chromium binary. Falls back to WINGMAN_CHROME_EXECUTABLE or common install paths.",
		),
});

type BrowserControlInput = z.infer<typeof BrowserControlInputSchema>;
type BrowserAction = z.infer<typeof BrowserActionSchema>;

type BrowserPageLike = {
	goto: (
		url: string,
		options?: { waitUntil?: "domcontentloaded"; timeout?: number },
	) => Promise<unknown>;
	bringToFront?: () => Promise<unknown>;
	click: (selector: string, options?: { timeout?: number }) => Promise<unknown>;
	fill: (
		selector: string,
		text: string,
		options?: { timeout?: number },
	) => Promise<unknown>;
	keyboard: {
		press: (key: string) => Promise<unknown>;
	};
	waitForTimeout: (ms: number) => Promise<unknown>;
	waitForSelector?: (
		selector: string,
		options?: { state?: "attached" | "detached" | "visible" | "hidden"; timeout?: number },
	) => Promise<unknown>;
	waitForURL?: (
		url: string | RegExp,
		options?: { timeout?: number; waitUntil?: "load" | "domcontentloaded" | "networkidle" },
	) => Promise<unknown>;
	waitForLoadState?: (
		state?: "load" | "domcontentloaded" | "networkidle",
		options?: { timeout?: number },
	) => Promise<unknown>;
	waitForFunction?: (
		expression: string,
		arg?: unknown,
		options?: { timeout?: number },
	) => Promise<unknown>;
	textContent: (
		selector: string,
		options?: { timeout?: number },
	) => Promise<string | null>;
	evaluate: (expression: string) => Promise<unknown>;
	screenshot: (options: { path: string; fullPage?: boolean }) => Promise<unknown>;
	title: () => Promise<string>;
	url: () => string;
};

type BrowserContextLike = {
	pages: () => BrowserPageLike[];
	newPage: () => Promise<BrowserPageLike>;
	close?: () => Promise<unknown>;
};

type BrowserLike = {
	contexts: () => BrowserContextLike[];
	close: () => Promise<unknown>;
};

type LaunchPersistentContextOptions = {
	executablePath?: string;
	headless?: boolean;
	timeout?: number;
	args?: string[];
	ignoreDefaultArgs?: string[];
};

type PlaywrightLike = {
	chromium: {
		connectOverCDP: (
			wsEndpoint: string,
			options?: { timeout?: number },
		) => Promise<BrowserLike>;
		launchPersistentContext?: (
			userDataDir: string,
			options?: LaunchPersistentContextOptions,
		) => Promise<BrowserContextLike>;
	};
};

interface StartChromeInput {
	executablePath?: string;
	headless: boolean;
	launchTimeoutMs: number;
	userDataDir: string;
	chromeArgs?: string[];
}

interface StartedChromeSession {
	wsEndpoint: string;
	close: () => Promise<void>;
}

type BrowserTransportPreference = "auto" | "playwright" | "relay";
type BrowserRuntimeTransport = "cdp" | "persistent-context" | "relay-cdp";

type BrowserRelayRuntimeConfig = {
	enabled?: boolean;
	host?: string;
	port?: number;
	requireAuth?: boolean;
	authToken?: string;
};

type ResolvedBrowserRelayConfig = {
	host: string;
	port: number;
	requireAuth: boolean;
	authToken?: string;
};

interface BrowserControlDependencies {
	importPlaywright: () => Promise<PlaywrightLike>;
	startChrome: (input: StartChromeInput) => Promise<StartedChromeSession>;
	resolveRelayWsEndpoint: (
		config: ResolvedBrowserRelayConfig,
		timeoutMs: number,
	) => Promise<string>;
	mkTempDir: () => string;
	removeDir: (target: string) => void;
	now: () => number;
}

export interface BrowserControlToolOptions {
	workspace?: string;
	configWorkspace?: string;
	launchTimeoutMs?: number;
	defaultExecutablePath?: string;
	browserProfile?: string;
	browserTransport?: BrowserTransportPreference;
	relayConfig?: BrowserRelayRuntimeConfig;
	profilesRootDir?: string;
	profilePaths?: Record<string, string>;
	browserExtensions?: string[];
	extensionsRootDir?: string;
	extensionPaths?: Record<string, string>;
	defaultExtensions?: string[];
	preferPersistentLaunch?: boolean;
}

const DEFAULT_BROWSER_CONTROL_DEPENDENCIES: BrowserControlDependencies = {
	importPlaywright: async () => {
		return (await import("playwright-core")) as unknown as PlaywrightLike;
	},
	startChrome: startChromeWithDevtools,
	resolveRelayWsEndpoint: resolveRelayWsEndpoint,
	mkTempDir: () => mkdtempSync(join(tmpdir(), "wingman-browser-")),
	removeDir: (target) => rmSync(target, { recursive: true, force: true }),
	now: () => Date.now(),
};

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

function waitForDevtoolsEndpoint(
	chromeProcess: ChildProcessByStdio<null, Readable, Readable>,
	launchTimeoutMs: number,
	userDataDir: string,
): Promise<string> {
	return new Promise((resolveEndpoint, rejectEndpoint) => {
		let settled = false;
		let logs = "";
		const intervalHandle = setInterval(() => {
			const endpointFromFile = readDevtoolsEndpointFromFile(userDataDir);
			if (!endpointFromFile) return;
			finish(() => resolveEndpoint(endpointFromFile));
		}, 100);

		const finish = (callback: () => void) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeoutHandle);
			clearInterval(intervalHandle);
			chromeProcess.stdout.removeListener("data", onData);
			chromeProcess.stderr.removeListener("data", onData);
			chromeProcess.removeListener("error", onError);
			chromeProcess.removeListener("exit", onExit);
			callback();
		};

		const onData = (chunk: Buffer | string) => {
			const text = chunk.toString();
			logs += text;
			const match = text.match(DEVTOOLS_ENDPOINT_REGEX);
			if (!match?.[1]) return;
			finish(() => resolveEndpoint(match[1]));
		};

		const onError = (error: Error) => {
			finish(() =>
				rejectEndpoint(
					new Error(
						`Failed to launch Chrome for CDP connection: ${error.message}`,
					),
				),
			);
		};

		const onExit = (code: number | null) => {
			finish(() =>
				rejectEndpoint(
					new Error(
						`Chrome exited before exposing DevTools endpoint (code: ${
							code ?? "unknown"
						}). Output: ${logs.trim() || "none"}`,
					),
				),
			);
		};

		const timeoutHandle = setTimeout(() => {
			finish(() =>
				rejectEndpoint(
					new Error(
						`Timed out waiting for DevTools endpoint after ${launchTimeoutMs}ms.`,
					),
				),
			);
		}, launchTimeoutMs);

		chromeProcess.stdout.on("data", onData);
		chromeProcess.stderr.on("data", onData);
		chromeProcess.on("error", onError);
		chromeProcess.on("exit", onExit);
	});
}

function readDevtoolsEndpointFromFile(userDataDir: string): string | null {
	const activePortPath = join(userDataDir, "DevToolsActivePort");
	if (!existsSync(activePortPath)) {
		return null;
	}

	try {
		const raw = readFileSync(activePortPath, "utf-8").trim();
		if (!raw) return null;
		const [portLine, browserPathLine] = raw.split(/\r?\n/);
		const port = Number.parseInt(portLine?.trim() || "", 10);
		if (!Number.isFinite(port) || port <= 0) {
			return null;
		}
		const rawPath = browserPathLine?.trim();
		if (!rawPath) return null;
		const browserPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
		return `ws://127.0.0.1:${port}${browserPath}`;
	} catch {
		// DevToolsActivePort may be partially written while Chrome starts up.
		return null;
	}
}

async function closeChromeProcess(
	chromeProcess: ChildProcessByStdio<null, Readable, Readable>,
): Promise<void> {
	if (chromeProcess.exitCode !== null || chromeProcess.killed) {
		return;
	}

	await new Promise<void>((resolveClose) => {
		let resolved = false;
		const finish = () => {
			if (resolved) return;
			resolved = true;
			resolveClose();
		};

		const forceKillTimeout = setTimeout(() => {
			if (chromeProcess.exitCode === null && !chromeProcess.killed) {
				chromeProcess.kill("SIGKILL");
			}
		}, 2_000);

		chromeProcess.once("exit", () => {
			clearTimeout(forceKillTimeout);
			finish();
		});

		try {
			chromeProcess.kill("SIGTERM");
		} catch {
			clearTimeout(forceKillTimeout);
			finish();
		}
	});
}

export function clearStaleDevtoolsArtifacts(userDataDir: string): void {
	const activePortPath = join(userDataDir, "DevToolsActivePort");
	try {
		unlinkSync(activePortPath);
	} catch {
		// Ignore missing/stale artifact cleanup failures.
	}
}

async function startChromeWithDevtools(
	input: StartChromeInput,
): Promise<StartedChromeSession> {
	const executablePath = resolveChromeExecutablePath(input.executablePath);
	clearStaleDevtoolsArtifacts(input.userDataDir);
	const args = [
		"--remote-debugging-port=0",
		`--user-data-dir=${input.userDataDir}`,
		...(input.chromeArgs || CHROME_COMMON_ARGS),
	];
	if (input.headless) {
		args.push("--headless=new");
	}
	args.push("about:blank");

	const chromeProcess = spawn(executablePath, args, {
		stdio: ["ignore", "pipe", "pipe"],
	});

	let wsEndpoint = "";
	try {
		wsEndpoint = await waitForDevtoolsEndpoint(
			chromeProcess,
			input.launchTimeoutMs,
			input.userDataDir,
		);
	} catch (error) {
		await closeChromeProcess(chromeProcess);
		throw error;
	}

	return {
		wsEndpoint,
		close: async () => {
			await closeChromeProcess(chromeProcess);
		},
	};
}

function resolveBrowserTransportPreference(
	value: BrowserTransportPreference | undefined,
): BrowserTransportPreference {
	if (value === "playwright" || value === "relay") {
		return value;
	}
	return "auto";
}

function resolveRelayConfig(
	options: BrowserControlToolOptions,
): ResolvedBrowserRelayConfig | null {
	if (!options.relayConfig?.enabled) {
		return null;
	}
	const host = (options.relayConfig.host || DEFAULT_RELAY_HOST).trim();
	const port = Number.isInteger(options.relayConfig.port)
		? Number(options.relayConfig.port)
		: DEFAULT_RELAY_PORT;
	const requireAuth = options.relayConfig.requireAuth !== false;
	const authToken = options.relayConfig.authToken?.trim() || undefined;

	if (!host) {
		throw new Error("Browser relay host cannot be empty.");
	}
	if (!Number.isInteger(port) || port < 1 || port > 65535) {
		throw new Error(
			`Invalid browser relay port: ${String(options.relayConfig.port)}`,
		);
	}
	if (requireAuth && !authToken) {
		throw new Error(
			'Browser relay requires authToken. Run "wingman browser extension pair" and configure the extension token.',
		);
	}

	return {
		host,
		port,
		requireAuth,
		authToken,
	};
}

async function resolveRelayWsEndpoint(
	config: ResolvedBrowserRelayConfig,
	timeoutMs: number,
): Promise<string> {
	const relayHttpBase = `http://${config.host}:${config.port}`;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const versionResponse = await fetch(`${relayHttpBase}/json/version`, {
			method: "GET",
			signal: controller.signal,
		});
		if (!versionResponse.ok) {
			throw new Error(
				`Browser relay endpoint returned HTTP ${versionResponse.status}`,
			);
		}
		const payload = (await versionResponse.json()) as {
			webSocketDebuggerUrl?: string;
		};
		if (
			typeof payload?.webSocketDebuggerUrl === "string" &&
			payload.webSocketDebuggerUrl.trim()
		) {
			return payload.webSocketDebuggerUrl.trim();
		}
	} catch (error) {
		const suffix = error instanceof Error ? `: ${error.message}` : "";
		throw new Error(`Failed to resolve browser relay endpoint${suffix}`);
	} finally {
		clearTimeout(timer);
	}

	const tokenParam =
		config.requireAuth && config.authToken
			? `?token=${encodeURIComponent(config.authToken)}`
			: "";
	return `ws://${config.host}:${config.port}/cdp${tokenParam}`;
}

function preferPersistentLaunch(
	options: BrowserControlToolOptions,
	_isPersistentProfile: boolean,
): boolean {
	if (typeof options.preferPersistentLaunch === "boolean") {
		return options.preferPersistentLaunch;
	}
	// Persistent profiles are more reliable when Playwright owns launch+control.
	// This avoids CDP endpoint attach races and ECONNREFUSED errors.
	return _isPersistentProfile;
}

function resolveHeadlessMode(
	inputHeadless: boolean | undefined,
	isPersistentProfile: boolean,
): boolean {
	if (typeof inputHeadless === "boolean") {
		return inputHeadless;
	}
	return isPersistentProfile ? false : true;
}

function selectContext(contexts: BrowserContextLike[]): BrowserContextLike {
	if (contexts.length === 0) {
		throw new Error("Failed to initialize browser context.");
	}
	// CDP sessions can expose hidden/background contexts first; prefer the latest
	// context with tabs, then fall back to the newest context.
	const reversed = [...contexts].reverse();
	return reversed.find((candidate) => candidate.pages().length > 0) || reversed[0];
}

async function launchPersistentContext(
	playwright: PlaywrightLike,
	userDataDir: string,
	executablePath: string | undefined,
	headless: boolean,
	startupTimeoutMs: number,
	chromeArgs: string[],
): Promise<BrowserContextLike> {
	if (typeof playwright.chromium.launchPersistentContext !== "function") {
		throw new Error(
			"playwright-core runtime does not support launchPersistentContext.",
		);
	}

	return playwright.chromium.launchPersistentContext(userDataDir, {
		executablePath: resolveChromeExecutablePath(executablePath),
		headless,
		timeout: startupTimeoutMs,
		args: chromeArgs,
		ignoreDefaultArgs: PERSISTENT_PROFILE_IGNORE_DEFAULT_ARGS,
	});
}

function validateExtensionId(extensionId: string): string {
	const normalized = extensionId.trim();
	if (!normalized) {
		throw new Error("Extension ID cannot be empty.");
	}
	if (!PROFILE_ID_PATTERN.test(normalized)) {
		throw new Error(
			`Invalid extension ID "${extensionId}". Use letters, numbers, dot, underscore, or dash.`,
		);
	}
	return normalized;
}

function resolveExtensionPath(
	workspace: string,
	extensionId: string,
	options: BrowserControlToolOptions,
): string {
	const mappedPath = options.extensionPaths?.[extensionId];
	if (mappedPath?.trim()) {
		const trimmed = mappedPath.trim();
		return isAbsolute(trimmed) ? trimmed : resolve(workspace, trimmed);
	}

	const rootDir = options.extensionsRootDir?.trim() || DEFAULT_EXTENSIONS_ROOT;
	const absoluteRoot = isAbsolute(rootDir)
		? rootDir
		: resolve(workspace, rootDir);
	return join(absoluteRoot, extensionId);
}

function resolveBundledExtensionSourcePath(): string | null {
	const bundledPath = resolve(
		fileURLToPath(new URL(BUNDLED_EXTENSION_RELATIVE_PATH, import.meta.url)),
	);
	const bundledManifest = join(bundledPath, "manifest.json");
	return existsSync(bundledManifest) ? bundledPath : null;
}

function ensureBundledWingmanExtension(extensionPath: string): boolean {
	const bundledSourcePath = resolveBundledExtensionSourcePath();
	if (!bundledSourcePath) {
		return false;
	}

	mkdirSync(dirname(extensionPath), { recursive: true });
	cpSync(bundledSourcePath, extensionPath, {
		recursive: true,
		force: true,
	});
	return true;
}

function resolveEnabledExtensions(
	workspace: string,
	options: BrowserControlToolOptions,
): {
	extensionIds: string[];
	extensionDirs: string[];
} {
	const requestedIds = options.browserExtensions?.length
		? options.browserExtensions
		: options.defaultExtensions;
	if (!requestedIds?.length) {
		return { extensionIds: [], extensionDirs: [] };
	}

	const uniqueIds = Array.from(
		new Set(requestedIds.map((value) => validateExtensionId(value))),
	);
	const extensionDirs = uniqueIds.map((extensionId) => {
		const extensionPath = resolveExtensionPath(workspace, extensionId, options);
		if (!existsSync(extensionPath)) {
			if (
				extensionId === DEFAULT_BUNDLED_EXTENSION_ID &&
				ensureBundledWingmanExtension(extensionPath)
			) {
				logger.info(
					`browser_control auto-provisioned bundled extension "${extensionId}" at ${extensionPath}`,
				);
			}
		}
		if (!existsSync(extensionPath)) {
			throw new Error(
				`Configured extension path does not exist for "${extensionId}": ${extensionPath}`,
			);
		}
		const manifestPath = join(extensionPath, "manifest.json");
		if (!existsSync(manifestPath)) {
			throw new Error(
				`manifest.json not found for extension "${extensionId}" at ${extensionPath}`,
			);
		}
		return extensionPath;
	});

	return { extensionIds: uniqueIds, extensionDirs };
}

function buildChromeArgs(extensionDirs: string[]): string[] {
	if (extensionDirs.length === 0) {
		return CHROME_COMMON_ARGS;
	}

	const joined = extensionDirs.join(",");
	return [
		...CHROME_COMMON_ARGS.filter((arg) => arg !== "--disable-extensions"),
		`--disable-extensions-except=${joined}`,
		`--load-extension=${joined}`,
	];
}

function validateProfileId(profileId: string): string {
	const normalized = profileId.trim();
	if (!normalized) {
		throw new Error("browserProfile cannot be empty.");
	}
	if (!PROFILE_ID_PATTERN.test(normalized)) {
		throw new Error(
			`Invalid browserProfile "${profileId}". Use letters, numbers, dot, underscore, or dash.`,
		);
	}
	return normalized;
}

function resolveProfilePath(
	workspace: string,
	profileId: string,
	options: BrowserControlToolOptions,
): string {
	const normalizedProfileId = validateProfileId(profileId);
	const mappedPath = options.profilePaths?.[normalizedProfileId];
	if (mappedPath && mappedPath.trim()) {
		const trimmed = mappedPath.trim();
		return isAbsolute(trimmed) ? trimmed : resolve(workspace, trimmed);
	}

	const rootDir = options.profilesRootDir?.trim() || DEFAULT_PROFILES_ROOT;
	const absoluteRoot = isAbsolute(rootDir)
		? rootDir
		: resolve(workspace, rootDir);
	return join(absoluteRoot, normalizedProfileId);
}

type ProfileLockMetadata = {
	pid?: number;
	createdAt?: string;
};

function readProfileLockMetadata(lockPath: string): ProfileLockMetadata | null {
	try {
		const raw = readFileSync(lockPath, "utf-8");
		const parsed = JSON.parse(raw) as ProfileLockMetadata;
		if (!parsed || typeof parsed !== "object") {
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
}

function isPidAlive(pid: number): boolean {
	if (!Number.isInteger(pid) || pid <= 0) {
		return false;
	}

	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		if (
			error &&
			typeof error === "object" &&
			"code" in error &&
			error.code === "EPERM"
		) {
			// Process exists but we don't have permission to signal it.
			return true;
		}
		return false;
	}
}

function acquireProfileLock(profileDir: string): () => void {
	const lockPath = join(profileDir, PROFILE_LOCK_FILENAME);
	const writeLock = () =>
		writeFileSync(
			lockPath,
			JSON.stringify({
				pid: process.pid,
				createdAt: new Date().toISOString(),
			}),
			{ flag: "wx" },
		);

	try {
		writeLock();
	} catch (error) {
		if (
			!(
				error instanceof Error &&
				"code" in error &&
				error.code === "EEXIST"
			)
		) {
			throw error;
		}

		const lockMetadata = readProfileLockMetadata(lockPath);
		if (
			typeof lockMetadata?.pid === "number" &&
			lockMetadata.pid === process.pid
		) {
			// Same-process lock can be reused across sequential tool invocations.
			return () => {};
		}
		const stalePid =
			typeof lockMetadata?.pid === "number" && !isPidAlive(lockMetadata.pid);
		if (!stalePid) {
			throw new Error(
				`Browser profile is already in use: ${profileDir}. Wait for the other run to finish.`,
			);
		}

		try {
			unlinkSync(lockPath);
		} catch {
			throw new Error(
				`Browser profile is already in use: ${profileDir}. Wait for the other run to finish.`,
			);
		}

		try {
			writeLock();
		} catch {
			throw new Error(
				`Browser profile is already in use: ${profileDir}. Wait for the other run to finish.`,
			);
		}
	}

	let released = false;
	return () => {
		if (released) return;
		released = true;
		try {
			unlinkSync(lockPath);
		} catch {
			// Ignore lock cleanup failures
		}
	};
}

function resolveUserDataDir(
	workspace: string,
	options: BrowserControlToolOptions,
	dependencies: BrowserControlDependencies,
): {
	userDataDir: string;
	persistentProfile: boolean;
	profileId?: string;
	releaseLock?: () => void;
} {
	const configuredProfile = options.browserProfile?.trim();
	if (!configuredProfile) {
		return {
			userDataDir: dependencies.mkTempDir(),
			persistentProfile: false,
		};
	}

	const profileId = validateProfileId(configuredProfile);
	const profileDir = resolveProfilePath(workspace, profileId, options);
	mkdirSync(profileDir, { recursive: true });
	const releaseLock = acquireProfileLock(profileDir);
	return {
		userDataDir: profileDir,
		persistentProfile: true,
		profileId,
		releaseLock,
	};
}

function resolveWorkspaceRelativePath(workspace: string, targetPath: string): string {
	const absolutePath = resolve(workspace, targetPath);
	const relativePath = relative(resolve(workspace), absolutePath);
	if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
		throw new Error("Output path must stay inside the workspace.");
	}
	return absolutePath;
}

function resolveScreenshotPath(
	workspace: string,
	requestedPath: string | undefined,
	now: () => number,
	actionIndex: number,
): { absolute: string; relative: string } {
	if (requestedPath && isAbsolute(requestedPath)) {
		throw new Error("Screenshot path must be relative to the workspace.");
	}

	const fallback = join(
		".wingman",
		"browser",
		`screenshot-${now()}-${actionIndex + 1}.png`,
	);
	const relativeOutputPath = requestedPath || fallback;
	const absoluteOutputPath = resolveWorkspaceRelativePath(
		workspace,
		relativeOutputPath,
	);
	mkdirSync(dirname(absoluteOutputPath), { recursive: true });

	return {
		absolute: absoluteOutputPath,
		relative: relative(workspace, absoluteOutputPath).split("\\").join("/"),
	};
}

function serializeEvaluation(value: unknown): unknown {
	if (
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean" ||
		value === null
	) {
		return value;
	}

	try {
		return JSON.parse(JSON.stringify(value));
	} catch {
		return String(value);
	}
}

function globToRegex(globPattern: string): RegExp {
	let regex = "^";
	for (let index = 0; index < globPattern.length; index += 1) {
		const current = globPattern[index];
		const next = globPattern[index + 1];
		if (current === "*" && next === "*") {
			regex += ".*";
			index += 1;
			continue;
		}
		if (current === "*") {
			regex += "[^/]*";
			continue;
		}
		regex += current.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&");
	}
	regex += "$";
	return new RegExp(regex);
}

async function waitForUrlFallback(
	page: BrowserPageLike,
	urlPattern: string,
	timeoutMs: number,
): Promise<void> {
	const regex = globToRegex(urlPattern);
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		if (regex.test(page.url())) {
			return;
		}
		await page.waitForTimeout(100);
	}
	throw new Error(`Timed out waiting for URL pattern "${urlPattern}".`);
}

async function waitForPredicateFallback(
	page: BrowserPageLike,
	expression: string,
	timeoutMs: number,
): Promise<void> {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		const result = await page.evaluate(expression);
		if (result) {
			return;
		}
		await page.waitForTimeout(100);
	}
	throw new Error("Timed out waiting for JavaScript predicate to become truthy.");
}

async function runConditionalWait(
	page: BrowserPageLike,
	action: z.infer<typeof WaitForActionSchema> | z.infer<typeof WaitUntilAliasActionSchema>,
	timeoutMs: number,
): Promise<Record<string, unknown>> {
	const waitTimeoutMs = action.timeoutMs ?? timeoutMs;

	if (action.selector) {
		if (typeof page.waitForSelector === "function") {
			await page.waitForSelector(action.selector, {
				state: "visible",
				timeout: waitTimeoutMs,
			});
		} else {
			await page.textContent(action.selector, {
				timeout: waitTimeoutMs,
			});
		}
	}

	if (action.url) {
		if (typeof page.waitForURL === "function") {
			await page.waitForURL(globToRegex(action.url), { timeout: waitTimeoutMs });
		} else {
			await waitForUrlFallback(page, action.url, waitTimeoutMs);
		}
	}

	if (action.load && typeof page.waitForLoadState === "function") {
		await page.waitForLoadState(action.load, { timeout: waitTimeoutMs });
	}

	if (action.fn) {
		if (typeof page.waitForFunction === "function") {
			await page.waitForFunction(action.fn, undefined, { timeout: waitTimeoutMs });
		} else {
			await waitForPredicateFallback(page, action.fn, waitTimeoutMs);
		}
	}

	return {
		type: "wait_for",
		selector: action.selector || null,
		url: action.url || null,
		load: action.load || null,
		fn: action.fn || null,
		timeoutMs: waitTimeoutMs,
	};
}

async function runAction(
	page: BrowserPageLike,
	action: BrowserAction,
	timeoutMs: number,
	workspace: string,
	now: () => number,
	actionIndex: number,
): Promise<Record<string, unknown>> {
	switch (action.type) {
		case "navigate": {
			await page.goto(action.url, {
				waitUntil: "domcontentloaded",
				timeout: timeoutMs,
			});
			return { type: action.type, url: action.url };
		}
		case "url": {
			await page.goto(action.url, {
				waitUntil: "domcontentloaded",
				timeout: timeoutMs,
			});
			return { type: "navigate", url: action.url };
		}
		case "open": {
			await page.goto(action.url, {
				waitUntil: "domcontentloaded",
				timeout: timeoutMs,
			});
			return { type: "navigate", url: action.url };
		}
		case "goto": {
			await page.goto(action.url, {
				waitUntil: "domcontentloaded",
				timeout: timeoutMs,
			});
			return { type: "navigate", url: action.url };
		}
		case "click": {
			await page.click(action.selector, { timeout: timeoutMs });
			return { type: action.type, selector: action.selector };
		}
		case "type": {
			await page.fill(action.selector, action.text, { timeout: timeoutMs });
			if (action.submit) {
				await page.keyboard.press("Enter");
			}
			return {
				type: action.type,
				selector: action.selector,
				textLength: action.text.length,
				submit: Boolean(action.submit),
			};
		}
		case "press": {
			await page.keyboard.press(action.key);
			return { type: action.type, key: action.key };
		}
		case "wait": {
			if (typeof action.ms === "number") {
				await page.waitForTimeout(action.ms);
				return { type: action.type, ms: action.ms };
			}
			return runConditionalWait(
				page,
				{
					type: "wait_for",
					selector: action.selector,
					url: action.url,
					load: action.load,
					fn: action.fn,
					timeoutMs: action.timeoutMs,
				},
				timeoutMs,
			);
		}
		case "ms": {
			await page.waitForTimeout(action.ms);
			return { type: "wait", ms: action.ms };
		}
		case "sleep": {
			await page.waitForTimeout(action.ms);
			return { type: "wait", ms: action.ms };
		}
		case "pause": {
			await page.waitForTimeout(action.ms);
			return { type: "wait", ms: action.ms };
		}
		case "wait_for": {
			return runConditionalWait(page, action, timeoutMs);
		}
		case "wait_until": {
			return runConditionalWait(page, action, timeoutMs);
		}
		case "extract_text": {
			const selector = action.selector || "body";
			const content = await page.textContent(selector, { timeout: timeoutMs });
			const text = content || "";
			const maxChars = action.maxChars ?? DEFAULT_MAX_EXTRACT_CHARS;
			return {
				type: action.type,
				selector,
				text: text.slice(0, maxChars),
				truncated: text.length > maxChars,
			};
		}
		case "selector": {
			const content = await page.textContent(action.selector, {
				timeout: timeoutMs,
			});
			const text = content || "";
			const maxChars = action.maxChars ?? DEFAULT_MAX_EXTRACT_CHARS;
			return {
				type: "extract_text",
				selector: action.selector,
				text: text.slice(0, maxChars),
				truncated: text.length > maxChars,
			};
		}
		case "extract": {
			const selector = action.selector || "body";
			const content = await page.textContent(selector, { timeout: timeoutMs });
			const text = content || "";
			const maxChars = action.maxChars ?? DEFAULT_MAX_EXTRACT_CHARS;
			return {
				type: "extract_text",
				selector,
				text: text.slice(0, maxChars),
				truncated: text.length > maxChars,
			};
		}
		case "getContent": {
			const selector = action.selector || "body";
			const content = await page.textContent(selector, { timeout: timeoutMs });
			const text = content || "";
			const maxChars = action.maxChars ?? DEFAULT_MAX_EXTRACT_CHARS;
			return {
				type: "extract_text",
				selector,
				text: text.slice(0, maxChars),
				truncated: text.length > maxChars,
			};
		}
		case "get_content": {
			const selector = action.selector || "body";
			const content = await page.textContent(selector, { timeout: timeoutMs });
			const text = content || "";
			const maxChars = action.maxChars ?? DEFAULT_MAX_EXTRACT_CHARS;
			return {
				type: "extract_text",
				selector,
				text: text.slice(0, maxChars),
				truncated: text.length > maxChars,
			};
		}
		case "querySelector": {
			const selector = action.selector || "body";
			const content = await page.textContent(selector, { timeout: timeoutMs });
			const text = content || "";
			const maxChars = action.maxChars ?? DEFAULT_MAX_EXTRACT_CHARS;
			return {
				type: "extract_text",
				selector,
				text: text.slice(0, maxChars),
				truncated: text.length > maxChars,
			};
		}
		case "query_selector": {
			const selector = action.selector || "body";
			const content = await page.textContent(selector, { timeout: timeoutMs });
			const text = content || "";
			const maxChars = action.maxChars ?? DEFAULT_MAX_EXTRACT_CHARS;
			return {
				type: "extract_text",
				selector,
				text: text.slice(0, maxChars),
				truncated: text.length > maxChars,
			};
		}
		case "screenshot": {
			const screenshotPath = resolveScreenshotPath(
				workspace,
				action.path,
				now,
				actionIndex,
			);
			await page.screenshot({
				path: screenshotPath.absolute,
				fullPage: action.fullPage,
			});
			return {
				type: action.type,
				path: screenshotPath.relative,
				fullPage: Boolean(action.fullPage),
			};
		}
		case "path": {
			const screenshotPath = resolveScreenshotPath(
				workspace,
				action.path,
				now,
				actionIndex,
			);
			await page.screenshot({
				path: screenshotPath.absolute,
				fullPage: action.fullPage,
			});
			return {
				type: "screenshot",
				path: screenshotPath.relative,
				fullPage: Boolean(action.fullPage),
			};
		}
		case "snapshot": {
			const screenshotPath = resolveScreenshotPath(
				workspace,
				action.path,
				now,
				actionIndex,
			);
			await page.screenshot({
				path: screenshotPath.absolute,
				fullPage: action.fullPage,
			});
			return {
				type: "screenshot",
				path: screenshotPath.relative,
				fullPage: Boolean(action.fullPage),
			};
		}
		case "capture": {
			const screenshotPath = resolveScreenshotPath(
				workspace,
				action.path,
				now,
				actionIndex,
			);
			await page.screenshot({
				path: screenshotPath.absolute,
				fullPage: action.fullPage,
			});
			return {
				type: "screenshot",
				path: screenshotPath.relative,
				fullPage: Boolean(action.fullPage),
			};
		}
		case "evaluate": {
			const result = await page.evaluate(action.expression);
			return {
				type: action.type,
				expression: action.expression,
				result: serializeEvaluation(result),
			};
		}
		case "expression": {
			const result = await page.evaluate(action.expression);
			return {
				type: "evaluate",
				expression: action.expression,
				result: serializeEvaluation(result),
			};
		}
		case "js": {
			const result = await page.evaluate(action.expression);
			return {
				type: "evaluate",
				expression: action.expression,
				result: serializeEvaluation(result),
			};
		}
		case "script": {
			const result = await page.evaluate(action.expression);
			return {
				type: "evaluate",
				expression: action.expression,
				result: serializeEvaluation(result),
			};
		}
		default:
			throw new Error(`Unsupported browser action type: ${(action as any).type}`);
	}
}

export const createBrowserControlTool = (
	options: BrowserControlToolOptions = {},
	dependencies: Partial<BrowserControlDependencies> = {},
) => {
	const workspace = options.workspace || process.cwd();
	const configWorkspace = options.configWorkspace || workspace;
	const launchTimeoutMs = options.launchTimeoutMs || DEFAULT_LAUNCH_TIMEOUT_MS;
	const deps: BrowserControlDependencies = {
		...DEFAULT_BROWSER_CONTROL_DEPENDENCIES,
		...dependencies,
	};

	return tool(
		async (input: BrowserControlInput) => {
			let userDataDirSelection:
				| ReturnType<typeof resolveUserDataDir>
				| null = null;
			let chromeSession: StartedChromeSession | null = null;
			let browser: BrowserLike | null = null;
			let launchedContext: BrowserContextLike | null = null;
			let browserTransport: BrowserRuntimeTransport = "cdp";
			let transportFallbackReason: string | null = null;
			const transportRequested = resolveBrowserTransportPreference(
				options.browserTransport,
			);
			let reusedExistingCdpSession = false;
			let context: BrowserContextLike | null = null;

			try {
				userDataDirSelection = resolveUserDataDir(
					configWorkspace,
					options,
					deps,
				);
				const selectedUserDataDir = userDataDirSelection;
				if (!selectedUserDataDir) {
					throw new Error("Failed to resolve browser user data directory.");
				}
				const headless = resolveHeadlessMode(
					input.headless,
					selectedUserDataDir.persistentProfile,
				);
				const timeoutMs = input.timeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS;
				const startupTimeoutMs = Math.max(launchTimeoutMs, timeoutMs);
				const playwright = await deps.importPlaywright();
				const relayConfig = resolveRelayConfig(options);
				const executablePath =
					input.executablePath || options.defaultExecutablePath;
				const { extensionIds, extensionDirs } = resolveEnabledExtensions(
					configWorkspace,
					options,
				);
				const chromeArgs = buildChromeArgs(extensionDirs);
				const usePersistentLaunch = preferPersistentLaunch(
					options,
					selectedUserDataDir.persistentProfile,
				);
				const closeTransientSessions = async () => {
					if (launchedContext?.close) {
						try {
							await launchedContext.close();
						} catch {
							// Ignore close failures.
						}
						launchedContext = null;
					}
					if (browser) {
						if (!reusedExistingCdpSession) {
							try {
								await browser.close();
							} catch {
								// Ignore close failures.
							}
						}
						browser = null;
					}
					if (chromeSession) {
						try {
							await chromeSession.close();
						} catch {
							// Ignore close failures.
						}
						chromeSession = null;
					}
					context = null;
					reusedExistingCdpSession = false;
				};

				const initializeViaRelay = async (connectTimeoutMs: number) => {
					if (!relayConfig) {
						throw new Error(
							"Browser relay transport requested but browser.relay.enabled is false.",
						);
					}
					const relayWsEndpoint = await deps.resolveRelayWsEndpoint(
						relayConfig,
						connectTimeoutMs,
					);
					browser = await playwright.chromium.connectOverCDP(relayWsEndpoint, {
						timeout: connectTimeoutMs,
					});
					context = selectContext(browser.contexts());
					browserTransport = "relay-cdp";
					reusedExistingCdpSession = false;
				};

				const initializeViaPlaywright = async () => {
					if (usePersistentLaunch) {
						launchedContext = await launchPersistentContext(
							playwright,
							selectedUserDataDir.userDataDir,
							executablePath,
							headless,
							startupTimeoutMs,
							chromeArgs,
						);
						context = launchedContext;
						browserTransport = "persistent-context";
						return;
					}

					if (selectedUserDataDir.persistentProfile) {
						const existingWsEndpoint = readDevtoolsEndpointFromFile(
							selectedUserDataDir.userDataDir,
						);
						if (existingWsEndpoint) {
							try {
								browser = await playwright.chromium.connectOverCDP(
									existingWsEndpoint,
									{ timeout: startupTimeoutMs },
								);
								context = selectContext(browser.contexts());
								reusedExistingCdpSession = true;
							} catch (reuseError) {
								logger.warn(
									`browser_control failed to attach to existing CDP endpoint, launching a fresh session: ${
										reuseError instanceof Error
											? reuseError.message
											: String(reuseError)
									}`,
								);
								if (browser) {
									try {
										await browser.close();
									} catch {
										// Ignore close failures while recovering from attach failure.
									}
									browser = null;
								}
							}
						}
					}

					if (!context) {
						chromeSession = await deps.startChrome({
							executablePath,
							headless,
							launchTimeoutMs: startupTimeoutMs,
							userDataDir: selectedUserDataDir.userDataDir,
							chromeArgs,
						});

						try {
							browser = await playwright.chromium.connectOverCDP(
								chromeSession.wsEndpoint,
								{ timeout: startupTimeoutMs },
							);
							context = selectContext(browser.contexts());
						} catch (cdpError) {
							const cdpMessage =
								cdpError instanceof Error ? cdpError.message : String(cdpError);
							if (browser) {
								try {
									await browser.close();
								} catch {
									// Ignore close failures during fallback/retry.
								}
								browser = null;
							}
							if (chromeSession) {
								try {
									await chromeSession.close();
								} catch {
									// Ignore close failures during fallback/retry.
								}
								chromeSession = null;
							}

							if (selectedUserDataDir.persistentProfile) {
								logger.warn(
									`browser_control CDP connection failed for persistent profile, retrying CDP once: ${cdpMessage}`,
								);
								try {
									chromeSession = await deps.startChrome({
										executablePath,
										headless,
										launchTimeoutMs: startupTimeoutMs,
										userDataDir: selectedUserDataDir.userDataDir,
										chromeArgs,
									});
									browser = await playwright.chromium.connectOverCDP(
										chromeSession.wsEndpoint,
										{ timeout: startupTimeoutMs },
									);
									context = selectContext(browser.contexts());
								} catch (retryError) {
									const retryMessage =
										retryError instanceof Error
											? retryError.message
											: String(retryError);
									if (browser) {
										try {
											await browser.close();
										} catch {
											// Ignore close failures while switching transport.
										}
										browser = null;
									}
									if (chromeSession) {
										try {
											await chromeSession.close();
										} catch {
											// Ignore close failures while switching transport.
										}
										chromeSession = null;
									}

									const launchPersistent =
										playwright.chromium.launchPersistentContext;
									if (typeof launchPersistent !== "function") {
										throw new Error(
											`CDP connection failed for persistent profile after retry. Initial error: ${cdpMessage}. Retry error: ${retryMessage}`,
										);
									}

									logger.warn(
										`browser_control CDP retry failed for persistent profile, falling back to persistent launch: ${retryMessage}`,
									);
									launchedContext = await launchPersistentContext(
										playwright,
										selectedUserDataDir.userDataDir,
										executablePath,
										headless,
										startupTimeoutMs,
										chromeArgs,
									);
									context = launchedContext;
									browserTransport = "persistent-context";
								}
							} else {
								const launchPersistent =
									playwright.chromium.launchPersistentContext;
								if (typeof launchPersistent !== "function") {
									throw cdpError;
								}
								logger.warn(
									`browser_control CDP connection failed, retrying with persistent launch: ${cdpMessage}`,
								);
								launchedContext = await launchPersistentContext(
									playwright,
									selectedUserDataDir.userDataDir,
									executablePath,
									headless,
									startupTimeoutMs,
									chromeArgs,
								);
								context = launchedContext;
								browserTransport = "persistent-context";
							}
						}
					}
				};

				if (transportRequested === "relay") {
					await initializeViaRelay(startupTimeoutMs);
				} else {
					try {
						await initializeViaPlaywright();
					} catch (playwrightError) {
						if (transportRequested !== "auto" || !relayConfig) {
							throw playwrightError;
						}
						await closeTransientSessions();
						const relayTimeoutMs = Math.min(
							startupTimeoutMs,
							DEFAULT_RELAY_CONNECT_TIMEOUT_MS,
						);
						const playwrightMessage =
							playwrightError instanceof Error
								? playwrightError.message
								: String(playwrightError);
						logger.warn(
							`browser_control playwright initialization failed in auto mode, falling back to relay: ${playwrightMessage}`,
						);
						await initializeViaRelay(relayTimeoutMs);
						transportFallbackReason = `playwright initialization failed: ${playwrightMessage}`;
					}
				}
				const resolvedContext = context as BrowserContextLike | null;
				if (!resolvedContext) {
					throw new Error("Failed to initialize browser context.");
				}
				const activeContext = resolvedContext;

				// CDP contexts can include hidden/background pages first; prefer the most recent tab.
				let page = activeContext.pages().at(-1);
				if (!page) {
					page = await activeContext.newPage();
				}
				if (typeof page.bringToFront === "function") {
					await page.bringToFront();
				}

				if (input.url) {
					await page.goto(input.url, {
						waitUntil: "domcontentloaded",
						timeout: timeoutMs,
					});
				}

				const actionResults: Record<string, unknown>[] = [];
				for (const [index, action] of (input.actions || []).entries()) {
					const result = await runAction(
						page,
						action,
						timeoutMs,
						workspace,
						deps.now,
						index,
					);
					actionResults.push(result);
				}

				const summary = {
					browser:
						browserTransport === "cdp"
							? "chrome-cdp"
							: browserTransport === "persistent-context"
								? "chrome-playwright"
								: "chrome-relay",
					transport: browserTransport,
					transportRequested,
					transportUsed: browserTransport,
					fallbackReason: transportFallbackReason,
					mode: headless ? "headless" : "headed",
					persistentProfile: selectedUserDataDir.persistentProfile,
					profileId: selectedUserDataDir.profileId || null,
					profilePath: selectedUserDataDir.persistentProfile
						? selectedUserDataDir.userDataDir
						: null,
					reusedExistingSession: reusedExistingCdpSession,
					executionWorkspace: workspace,
					configWorkspace,
					extensions: extensionIds,
					finalUrl: page.url(),
					title: await page.title(),
					actionResults,
				};
				return JSON.stringify(summary, null, 2);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Unknown browser error";
				logger.error(`browser_control failed: ${message}`);
				return `Error running browser_control: ${message}`;
			} finally {
				const contextToClose = launchedContext as BrowserContextLike | null;
				if (contextToClose?.close) {
					try {
						await contextToClose.close();
					} catch {
						// Ignore close failures
					}
				}
				const browserToClose = browser as BrowserLike | null;
				if (browserToClose) {
					if (!reusedExistingCdpSession) {
						try {
							await browserToClose.close();
						} catch {
							// Ignore close failures
						}
					}
				}
				const chromeSessionToClose = chromeSession as StartedChromeSession | null;
				if (chromeSessionToClose) {
					try {
						await chromeSessionToClose.close();
					} catch {
						// Ignore close failures
					}
				}
				if (userDataDirSelection?.releaseLock) {
					userDataDirSelection.releaseLock();
				}
				if (userDataDirSelection && !userDataDirSelection.persistentProfile) {
					deps.removeDir(userDataDirSelection.userDataDir);
				}
			}
		},
		{
			name: "browser_control",
			description:
				'Native browser automation for Wingman using Chrome/Chromium runtime control. Transport is selected by config ("auto", "playwright", or "relay"): Playwright persistent-context is preferred for persistent profiles, CDP is used for standard runs with persistent-context fallback, and relay can bridge a live extension-attached tab. This is a first-class runtime capability, not an MCP server. Use it for JavaScript-rendered pages, interactions, screenshots, and structured extraction.',
			schema: BrowserControlInputSchema,
		},
	);
};
