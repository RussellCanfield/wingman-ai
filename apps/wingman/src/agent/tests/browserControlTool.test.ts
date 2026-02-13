import {
	existsSync,
	mkdtempSync,
	mkdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createBrowserControlTool } from "../tools/browser_control";

describe("browser_control tool", () => {
	const workspaces: string[] = [];

	afterEach(() => {
		for (const workspace of workspaces) {
			rmSync(workspace, { recursive: true, force: true });
		}
		workspaces.length = 0;
	});

	it("runs browser actions through injected CDP/playwright dependencies", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		let currentUrl = "about:blank";
		let browserClosed = false;
		let chromeClosed = false;
		const actionCalls: string[] = [];

		const page = {
			goto: async (url: string) => {
				currentUrl = url;
				actionCalls.push(`goto:${url}`);
			},
			click: async (selector: string) => {
				actionCalls.push(`click:${selector}`);
			},
			fill: async (selector: string, text: string) => {
				actionCalls.push(`fill:${selector}:${text}`);
			},
			keyboard: {
				press: async (key: string) => {
					actionCalls.push(`press:${key}`);
				},
			},
			waitForTimeout: async (ms: number) => {
				actionCalls.push(`wait:${ms}`);
			},
			textContent: async (selector: string) => {
				actionCalls.push(`text:${selector}`);
				return selector === "body"
					? "Example page body content"
					: "Selector content";
			},
			evaluate: async (expression: string) => {
				actionCalls.push(`eval:${expression}`);
				return { ok: true };
			},
			screenshot: async ({ path }: { path: string }) => {
				actionCalls.push(`screenshot:${path}`);
				writeFileSync(path, "test image data");
			},
			title: async () => "Example Title",
			url: () => currentUrl,
		};

		const context = {
			pages: () => [page],
			newPage: async () => page,
		};

		const browser = {
			contexts: () => [context],
			close: async () => {
				browserClosed = true;
			},
		};

		const testDeps = {
			importPlaywright: async () => ({
				chromium: {
					connectOverCDP: async () => browser,
				},
			}),
			startChrome: async () => ({
				wsEndpoint: "ws://127.0.0.1:1234/devtools/browser/test",
				close: async () => {
					chromeClosed = true;
				},
			}),
			mkTempDir: () => tempDir,
			removeDir: () => {},
			now: () => 1700000000000,
		};

		const tool = createBrowserControlTool({ workspace }, testDeps);

		const result = await tool.invoke({
			url: "https://example.com",
			actions: [
				{ type: "click", selector: "#cta" },
				{ type: "type", selector: "#query", text: "wingman", submit: true },
				{ type: "extract_text", selector: "body", maxChars: 10 },
				{ type: "evaluate", expression: "window.location.href" },
				{ type: "screenshot", path: "artifacts/shot.png", fullPage: false },
			],
		});

		const parsed = JSON.parse(String(result));
		expect(parsed.browser).toBe("chrome-cdp");
		expect(parsed.finalUrl).toBe("https://example.com");
		expect(parsed.title).toBe("Example Title");
		expect(parsed.actionResults).toHaveLength(5);
		expect(parsed.actionResults[2].text).toBe("Example pa");
		expect(parsed.actionResults[4].path).toBe("artifacts/shot.png");
		expect(actionCalls).toContain("click:#cta");
		expect(actionCalls).toContain("press:Enter");
		expect(browserClosed).toBe(true);
		expect(chromeClosed).toBe(true);
	});

	it("targets the most recently opened tab in the CDP context", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		const stalePageCalls: string[] = [];
		const activePageCalls: string[] = [];
		let currentUrl = "about:blank";

		const stalePage = {
			goto: async (url: string) => {
				stalePageCalls.push(`goto:${url}`);
			},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			textContent: async () => "",
			evaluate: async () => ({}),
			screenshot: async () => {},
			title: async () => "Stale",
			url: () => "about:blank",
		};

		const activePage = {
			goto: async (url: string) => {
				currentUrl = url;
				activePageCalls.push(`goto:${url}`);
			},
			bringToFront: async () => {
				activePageCalls.push("bringToFront");
			},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			textContent: async () => "",
			evaluate: async () => ({}),
			screenshot: async () => {},
			title: async () => "Active",
			url: () => currentUrl,
		};

		const tool = createBrowserControlTool(
			{ workspace },
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => ({
							contexts: () => [
								{
									pages: () => [stalePage, activePage],
									newPage: async () => activePage,
								},
							],
							close: async () => {},
						}),
					},
				}),
				startChrome: async () => ({
					wsEndpoint: "ws://127.0.0.1:1234/devtools/browser/test",
					close: async () => {},
				}),
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			url: "https://example.com",
		});

		const parsed = JSON.parse(String(result));
		expect(parsed.finalUrl).toBe("https://example.com");
		expect(stalePageCalls).toHaveLength(0);
		expect(activePageCalls).toContain("bringToFront");
		expect(activePageCalls).toContain("goto:https://example.com");
	});

	it("uses a context with pages when the first CDP context is empty", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		const hiddenContextCalls: string[] = [];
		const visibleContextCalls: string[] = [];
		let currentUrl = "about:blank";

		const hiddenContext = {
			pages: () => [],
			newPage: async () => {
				hiddenContextCalls.push("newPage");
				return {
					goto: async (url: string) => hiddenContextCalls.push(`goto:${url}`),
					click: async () => {},
					fill: async () => {},
					keyboard: { press: async () => {} },
					waitForTimeout: async () => {},
					textContent: async () => "",
					evaluate: async () => ({}),
					screenshot: async () => {},
					title: async () => "Hidden",
					url: () => "about:blank",
				};
			},
		};

		const visiblePage = {
			goto: async (url: string) => {
				currentUrl = url;
				visibleContextCalls.push(`goto:${url}`);
			},
			bringToFront: async () => {
				visibleContextCalls.push("bringToFront");
			},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			textContent: async () => "",
			evaluate: async () => ({}),
			screenshot: async () => {},
			title: async () => "Visible",
			url: () => currentUrl,
		};

		const visibleContext = {
			pages: () => [visiblePage],
			newPage: async () => visiblePage,
		};

		const tool = createBrowserControlTool(
			{ workspace },
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => ({
							contexts: () => [hiddenContext, visibleContext],
							close: async () => {},
						}),
					},
				}),
				startChrome: async () => ({
					wsEndpoint: "ws://127.0.0.1:1234/devtools/browser/test",
					close: async () => {},
				}),
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			url: "https://robinhood.com/login",
			actions: [{ type: "wait", ms: 50 }],
		});

		const parsed = JSON.parse(String(result));
		expect(parsed.finalUrl).toBe("https://robinhood.com/login");
		expect(hiddenContextCalls).toHaveLength(0);
		expect(visibleContextCalls).toContain("bringToFront");
		expect(visibleContextCalls).toContain("goto:https://robinhood.com/login");
	});

	it("accepts larger top-level timeoutMs values for long browser runs", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		let capturedLaunchTimeoutMs = 0;
		let capturedCdpTimeoutMs = 0;

		const page = {
			goto: async () => {},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			textContent: async () => "",
			evaluate: async () => "ok",
			screenshot: async () => {},
			title: async () => "Timeout Test",
			url: () => "about:blank",
		};

		const tool = createBrowserControlTool(
			{ workspace, launchTimeoutMs: 15_000 },
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async (
							_wsEndpoint: string,
							options?: { timeout?: number },
						) => {
							capturedCdpTimeoutMs = options?.timeout ?? 0;
							return {
								contexts: () => [{ pages: () => [page], newPage: async () => page }],
								close: async () => {},
							};
						},
					},
				}),
				startChrome: async (input) => {
					capturedLaunchTimeoutMs = input.launchTimeoutMs;
					return {
						wsEndpoint: "ws://127.0.0.1:1234/devtools/browser/test",
						close: async () => {},
					};
				},
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		await tool.invoke({
			actions: [{ type: "evaluate", expression: "document.title" }],
			timeoutMs: 180_000,
		});

		expect(capturedLaunchTimeoutMs).toBe(180_000);
		expect(capturedCdpTimeoutMs).toBe(180_000);
	});

	it("accepts large extract_text maxChars values for long page content", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		const largeBody = "A".repeat(1_020_000);
		const page = {
			goto: async () => {},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			textContent: async () => largeBody,
			evaluate: async () => "ok",
			screenshot: async () => {},
			title: async () => "Large Extract",
			url: () => "https://robinhood.com",
		};

		const tool = createBrowserControlTool(
			{ workspace },
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => ({
							contexts: () => [{ pages: () => [page], newPage: async () => page }],
							close: async () => {},
						}),
					},
				}),
				startChrome: async () => ({
					wsEndpoint: "ws://127.0.0.1:1234/devtools/browser/test",
					close: async () => {},
				}),
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			actions: [{ type: "extract_text", selector: "body", maxChars: 1_000_000 }],
			timeoutMs: 60_000,
		});

		const parsed = JSON.parse(String(result));
		expect(parsed.actionResults[0].type).toBe("extract_text");
		expect(parsed.actionResults[0].selector).toBe("body");
		expect(parsed.actionResults[0].text.length).toBe(1_000_000);
		expect(parsed.actionResults[0].truncated).toBe(true);
	});

	it("uses persistent Playwright launch when preferred", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		const fakeChromePath = join(tempDir, "chrome-bin");
		writeFileSync(fakeChromePath, "fake chrome binary");

		let launchCalled = false;
		let closeCalled = false;
		let currentUrl = "about:blank";

		const page = {
			goto: async (url: string) => {
				currentUrl = url;
			},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			textContent: async () => "",
			evaluate: async () => "ok",
			screenshot: async () => {},
			title: async () => "Persistent",
			url: () => currentUrl,
		};

		const result = await createBrowserControlTool(
			{
				workspace,
				preferPersistentLaunch: true,
				defaultExecutablePath: fakeChromePath,
			},
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => {
							throw new Error("connectOverCDP should not be called");
						},
						launchPersistentContext: async () => {
							launchCalled = true;
							return {
								pages: () => [page],
								newPage: async () => page,
								close: async () => {
									closeCalled = true;
								},
							};
						},
					},
				}),
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		).invoke({
			url: "https://example.com",
			actions: [{ type: "evaluate", expression: "document.title" }],
		});

		const parsed = JSON.parse(String(result));
		expect(launchCalled).toBe(true);
		expect(closeCalled).toBe(true);
		expect(parsed.browser).toBe("chrome-playwright");
		expect(parsed.transport).toBe("persistent-context");
		expect(parsed.finalUrl).toBe("https://example.com");
	});

	it("falls back to persistent launch when CDP connection fails", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		const fakeChromePath = join(tempDir, "chrome-bin");
		writeFileSync(fakeChromePath, "fake chrome binary");

		let startChromeCalled = false;
		let cdpCalled = false;
		let cdpChromeClosed = false;
		let persistentClosed = false;
		let currentUrl = "about:blank";

		const page = {
			goto: async (url: string) => {
				currentUrl = url;
			},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			textContent: async () => "",
			evaluate: async () => "ok",
			screenshot: async () => {},
			title: async () => "Fallback",
			url: () => currentUrl,
		};

		const tool = createBrowserControlTool(
			{
				workspace,
				preferPersistentLaunch: false,
				defaultExecutablePath: fakeChromePath,
			},
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => {
							cdpCalled = true;
							throw new Error("overCDP: Timeout 30000ms exceeded.");
						},
						launchPersistentContext: async () => ({
							pages: () => [page],
							newPage: async () => page,
							close: async () => {
								persistentClosed = true;
							},
						}),
					},
				}),
				startChrome: async () => {
					startChromeCalled = true;
					return {
						wsEndpoint: "ws://127.0.0.1:1234/devtools/browser/test",
						close: async () => {
							cdpChromeClosed = true;
						},
					};
				},
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			url: "https://robinhood.com/login",
			actions: [{ type: "evaluate", expression: "document.title" }],
			timeoutMs: 120_000,
		});

		const parsed = JSON.parse(String(result));
		expect(startChromeCalled).toBe(true);
		expect(cdpCalled).toBe(true);
		expect(cdpChromeClosed).toBe(true);
		expect(persistentClosed).toBe(true);
		expect(parsed.browser).toBe("chrome-playwright");
		expect(parsed.transport).toBe("persistent-context");
		expect(parsed.finalUrl).toBe("https://robinhood.com/login");
	});

	it("uses relay transport when explicitly requested", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		let capturedRelayTimeout = 0;
		let capturedRelayConfig: { host?: string; port?: number } | null = null;
		let capturedWsEndpoint = "";
		let startChromeCalled = false;
		let currentUrl = "about:blank";

		const page = {
			goto: async (url: string) => {
				currentUrl = url;
			},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			textContent: async () => "",
			evaluate: async () => "ok",
			screenshot: async () => {},
			title: async () => "Relay Mode",
			url: () => currentUrl,
		};

		const tool = createBrowserControlTool(
			{
				workspace,
				browserTransport: "relay",
				relayConfig: {
					enabled: true,
					host: "127.0.0.1",
					port: 18792,
					requireAuth: true,
					authToken: "test-relay-token-123456",
				},
			},
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async (
							wsEndpoint: string,
							options?: { timeout?: number },
						) => {
							capturedWsEndpoint = wsEndpoint;
							capturedRelayTimeout = options?.timeout ?? 0;
							return {
								contexts: () => [{ pages: () => [page], newPage: async () => page }],
								close: async () => {},
							};
						},
					},
				}),
				startChrome: async () => {
					startChromeCalled = true;
					return {
						wsEndpoint: "ws://127.0.0.1:1234/devtools/browser/test",
						close: async () => {},
					};
				},
				resolveRelayWsEndpoint: async (config, timeoutMs) => {
					capturedRelayConfig = {
						host: config.host,
						port: config.port,
					};
					capturedRelayTimeout = timeoutMs;
					return "ws://127.0.0.1:18792/cdp?token=test-relay-token-123456";
				},
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			url: "https://example.com",
			actions: [{ type: "evaluate", expression: "document.title" }],
			timeoutMs: 45_000,
		});

		const parsed = JSON.parse(String(result));
		expect(startChromeCalled).toBe(false);
		expect(parsed.transportRequested).toBe("relay");
		expect(parsed.transport).toBe("relay-cdp");
		expect(parsed.browser).toBe("chrome-relay");
		expect(parsed.finalUrl).toBe("https://example.com");
		expect(parsed.fallbackReason).toBeNull();
		expect((capturedRelayConfig as { host?: string } | null)?.host).toBe(
			"127.0.0.1",
		);
		expect((capturedRelayConfig as { port?: number } | null)?.port).toBe(
			18792,
		);
		expect(capturedRelayTimeout).toBe(45_000);
		expect(capturedWsEndpoint).toContain("/cdp");
	});

	it("falls back to relay in auto mode when playwright startup fails", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		let startChromeCalled = false;
		let relayResolveCalled = false;
		let currentUrl = "about:blank";

		const page = {
			goto: async (url: string) => {
				currentUrl = url;
			},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			textContent: async () => "",
			evaluate: async () => "ok",
			screenshot: async () => {},
			title: async () => "Auto Relay Fallback",
			url: () => currentUrl,
		};

		const tool = createBrowserControlTool(
			{
				workspace,
				browserTransport: "auto",
				relayConfig: {
					enabled: true,
					host: "127.0.0.1",
					port: 18792,
					requireAuth: false,
				},
			},
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async (wsEndpoint: string) => {
							if (wsEndpoint.includes("18792")) {
								return {
									contexts: () => [{ pages: () => [page], newPage: async () => page }],
									close: async () => {},
								};
							}
							throw new Error("playwright cdp endpoint refused");
						},
					},
				}),
				startChrome: async () => {
					startChromeCalled = true;
					throw new Error("Failed to launch Chrome for CDP connection");
				},
				resolveRelayWsEndpoint: async () => {
					relayResolveCalled = true;
					return "ws://127.0.0.1:18792/cdp";
				},
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			url: "https://example.com/auto",
			actions: [{ type: "evaluate", expression: "document.title" }],
			timeoutMs: 90_000,
		});

		const parsed = JSON.parse(String(result));
		expect(startChromeCalled).toBe(true);
		expect(relayResolveCalled).toBe(true);
		expect(parsed.transportRequested).toBe("auto");
		expect(parsed.transport).toBe("relay-cdp");
		expect(parsed.browser).toBe("chrome-relay");
		expect(parsed.fallbackReason).toContain("playwright initialization failed");
		expect(parsed.finalUrl).toBe("https://example.com/auto");
	});

	it("does not fall back to relay when transport is explicitly playwright", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		let relayResolveCalled = false;
		const tool = createBrowserControlTool(
			{
				workspace,
				browserTransport: "playwright",
				relayConfig: {
					enabled: true,
					host: "127.0.0.1",
					port: 18792,
					requireAuth: false,
				},
			},
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => {
							throw new Error("playwright cdp endpoint refused");
						},
					},
				}),
				startChrome: async () => {
					throw new Error("CDP startup failed");
				},
				resolveRelayWsEndpoint: async () => {
					relayResolveCalled = true;
					return "ws://127.0.0.1:18792/cdp";
				},
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			url: "https://example.com/playwright-only",
		});

		expect(relayResolveCalled).toBe(false);
		expect(String(result)).toContain("Error running browser_control");
		expect(String(result)).toContain("CDP startup failed");
	});

	it("rejects screenshot paths that escape the workspace", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		const page = {
			goto: async () => {},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			textContent: async () => "",
			evaluate: async () => ({}),
			screenshot: async () => {},
			title: async () => "Example",
			url: () => "about:blank",
		};

		const tool = createBrowserControlTool(
			{ workspace },
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => ({
							contexts: () => [{ pages: () => [page], newPage: async () => page }],
							close: async () => {},
						}),
					},
				}),
				startChrome: async () => ({
					wsEndpoint: "ws://127.0.0.1:1234/devtools/browser/test",
					close: async () => {},
				}),
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			actions: [{ type: "screenshot", path: "../escape.png" }],
		});

		expect(String(result)).toContain("Error running browser_control");
		expect(String(result)).toContain("inside the workspace");
	});

	it("supports alias action types used by some agent prompts", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		let currentUrl = "about:blank";
		const actionCalls: string[] = [];

		const page = {
			goto: async (url: string) => {
				currentUrl = url;
				actionCalls.push(`goto:${url}`);
			},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async (ms: number) => {
				actionCalls.push(`wait:${ms}`);
			},
			textContent: async (selector: string) => {
				actionCalls.push(`text:${selector}`);
				return "Robinhood";
			},
			evaluate: async (expression: string) => {
				actionCalls.push(`eval:${expression}`);
				return "Robinhood - Investing";
			},
			screenshot: async ({ path }: { path: string }) => {
				actionCalls.push(`screenshot:${path}`);
				writeFileSync(path, "test image data");
			},
			title: async () => "Robinhood - Investing",
			url: () => currentUrl,
		};

		const tool = createBrowserControlTool(
			{ workspace },
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => ({
							contexts: () => [{ pages: () => [page], newPage: async () => page }],
							close: async () => {},
						}),
					},
				}),
				startChrome: async () => ({
					wsEndpoint: "ws://127.0.0.1:1234/devtools/browser/test",
					close: async () => {},
				}),
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

			const result = await tool.invoke({
				url: "https://robinhood.com/?classic=1",
				actions: [
					{ type: "url", url: "https://robinhood.com/?classic=1" },
					{ type: "ms", ms: 4000 },
					{ type: "selector", selector: "body", maxChars: 4000 },
					{ type: "expression", expression: "document.title" },
					{ type: "path", path: "robinhood.png", fullPage: true },
				],
				headless: true,
			timeoutMs: 60000,
		});

			const parsed = JSON.parse(String(result));
			expect(parsed.finalUrl).toBe("https://robinhood.com/?classic=1");
			expect(parsed.actionResults[0].type).toBe("navigate");
			expect(parsed.actionResults[1].type).toBe("wait");
			expect(parsed.actionResults[2].type).toBe("extract_text");
			expect(parsed.actionResults[3].type).toBe("evaluate");
			expect(parsed.actionResults[4].type).toBe("screenshot");
			expect(parsed.actionResults[4].path).toBe("robinhood.png");
			expect(actionCalls).toContain("goto:https://robinhood.com/?classic=1");
			expect(actionCalls).toContain("wait:4000");
			expect(actionCalls).toContain("text:body");
			expect(actionCalls).toContain("eval:document.title");
		});

	it("supports snapshot alias for screenshot actions", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		let currentUrl = "about:blank";
		const actionCalls: string[] = [];

		const page = {
			goto: async (url: string) => {
				currentUrl = url;
				actionCalls.push(`goto:${url}`);
			},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			textContent: async () => "",
			evaluate: async () => "ok",
			screenshot: async ({ path }: { path: string }) => {
				actionCalls.push(`screenshot:${path}`);
				writeFileSync(path, "test image data");
			},
			title: async () => "Robinhood",
			url: () => currentUrl,
		};

		const tool = createBrowserControlTool(
			{ workspace },
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => ({
							contexts: () => [{ pages: () => [page], newPage: async () => page }],
							close: async () => {},
						}),
					},
				}),
				startChrome: async () => ({
					wsEndpoint: "ws://127.0.0.1:1234/devtools/browser/test",
					close: async () => {},
				}),
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			url: "https://robinhood.com/?classic=1",
			actions: [
				{ type: "navigate", url: "https://robinhood.com/?classic=1" },
				{ type: "wait", ms: 10 },
				{ type: "snapshot", path: "robinhood_classic.png", fullPage: true },
			],
			headless: true,
			timeoutMs: 60_000,
		});

		const parsed = JSON.parse(String(result));
		expect(parsed.finalUrl).toBe("https://robinhood.com/?classic=1");
		expect(parsed.actionResults[2].type).toBe("screenshot");
		expect(parsed.actionResults[2].path).toBe("robinhood_classic.png");
		expect(actionCalls).toContain("goto:https://robinhood.com/?classic=1");
	});

	it("supports additional action aliases for robust prompting", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		let currentUrl = "about:blank";
		const actionCalls: string[] = [];

		const page = {
			goto: async (url: string) => {
				currentUrl = url;
				actionCalls.push(`goto:${url}`);
			},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async (ms: number) => {
				actionCalls.push(`wait:${ms}`);
			},
			textContent: async () => "",
			evaluate: async (expression: string) => {
				actionCalls.push(`eval:${expression}`);
				return "ok";
			},
			screenshot: async ({ path }: { path: string }) => {
				actionCalls.push(`screenshot:${path}`);
				writeFileSync(path, "test image data");
			},
			title: async () => "Alias Test",
			url: () => currentUrl,
		};

		const tool = createBrowserControlTool(
			{ workspace },
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => ({
							contexts: () => [{ pages: () => [page], newPage: async () => page }],
							close: async () => {},
						}),
					},
				}),
				startChrome: async () => ({
					wsEndpoint: "ws://127.0.0.1:1234/devtools/browser/test",
					close: async () => {},
				}),
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			url: "https://example.com",
			actions: [
				{ type: "open", url: "https://example.com/docs" },
				{ type: "sleep", ms: 25 },
				{ type: "js", expression: "document.title" },
				{ type: "capture", path: "alias-capture.png", fullPage: true },
			],
			headless: true,
		});

		const parsed = JSON.parse(String(result));
		expect(parsed.finalUrl).toBe("https://example.com/docs");
		expect(parsed.actionResults[0].type).toBe("navigate");
		expect(parsed.actionResults[1].type).toBe("wait");
		expect(parsed.actionResults[2].type).toBe("evaluate");
		expect(parsed.actionResults[3].type).toBe("screenshot");
		expect(actionCalls).toContain("goto:https://example.com/docs");
		expect(actionCalls).toContain("wait:25");
		expect(actionCalls).toContain("eval:document.title");
	});

	it("supports extract alias for text extraction", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		let currentUrl = "about:blank";
		const actionCalls: string[] = [];

		const page = {
			goto: async (url: string) => {
				currentUrl = url;
				actionCalls.push(`goto:${url}`);
			},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			waitForLoadState: async (state?: string) => {
				actionCalls.push(`load:${state}`);
			},
			textContent: async (selector: string) => {
				actionCalls.push(`text:${selector}`);
				return "Robinhood support content";
			},
			evaluate: async () => "ok",
			screenshot: async () => {},
			title: async () => "Support",
			url: () => currentUrl,
		};

		const tool = createBrowserControlTool(
			{ workspace },
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => ({
							contexts: () => [{ pages: () => [page], newPage: async () => page }],
							close: async () => {},
						}),
					},
				}),
				startChrome: async () => ({
					wsEndpoint: "ws://127.0.0.1:1234/devtools/browser/test",
					close: async () => {},
				}),
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			url: "https://robinhood.com",
			actions: [
				{ type: "goto", url: "https://robinhood.com/" },
				{ type: "wait", load: "networkidle", timeoutMs: 30_000 },
				{ type: "extract", selector: "body", maxChars: 5_000 },
			],
			headless: true,
			timeoutMs: 60_000,
		});

		const parsed = JSON.parse(String(result));
		expect(parsed.finalUrl).toBe("https://robinhood.com/");
		expect(parsed.actionResults[2].type).toBe("extract_text");
		expect(parsed.actionResults[2].selector).toBe("body");
		expect(actionCalls).toContain("goto:https://robinhood.com/");
		expect(actionCalls).toContain("load:networkidle");
		expect(actionCalls).toContain("text:body");
	});

	it("supports getContent alias for text extraction", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		let currentUrl = "about:blank";
		const actionCalls: string[] = [];

		const page = {
			goto: async (url: string) => {
				currentUrl = url;
				actionCalls.push(`goto:${url}`);
			},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			waitForLoadState: async (state?: string) => {
				actionCalls.push(`load:${state}`);
			},
			textContent: async (selector: string) => {
				actionCalls.push(`text:${selector}`);
				return "Robinhood homepage content";
			},
			evaluate: async () => "ok",
			screenshot: async () => {},
			title: async () => "Robinhood",
			url: () => currentUrl,
		};

		const tool = createBrowserControlTool(
			{ workspace },
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => ({
							contexts: () => [{ pages: () => [page], newPage: async () => page }],
							close: async () => {},
						}),
					},
				}),
				startChrome: async () => ({
					wsEndpoint: "ws://127.0.0.1:1234/devtools/browser/test",
					close: async () => {},
				}),
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			url: "https://robinhood.com/",
			actions: [
				{ type: "goto", url: "https://robinhood.com/" },
				{ type: "wait", load: "networkidle", timeoutMs: 30_000 },
				{ type: "getContent", selector: "body", maxChars: 5_000 },
			],
			timeoutMs: 60_000,
		});

		const parsed = JSON.parse(String(result));
		expect(parsed.finalUrl).toBe("https://robinhood.com/");
		expect(parsed.actionResults[2].type).toBe("extract_text");
		expect(parsed.actionResults[2].selector).toBe("body");
		expect(actionCalls).toContain("goto:https://robinhood.com/");
		expect(actionCalls).toContain("load:networkidle");
		expect(actionCalls).toContain("text:body");
	});

	it("supports querySelector alias for text extraction", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		let currentUrl = "about:blank";
		const actionCalls: string[] = [];

		const page = {
			goto: async (url: string) => {
				currentUrl = url;
				actionCalls.push(`goto:${url}`);
			},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			waitForLoadState: async (state?: string) => {
				actionCalls.push(`load:${state}`);
			},
			textContent: async (selector: string) => {
				actionCalls.push(`text:${selector}`);
				return "Robinhood homepage content";
			},
			evaluate: async () => "ok",
			screenshot: async () => {},
			title: async () => "Robinhood",
			url: () => currentUrl,
		};

		const tool = createBrowserControlTool(
			{ workspace },
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => ({
							contexts: () => [{ pages: () => [page], newPage: async () => page }],
							close: async () => {},
						}),
					},
				}),
				startChrome: async () => ({
					wsEndpoint: "ws://127.0.0.1:1234/devtools/browser/test",
					close: async () => {},
				}),
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			url: "https://robinhood.com",
			actions: [
				{ type: "navigate", url: "https://robinhood.com" },
				{ type: "wait", load: "networkidle", timeoutMs: 30_000 },
				{ type: "querySelector", selector: "body", maxChars: 4_000 },
			],
			timeoutMs: 30_000,
		});

		const parsed = JSON.parse(String(result));
		expect(parsed.finalUrl).toBe("https://robinhood.com");
		expect(parsed.actionResults[2].type).toBe("extract_text");
		expect(parsed.actionResults[2].selector).toBe("body");
		expect(actionCalls).toContain("goto:https://robinhood.com");
		expect(actionCalls).toContain("load:networkidle");
		expect(actionCalls).toContain("text:body");
	});

	it("supports wait_for conditions", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		const waitCalls: string[] = [];

		const page = {
			goto: async () => {},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			waitForSelector: async (selector: string) => {
				waitCalls.push(`selector:${selector}`);
			},
			waitForURL: async () => {
				waitCalls.push("url");
			},
			waitForLoadState: async (state?: string) => {
				waitCalls.push(`load:${state}`);
			},
			waitForFunction: async (expression: string) => {
				waitCalls.push(`fn:${expression}`);
			},
			textContent: async () => "",
			evaluate: async () => "ok",
			screenshot: async () => {},
			title: async () => "Wait For Test",
			url: () => "https://example.com/dashboard",
		};

		const tool = createBrowserControlTool(
			{ workspace },
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => ({
							contexts: () => [{ pages: () => [page], newPage: async () => page }],
							close: async () => {},
						}),
					},
				}),
				startChrome: async () => ({
					wsEndpoint: "ws://127.0.0.1:1234/devtools/browser/test",
					close: async () => {},
				}),
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			actions: [
				{
					type: "wait_for",
					selector: "#portfolio-root",
					url: "https://example.com/**",
					load: "domcontentloaded",
					fn: "document.readyState === 'complete'",
					timeoutMs: 25_000,
				},
			],
			headless: true,
			timeoutMs: 60_000,
		});

		const parsed = JSON.parse(String(result));
		expect(parsed.actionResults[0].type).toBe("wait_for");
		expect(parsed.actionResults[0].timeoutMs).toBe(25_000);
		expect(waitCalls).toContain("selector:#portfolio-root");
		expect(waitCalls).toContain("url");
		expect(waitCalls).toContain("load:domcontentloaded");
		expect(waitCalls).toContain("fn:document.readyState === 'complete'");
	});

	it("supports wait with load/timeoutMs alias style", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		const waitCalls: string[] = [];

		const page = {
			goto: async () => {},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			waitForLoadState: async (state?: string) => {
				waitCalls.push(`load:${state}`);
			},
			textContent: async () => "",
			evaluate: async () => "ok",
			screenshot: async () => {},
			title: async () => "Wait Alias Test",
			url: () => "https://support.robinhood.com",
		};

		const tool = createBrowserControlTool(
			{ workspace },
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => ({
							contexts: () => [{ pages: () => [page], newPage: async () => page }],
							close: async () => {},
						}),
					},
				}),
				startChrome: async () => ({
					wsEndpoint: "ws://127.0.0.1:1234/devtools/browser/test",
					close: async () => {},
				}),
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			actions: [{ type: "wait", load: "networkidle", timeoutMs: 180_000 }],
			headless: true,
		});

		const parsed = JSON.parse(String(result));
		expect(parsed.actionResults[0].type).toBe("wait_for");
		expect(parsed.actionResults[0].load).toBe("networkidle");
		expect(parsed.actionResults[0].timeoutMs).toBe(180_000);
		expect(waitCalls).toContain("load:networkidle");
	});

	it("auto-provisions bundled wingman extension when configured path is missing", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		let capturedChromeArgs: string[] = [];

		const page = {
			goto: async () => {},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			textContent: async () => "",
			evaluate: async () => "ok",
			screenshot: async () => {},
			title: async () => "Bundled Extension",
			url: () => "about:blank",
		};

		const tool = createBrowserControlTool(
			{
				workspace,
				defaultExtensions: ["wingman"],
			},
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => ({
							contexts: () => [{ pages: () => [page], newPage: async () => page }],
							close: async () => {},
						}),
					},
				}),
				startChrome: async (input) => {
					capturedChromeArgs = input.chromeArgs || [];
					return {
						wsEndpoint: "ws://127.0.0.1:1234/devtools/browser/test",
						close: async () => {},
					};
				},
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			actions: [{ type: "evaluate", expression: "document.title" }],
		});

		const parsed = JSON.parse(String(result));
		expect(parsed.extensions).toContain("wingman");
		expect(
			existsSync(
				join(
					workspace,
					".wingman",
					"browser-extensions",
					"wingman",
					"manifest.json",
				),
			),
		).toBe(true);
		expect(
			capturedChromeArgs.some((arg) => arg.startsWith("--load-extension=")),
		).toBe(true);
	});

	it("resolves configured extension paths relative to config workspace", async () => {
		const executionWorkspace = mkdtempSync(
			join(tmpdir(), "wingman-browser-workspace-"),
		);
		const configWorkspace = mkdtempSync(
			join(tmpdir(), "wingman-browser-config-workspace-"),
		);
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(executionWorkspace, configWorkspace, tempDir);

		const extensionDir = join(
			configWorkspace,
			".wingman",
			"browser-extensions",
			"relay",
		);
		mkdirSync(extensionDir, { recursive: true });
		writeFileSync(
			join(extensionDir, "manifest.json"),
			JSON.stringify({
				manifest_version: 3,
				name: "Relay Test Extension",
				version: "0.0.1",
			}),
		);

		let capturedChromeArgs: string[] = [];
		const page = {
			goto: async () => {},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			textContent: async () => "",
			evaluate: async () => "ok",
			screenshot: async () => {},
			title: async () => "Config Workspace Extension",
			url: () => "about:blank",
		};

		const tool = createBrowserControlTool(
			{
				workspace: executionWorkspace,
				configWorkspace,
				defaultExtensions: ["relay"],
			},
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => ({
							contexts: () => [{ pages: () => [page], newPage: async () => page }],
							close: async () => {},
						}),
					},
				}),
				startChrome: async (input) => {
					capturedChromeArgs = input.chromeArgs || [];
					return {
						wsEndpoint: "ws://127.0.0.1:1234/devtools/browser/test",
						close: async () => {},
					};
				},
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			actions: [{ type: "evaluate", expression: "document.title" }],
		});

		const parsed = JSON.parse(String(result));
		expect(parsed.extensions).toContain("relay");
		expect(
			capturedChromeArgs.some((arg) => arg.includes(extensionDir)),
		).toBe(true);
	});

	it("uses persistent named browser profile when configured", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		let capturedUserDataDir = "";
		let capturedHeadless: boolean | null = null;
		let capturedIgnoreDefaultArgs: string[] = [];
		let removedTempDir = false;
		const page = {
			goto: async () => {},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			textContent: async () => "",
			evaluate: async () => "ok",
			screenshot: async () => {},
			title: async () => "Profile Session",
			url: () => "about:blank",
		};

		const tool = createBrowserControlTool(
			{
				workspace,
				browserProfile: "trading",
			},
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => {
							throw new Error("connectOverCDP should not be called");
						},
						launchPersistentContext: async (userDataDir, launchOptions) => {
							capturedUserDataDir = userDataDir;
							capturedHeadless = launchOptions?.headless ?? null;
							capturedIgnoreDefaultArgs = launchOptions?.ignoreDefaultArgs || [];
							return {
								pages: () => [page],
								newPage: async () => page,
								close: async () => {},
							};
						},
					},
				}),
				mkTempDir: () => tempDir,
				removeDir: () => {
					removedTempDir = true;
				},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			actions: [{ type: "evaluate", expression: "document.title" }],
		});

		const parsed = JSON.parse(String(result));
		expect(parsed.persistentProfile).toBe(true);
		expect(parsed.profileId).toBe("trading");
		expect(parsed.profilePath).toBe(capturedUserDataDir);
		expect(parsed.transport).toBe("persistent-context");
		expect(parsed.mode).toBe("headed");
		expect(capturedHeadless).toBe(false);
		expect(capturedIgnoreDefaultArgs).toContain("--password-store=basic");
		expect(capturedIgnoreDefaultArgs).toContain("--use-mock-keychain");
		expect(capturedUserDataDir).toContain(".wingman/browser-profiles/trading");
		expect(removedTempDir).toBe(false);
	});

	it("honors headless requests for persistent browser profiles", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		let capturedHeadless: boolean | null = null;
		const page = {
			goto: async () => {},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			textContent: async () => "",
			evaluate: async () => "ok",
			screenshot: async () => {},
			title: async () => "Profile Session",
			url: () => "about:blank",
		};

		const tool = createBrowserControlTool(
			{
				workspace,
				browserProfile: "trading",
			},
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => {
							throw new Error("connectOverCDP should not be called");
						},
						launchPersistentContext: async (_userDataDir, launchOptions) => {
							capturedHeadless = launchOptions?.headless ?? null;
							return {
								pages: () => [page],
								newPage: async () => page,
								close: async () => {},
							};
						},
					},
				}),
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			headless: true,
			actions: [{ type: "evaluate", expression: "document.title" }],
		});

		const parsed = JSON.parse(String(result));
		expect(parsed.mode).toBe("headless");
		expect(capturedHeadless).toBe(true);
	});

	it("retries CDP once for persistent profiles without switching transport", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		let startChromeCalls = 0;
		let connectCalls = 0;
		let persistentLaunchCalled = false;
		const page = {
			goto: async () => {},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			textContent: async () => "",
			evaluate: async () => "ok",
			screenshot: async () => {},
			title: async () => "Profile Retry",
			url: () => "about:blank",
		};

		const tool = createBrowserControlTool(
			{
				workspace,
				browserProfile: "trading",
				preferPersistentLaunch: false,
			},
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => {
							connectCalls += 1;
							if (connectCalls === 1) {
								throw new Error("overCDP: WebSocket error: ECONNREFUSED");
							}
							return {
								contexts: () => [{ pages: () => [page], newPage: async () => page }],
								close: async () => {},
							};
						},
						launchPersistentContext: async () => {
							persistentLaunchCalled = true;
							return { pages: () => [page], newPage: async () => page };
						},
					},
				}),
				startChrome: async () => {
					startChromeCalls += 1;
					return {
						wsEndpoint: "ws://127.0.0.1:1234/devtools/browser/test",
						close: async () => {},
					};
				},
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			actions: [{ type: "evaluate", expression: "document.title" }],
		});

		const parsed = JSON.parse(String(result));
		expect(parsed.persistentProfile).toBe(true);
		expect(parsed.transport).toBe("cdp");
		expect(connectCalls).toBe(2);
		expect(startChromeCalls).toBe(2);
		expect(persistentLaunchCalled).toBe(false);
	});

	it("falls back to persistent launch when persistent-profile CDP retry fails", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		let startChromeCalls = 0;
		let connectCalls = 0;
		let persistentLaunchCalled = false;
		const page = {
			goto: async () => {},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			textContent: async () => "",
			evaluate: async () => "ok",
			screenshot: async () => {},
			title: async () => "Profile Fallback",
			url: () => "about:blank",
		};

		const tool = createBrowserControlTool(
			{
				workspace,
				browserProfile: "trading",
				preferPersistentLaunch: false,
			},
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => {
							connectCalls += 1;
							throw new Error("overCDP: WebSocket error: ECONNREFUSED");
						},
						launchPersistentContext: async () => {
							persistentLaunchCalled = true;
							return { pages: () => [page], newPage: async () => page };
						},
					},
				}),
				startChrome: async () => {
					startChromeCalls += 1;
					return {
						wsEndpoint: "ws://127.0.0.1:1234/devtools/browser/test",
						close: async () => {},
					};
				},
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			actions: [{ type: "evaluate", expression: "document.title" }],
		});

		const parsed = JSON.parse(String(result));
		expect(parsed.persistentProfile).toBe(true);
		expect(parsed.transport).toBe("persistent-context");
		expect(connectCalls).toBe(2);
		expect(startChromeCalls).toBe(2);
		expect(persistentLaunchCalled).toBe(true);
	});

	it("resolves persistent profile paths relative to config workspace", async () => {
		const executionWorkspace = mkdtempSync(
			join(tmpdir(), "wingman-browser-workspace-"),
		);
		const configWorkspace = mkdtempSync(
			join(tmpdir(), "wingman-browser-config-workspace-"),
		);
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(executionWorkspace, configWorkspace, tempDir);

		let capturedUserDataDir = "";
		const page = {
			goto: async () => {},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			textContent: async () => "",
			evaluate: async () => "ok",
			screenshot: async () => {},
			title: async () => "Config Workspace Profile",
			url: () => "about:blank",
		};

		const tool = createBrowserControlTool(
			{
				workspace: executionWorkspace,
				configWorkspace,
				browserProfile: "trading",
			},
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => {
							throw new Error("connectOverCDP should not be called");
						},
						launchPersistentContext: async (userDataDir) => {
							capturedUserDataDir = userDataDir;
							return {
								pages: () => [page],
								newPage: async () => page,
								close: async () => {},
							};
						},
					},
				}),
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			actions: [{ type: "evaluate", expression: "document.title" }],
		});

		const parsed = JSON.parse(String(result));
		expect(parsed.persistentProfile).toBe(true);
		expect(parsed.configWorkspace).toBe(configWorkspace);
		expect(parsed.executionWorkspace).toBe(executionWorkspace);
		expect(parsed.profilePath).toBe(capturedUserDataDir);
		expect(capturedUserDataDir).toBe(
			join(configWorkspace, ".wingman", "browser-profiles", "trading"),
		);
		expect(existsSync(capturedUserDataDir)).toBe(true);
		expect(
			existsSync(
				join(
					executionWorkspace,
					".wingman",
					"browser-profiles",
					"trading",
				),
			),
		).toBe(false);
	});

	it("rejects concurrent runs when profile lock belongs to an active process", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		const profileDir = join(workspace, ".wingman", "browser-profiles", "trading");
		mkdirSync(profileDir, { recursive: true });
		const blocker = spawn("sleep", ["30"], { stdio: "ignore" });
		try {
			writeFileSync(
				join(profileDir, ".wingman-browser.lock"),
				JSON.stringify({ pid: blocker.pid }),
			);

			let startChromeCalled = false;
			const tool = createBrowserControlTool(
				{
					workspace,
					browserProfile: "trading",
				},
				{
					importPlaywright: async () => ({
						chromium: {
							connectOverCDP: async () => ({
								contexts: () => [],
								close: async () => {},
							}),
						},
					}),
					startChrome: async () => {
						startChromeCalled = true;
						return {
							wsEndpoint: "ws://127.0.0.1:1234/devtools/browser/test",
							close: async () => {},
						};
					},
					mkTempDir: () => tempDir,
					removeDir: () => {},
					now: () => 1700000000000,
				},
			);

			const result = await tool.invoke({
				actions: [{ type: "wait", ms: 10 }],
			});

			expect(startChromeCalled).toBe(false);
			expect(String(result)).toContain("already in use");
		} finally {
			try {
				blocker.kill("SIGKILL");
			} catch {
				// Ignore cleanup failures in tests.
			}
		}
	});

	it("recovers from stale profile lock when lock PID is no longer alive", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-workspace-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-temp-"));
		workspaces.push(workspace, tempDir);

		const profileDir = join(workspace, ".wingman", "browser-profiles", "trading");
		mkdirSync(profileDir, { recursive: true });
		writeFileSync(
			join(profileDir, ".wingman-browser.lock"),
			JSON.stringify({ pid: 999999, createdAt: "2026-01-01T00:00:00.000Z" }),
		);

		let startChromeCalled = false;
		const page = {
			goto: async () => {},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			textContent: async () => "",
			evaluate: async () => "ok",
			screenshot: async () => {},
			title: async () => "Recovered",
			url: () => "about:blank",
		};

		const tool = createBrowserControlTool(
			{
				workspace,
				browserProfile: "trading",
			},
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => {
							throw new Error("connectOverCDP should not be called");
						},
						launchPersistentContext: async () => ({
							pages: () => [page],
							newPage: async () => page,
							close: async () => {},
						}),
					},
				}),
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const result = await tool.invoke({
			actions: [{ type: "evaluate", expression: "document.title" }],
		});

		const parsed = JSON.parse(String(result));
		expect(startChromeCalled).toBe(false);
		expect(parsed.persistentProfile).toBe(true);
		expect(String(result)).not.toContain("already in use");
	});
});
