import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	createBrowserSessionActionTool,
	createBrowserSessionCloseTool,
	createBrowserSessionListTool,
	createBrowserSessionStartTool,
} from "../tools/browser_session";
import { BrowserSessionManager } from "../tools/browser_session_manager";

describe("browser_session tools", () => {
	const tempDirs: string[] = [];
	const managers: BrowserSessionManager[] = [];

	afterEach(async () => {
		await Promise.all(managers.map((manager) => manager.dispose()));
		managers.length = 0;
		for (const dir of tempDirs) {
			rmSync(dir, { recursive: true, force: true });
		}
		tempDirs.length = 0;
	});

	it("keeps the same browser session alive across start/action/close", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-session-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-session-tmp-"));
		tempDirs.push(workspace, tempDir);

		const manager = new BrowserSessionManager();
		managers.push(manager);

		let currentUrl = "about:blank";
		let browserClosed = false;
		let chromeClosed = false;
		const actionCalls: string[] = [];

		const page = {
			goto: async (url: string) => {
				currentUrl = url;
				actionCalls.push(`goto:${url}`);
			},
			bringToFront: async () => {
				actionCalls.push("bringToFront");
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
			textContent: async () => "browser session content",
			evaluate: async (expression: string) => {
				actionCalls.push(`eval:${expression}`);
				return { ok: true };
			},
			screenshot: async ({ path }: { path: string }) => {
				actionCalls.push(`screenshot:${path}`);
				writeFileSync(path, "shot");
			},
			title: async () => "Session Title",
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

		const dependencies = {
			importPlaywright: async () => ({
				chromium: {
					connectOverCDP: async () => browser,
				},
			}),
			startChrome: async () => ({
				wsEndpoint: "ws://127.0.0.1:9222/devtools/browser/test",
				close: async () => {
					chromeClosed = true;
				},
			}),
			mkTempDir: () => tempDir,
			removeDir: () => {},
			now: () => 1700000000000,
		};

		const startTool = createBrowserSessionStartTool(
			{
				workspace,
				ownerId: "agent-1",
				sessionManager: manager,
			},
			dependencies,
		);
		const actionTool = createBrowserSessionActionTool({
			workspace,
			ownerId: "agent-1",
			sessionManager: manager,
		});
		const listTool = createBrowserSessionListTool({
			workspace,
			ownerId: "agent-1",
			sessionManager: manager,
		});
		const closeTool = createBrowserSessionCloseTool({
			workspace,
			ownerId: "agent-1",
			sessionManager: manager,
		});

		const startResult = (await startTool.invoke({
			url: "https://example.com/start",
			actions: [{ type: "evaluate", expression: "document.title" }],
		})) as {
			ok: boolean;
			session_id: string;
			final_url: string;
			action_results: Array<{ type: string }>;
		};

		expect(startResult.ok).toBe(true);
		expect(startResult.session_id).toBeTruthy();
		expect(startResult.final_url).toBe("https://example.com/start");
		expect(startResult.action_results).toHaveLength(1);
		expect(browserClosed).toBe(false);
		expect(chromeClosed).toBe(false);

		const listResult = (await listTool.invoke({})) as {
			ok: boolean;
			sessions: Array<{ session_id: string }>;
		};
		expect(listResult.ok).toBe(true);
		expect(listResult.sessions).toHaveLength(1);
		expect(listResult.sessions[0]?.session_id).toBe(startResult.session_id);

		const actionResult = (await actionTool.invoke({
			session_id: startResult.session_id,
			actions: [
				{ type: "click", selector: "#login" },
				{ type: "type", selector: "#query", text: "wingman", submit: true },
			],
		})) as {
			ok: boolean;
			session_id: string;
			final_url: string;
			action_results: Array<{ type: string }>;
		};

		expect(actionResult.ok).toBe(true);
		expect(actionResult.session_id).toBe(startResult.session_id);
		expect(actionResult.final_url).toBe("https://example.com/start");
		expect(actionResult.action_results).toHaveLength(2);
		expect(actionCalls).toContain("click:#login");
		expect(actionCalls).toContain("press:Enter");
		expect(browserClosed).toBe(false);
		expect(chromeClosed).toBe(false);

		const closeResult = (await closeTool.invoke({
			session_id: startResult.session_id,
		})) as {
			ok: boolean;
			closed: boolean;
		};

		expect(closeResult.ok).toBe(true);
		expect(closeResult.closed).toBe(true);
		expect(browserClosed).toBe(true);
		expect(chromeClosed).toBe(true);
	});

	it("honors per-session transport override when starting a managed session", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-session-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-session-tmp-"));
		tempDirs.push(workspace, tempDir);

		const manager = new BrowserSessionManager();
		managers.push(manager);

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
			title: async () => "Relay Session",
			url: () => currentUrl,
		};

		const startTool = createBrowserSessionStartTool(
			{
				workspace,
				ownerId: "agent-2",
				sessionManager: manager,
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
						connectOverCDP: async (wsEndpoint: string) => {
							expect(wsEndpoint).toContain("18792");
							return {
								contexts: () => [
									{ pages: () => [page], newPage: async () => page },
								],
								close: async () => {},
							};
						},
					},
				}),
				startChrome: async () => {
					throw new Error("startChrome should not run for relay");
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

		const result = (await startTool.invoke({
			url: "https://example.com/relay",
			transport: "relay",
		})) as {
			ok: boolean;
			transport_requested: string;
			transport_used: string;
			browser: string;
			final_url: string;
		};

		expect(result.ok).toBe(true);
		expect(relayResolveCalled).toBe(true);
		expect(result.transport_requested).toBe("relay");
		expect(result.transport_used).toBe("relay-cdp");
		expect(result.browser).toBe("chrome-relay");
		expect(result.final_url).toBe("https://example.com/relay");
	});
});
