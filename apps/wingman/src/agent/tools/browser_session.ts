import { tool } from "langchain";
import * as z from "zod";
import {
	type BrowserControlDependencies,
	type BrowserControlInput,
	BrowserControlInputSchema,
	type BrowserControlToolOptions,
	type BrowserExecutionSummary,
	type BrowserSessionActionInput,
	BrowserSessionActionInputSchema,
} from "./browser_runtime.js";
import type {
	BrowserSessionManager,
	BrowserSessionSnapshot,
} from "./browser_session_manager.js";

export interface BrowserSessionToolOptions extends BrowserControlToolOptions {
	ownerId: string;
	sessionManager: BrowserSessionManager;
}

const CloseBrowserSessionInputSchema = z.object({
	session_id: z
		.string()
		.min(1)
		.describe("Existing browser session id to close"),
});

const BrowserSessionListInputSchema = z.object({});

const buildResponse = (payload: Record<string, unknown>) => payload;

const summarizeResult = (
	snapshot: BrowserSessionSnapshot,
	summary?: BrowserExecutionSummary | null,
) => {
	return {
		session_id: snapshot.sessionId,
		status: snapshot.status,
		transport_requested: snapshot.transportRequested,
		transport_used: snapshot.transportUsed,
		mode: snapshot.mode,
		persistent_profile: snapshot.persistentProfile,
		profile_id: snapshot.profileId || null,
		profile_path: snapshot.profilePath || null,
		reused_existing_session: snapshot.reusedExistingSession,
		started_at: snapshot.startedAt,
		updated_at: snapshot.updatedAt,
		workspace: snapshot.workspace,
		config_workspace: snapshot.configWorkspace,
		final_url: summary?.finalUrl || snapshot.finalUrl || null,
		title: summary?.title || snapshot.title || null,
		fallback_reason: summary?.fallbackReason || null,
		extensions: summary?.extensions || [],
		action_results: summary?.actionResults || [],
		browser: summary?.browser || null,
		transport: summary?.transport || snapshot.transportUsed,
	};
};

export const createBrowserSessionStartTool = (
	options: BrowserSessionToolOptions,
	dependencies: Partial<BrowserControlDependencies> = {},
) => {
	return tool(
		async (input: BrowserControlInput) => {
			try {
				const { snapshot, summary } = await options.sessionManager.startSession(
					{
						ownerId: options.ownerId,
						options,
						dependencies,
						input,
					},
				);
				return buildResponse({
					ok: true,
					...summarizeResult(snapshot, summary),
				});
			} catch (error) {
				return buildResponse({
					ok: false,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		},
		{
			name: "browser_session_start",
			description:
				'Start a managed browser session that persists across multiple tool calls. Use this for iterative QA/debugging where the same browser state should survive across turns. Transport can be selected per session with "auto", "playwright", or "relay".',
			schema: BrowserControlInputSchema,
		},
	);
};

export const createBrowserSessionActionTool = (
	options: BrowserSessionToolOptions,
) => {
	return tool(
		async (input: BrowserSessionActionInput) => {
			try {
				const { session_id, ...actionInput } = input;
				const { snapshot, summary } = await options.sessionManager.runSession({
					ownerId: options.ownerId,
					sessionId: session_id,
					input: actionInput,
				});
				return buildResponse({
					ok: true,
					...summarizeResult(snapshot, summary),
				});
			} catch (error) {
				return buildResponse({
					ok: false,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		},
		{
			name: "browser_session_action",
			description:
				"Run browser actions inside an existing managed browser session. Use the session_id returned by browser_session_start to continue the same tab/profile state across multiple calls.",
			schema: BrowserSessionActionInputSchema,
		},
	);
};

export const createBrowserSessionCloseTool = (
	options: BrowserSessionToolOptions,
) => {
	return tool(
		async ({ session_id }: { session_id: string }) => {
			try {
				const snapshot = await options.sessionManager.closeSession({
					ownerId: options.ownerId,
					sessionId: session_id,
				});
				return buildResponse({
					ok: true,
					closed: true,
					...summarizeResult(snapshot, null),
				});
			} catch (error) {
				return buildResponse({
					ok: false,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		},
		{
			name: "browser_session_close",
			description:
				"Close a managed browser session and release any temporary browser resources or profile locks owned by that session.",
			schema: CloseBrowserSessionInputSchema,
		},
	);
};

export const createBrowserSessionListTool = (
	options: BrowserSessionToolOptions,
) => {
	return tool(
		async () => {
			const sessions = options.sessionManager.listSessions(options.ownerId);
			return buildResponse({
				ok: true,
				sessions: sessions.map((snapshot) => summarizeResult(snapshot, null)),
			});
		},
		{
			name: "browser_session_list",
			description:
				"List the managed browser sessions currently owned by this agent run. Use this to recover a session_id before continuing or closing a session.",
			schema: BrowserSessionListInputSchema,
		},
	);
};
