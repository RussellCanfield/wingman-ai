import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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

	it("reuses the previously active page across session actions", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-session-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-session-tmp-"));
		tempDirs.push(workspace, tempDir);

		const manager = new BrowserSessionManager();
		managers.push(manager);

		let activeUrl = "about:blank";
		const activePageCalls: string[] = [];
		const blankPageCalls: string[] = [];

		const activePage = {
			goto: async (url: string) => {
				activeUrl = url;
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
			evaluate: async () => "ok",
			screenshot: async ({ path }: { path: string }) => {
				activePageCalls.push(`screenshot:${path}`);
				writeFileSync(path, "shot");
			},
			title: async () => "Active Session",
			url: () => activeUrl,
		};

		const blankPage = {
			goto: async (url: string) => {
				blankPageCalls.push(`goto:${url}`);
			},
			bringToFront: async () => {
				blankPageCalls.push("bringToFront");
			},
			click: async () => {},
			fill: async () => {},
			keyboard: { press: async () => {} },
			waitForTimeout: async () => {},
			textContent: async () => "",
			evaluate: async () => "ok",
			screenshot: async ({ path }: { path: string }) => {
				blankPageCalls.push(`screenshot:${path}`);
				writeFileSync(path, "blank-shot");
			},
			title: async () => "Blank Session",
			url: () => "about:blank",
		};
		let pages = [activePage];

		const context = {
			pages: () => pages,
			newPage: async () => activePage,
		};

		const startTool = createBrowserSessionStartTool(
			{
				workspace,
				ownerId: "agent-active-page",
				sessionManager: manager,
			},
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => ({
							contexts: () => [context],
							close: async () => {},
						}),
					},
				}),
				startChrome: async () => ({
					wsEndpoint: "ws://127.0.0.1:9222/devtools/browser/test",
					close: async () => {},
				}),
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);
		const actionTool = createBrowserSessionActionTool({
			workspace,
			ownerId: "agent-active-page",
			sessionManager: manager,
		});

		const startResult = (await startTool.invoke({
			url: "https://example.com/dashboard",
		})) as {
			ok: boolean;
			session_id: string;
			final_url: string;
		};

		expect(startResult.ok).toBe(true);
		expect(startResult.final_url).toBe("https://example.com/dashboard");
		pages = [activePage, blankPage];

		const actionResult = (await actionTool.invoke({
			session_id: startResult.session_id,
			actions: [{ type: "screenshot", path: "artifacts/reused-page.png" }],
		})) as {
			ok: boolean;
			final_url: string;
		};

		expect(actionResult.ok).toBe(true);
		expect(actionResult.final_url).toBe("https://example.com/dashboard");
		expect(activePageCalls).toContain("goto:https://example.com/dashboard");
		expect(activePageCalls).toContain(
			`screenshot:${join(workspace, "artifacts/reused-page.png")}`,
		);
		expect(blankPageCalls).not.toContain("bringToFront");
		expect(blankPageCalls).not.toContain(
			`screenshot:${join(workspace, "artifacts/reused-page.png")}`,
		);
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

	it("surfaces screenshot artifacts in browser session responses", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-session-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-session-tmp-"));
		tempDirs.push(workspace, tempDir);

		const manager = new BrowserSessionManager();
		managers.push(manager);

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
			screenshot: async ({ path }: { path: string }) => {
				writeFileSync(path, "shot");
			},
			title: async () => "Screenshot Session",
			url: () => currentUrl,
		};

		const actionTool = createBrowserSessionActionTool({
			workspace,
			ownerId: "agent-shot",
			sessionManager: manager,
		});
		const startTool = createBrowserSessionStartTool(
			{
				workspace,
				ownerId: "agent-shot",
				sessionManager: manager,
			},
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => ({
							contexts: () => [
								{ pages: () => [page], newPage: async () => page },
							],
							close: async () => {},
						}),
					},
				}),
				startChrome: async () => ({
					wsEndpoint: "ws://127.0.0.1:9222/devtools/browser/test",
					close: async () => {},
				}),
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);

		const startResult = (await startTool.invoke({
			url: "https://example.com/shot",
		})) as {
			session_id: string;
		};
		const actionResult = (await actionTool.invoke({
			session_id: startResult.session_id,
			actions: [{ type: "screenshot", path: "artifacts/shot.png", fullPage: false }],
		})) as {
			ok: boolean;
			action_results: Array<{
				type: string;
				path: string;
				absolutePath: string;
				uri: string;
			}>;
			media: Array<{
				path: string;
				relativePath: string;
				uri: string;
				url: string;
				mimeType: string;
				name: string;
			}>;
			content: Array<Record<string, unknown>>;
		};

		expect(actionResult.ok).toBe(true);
		expect(actionResult.action_results).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "screenshot",
					path: "artifacts/shot.png",
					absolutePath: join(workspace, "artifacts/shot.png"),
					uri: `/api/fs/file?path=${encodeURIComponent(join(workspace, "artifacts/shot.png"))}`,
				}),
			]),
		);
		expect(actionResult.media).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: join(workspace, "artifacts/shot.png"),
					relativePath: "artifacts/shot.png",
					uri: `/api/fs/file?path=${encodeURIComponent(join(workspace, "artifacts/shot.png"))}`,
					url: `/api/fs/file?path=${encodeURIComponent(join(workspace, "artifacts/shot.png"))}`,
					mimeType: "image/png",
					name: "shot.png",
				}),
			]),
		);
		expect(actionResult.content).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "resource_link",
					uri: `/api/fs/file?path=${encodeURIComponent(join(workspace, "artifacts/shot.png"))}`,
					mimeType: "image/png",
				}),
			]),
		);
	});

	it("finalizes Playwright video recordings when the session closes", async () => {
		const workspace = mkdtempSync(join(tmpdir(), "wingman-browser-session-"));
		const tempDir = mkdtempSync(join(tmpdir(), "wingman-browser-session-tmp-"));
		tempDirs.push(workspace, tempDir);

		const manager = new BrowserSessionManager();
		managers.push(manager);

		const fakeChromePath = join(tempDir, "chrome-bin");
		writeFileSync(fakeChromePath, "fake chrome binary");

		let currentUrl = "about:blank";
		let closeCalled = false;
		const videoPath = join(
			workspace,
			".wingman/browser/videos/recording-1700000000000/session.webm",
		);
		const videoHandle = {
			path: async () => videoPath,
		};

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
			video: () => videoHandle,
			title: async () => "Video Session",
			url: () => currentUrl,
		};

		const startTool = createBrowserSessionStartTool(
			{
				workspace,
				ownerId: "agent-video",
				sessionManager: manager,
				defaultExecutablePath: fakeChromePath,
			},
			{
				importPlaywright: async () => ({
					chromium: {
						connectOverCDP: async () => {
							throw new Error("connectOverCDP should not be used");
						},
						launchPersistentContext: async (_userDataDir, options) => {
							expect(options?.recordVideo?.dir).toBe(
								join(
									workspace,
									".wingman/browser/videos/recording-1700000000000",
								),
							);
							return {
								pages: () => [page],
								newPage: async () => page,
								close: async () => {
									closeCalled = true;
									mkdirSync(dirname(videoPath), { recursive: true });
									writeFileSync(videoPath, "video");
								},
							};
						},
					},
				}),
				mkTempDir: () => tempDir,
				removeDir: () => {},
				now: () => 1700000000000,
			},
		);
		const closeTool = createBrowserSessionCloseTool({
			workspace,
			ownerId: "agent-video",
			sessionManager: manager,
		});

		const startResult = (await startTool.invoke({
			url: "https://example.com/video",
			recordVideo: true,
		})) as {
			ok: boolean;
			session_id: string;
			video_recording: { enabled: boolean; state: string; dir: string };
		};

		expect(startResult.ok).toBe(true);
		expect(startResult.video_recording).toMatchObject({
			enabled: true,
			state: "recording",
			dir: ".wingman/browser/videos/recording-1700000000000",
		});

		const closeResult = (await closeTool.invoke({
			session_id: startResult.session_id,
		})) as {
			ok: boolean;
			closed: boolean;
			media: Array<{
				path: string;
				relativePath: string;
				uri: string;
				url: string;
				mimeType: string;
				name: string;
			}>;
			video_recording: { enabled: boolean; state: string; videoCount: number } | null;
			content: Array<Record<string, unknown>>;
		};

		expect(closeCalled).toBe(true);
		expect(closeResult.ok).toBe(true);
		expect(closeResult.closed).toBe(true);
		expect(closeResult.video_recording).toMatchObject({
			enabled: true,
			state: "saved",
			videoCount: 1,
		});
		expect(closeResult.media).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: videoPath,
					relativePath:
						".wingman/browser/videos/recording-1700000000000/session.webm",
					uri: `/api/fs/file?path=${encodeURIComponent(videoPath)}`,
					url: `/api/fs/file?path=${encodeURIComponent(videoPath)}`,
					mimeType: "video/webm",
					name: "session.webm",
				}),
			]),
		);
		expect(closeResult.content).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					type: "resource_link",
					uri: `/api/fs/file?path=${encodeURIComponent(videoPath)}`,
					mimeType: "video/webm",
				}),
			]),
		);
	});
});
