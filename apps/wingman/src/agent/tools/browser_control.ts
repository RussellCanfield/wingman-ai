import { tool } from "langchain";
import { createLogger } from "@/logger.js";
import {
	type BrowserControlDependencies,
	type BrowserControlInput,
	BrowserControlInputSchema,
	type BrowserControlToolOptions,
	clearStaleDevtoolsArtifacts,
	closeBrowserSessionRuntime,
	executeBrowserSessionRuntime,
	openBrowserSessionRuntime,
} from "./browser_runtime.js";

const logger = createLogger();

export { clearStaleDevtoolsArtifacts };

export const createBrowserControlTool = (
	options: BrowserControlToolOptions = {},
	dependencies: Partial<BrowserControlDependencies> = {},
) => {
	return tool(
		async (input: BrowserControlInput) => {
			let runtime: Awaited<
				ReturnType<typeof openBrowserSessionRuntime>
			> | null = null;
			try {
				runtime = await openBrowserSessionRuntime(options, dependencies, input);
				const summary = await executeBrowserSessionRuntime(runtime, input);
				return JSON.stringify(summary, null, 2);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Unknown browser error";
				logger.error(`browser_control failed: ${message}`);
				return `Error running browser_control: ${message}`;
			} finally {
				if (runtime) {
					await closeBrowserSessionRuntime(runtime, dependencies);
				}
			}
		},
		{
			name: "browser_control",
			description:
				'Use this only when the user explicitly wants you to use or take over their existing browser, live tab, or extension-attached session (for example: "use my browser" or "take control of my browser"). Transport is selected by config or the optional input override ("auto", "playwright", or "relay"): Playwright persistent-context is preferred for persistent profiles, CDP is used for standard runs with persistent-context fallback, and relay can bridge a live extension-attached tab. For normal browser automation, screenshots, and QA, prefer browser_session_start/browser_session_action/browser_session_close.',
			schema: BrowserControlInputSchema,
		},
	);
};
