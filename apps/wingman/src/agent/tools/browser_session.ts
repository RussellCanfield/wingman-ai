import { tool } from "langchain";
import * as z from "zod";
import {
	type BrowserControlDependencies,
	type BrowserControlInput,
	BrowserControlInputSchema,
	BrowserSessionVideoRecordingSchema,
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

const BrowserSessionStartInputSchema = BrowserControlInputSchema.extend({
	recordVideo: BrowserSessionVideoRecordingSchema.optional().describe(
		"Enable Playwright video recording for this managed session. Videos are finalized and returned when the session closes.",
	),
});

type BrowserSessionStartInput = BrowserControlInput & {
	recordVideo?: z.infer<typeof BrowserSessionVideoRecordingSchema>;
};

const buildMediaBlocks = (media: unknown[]) =>
	media
		.map((entry) => {
			if (!entry || typeof entry !== "object") return null;
			const record = entry as Record<string, unknown>;
			const uri =
				typeof record.url === "string" && record.url.trim()
					? record.url.trim()
					: typeof record.uri === "string" && record.uri.trim()
						? record.uri.trim()
						: "";
			if (!uri) return null;
			return {
				type: "resource_link" as const,
				uri,
				...(typeof record.mimeType === "string"
					? { mimeType: record.mimeType }
					: {}),
				...(typeof record.name === "string" ? { name: record.name } : {}),
			};
		})
		.filter(Boolean);

const buildResponse = (payload: Record<string, unknown>) => {
	const media = Array.isArray(payload.media) ? payload.media : [];
	return {
		...payload,
		content: [
			{
				type: "text" as const,
				text: JSON.stringify(payload, null, 2),
			},
			...buildMediaBlocks(media),
		],
		structuredContent: payload,
	};
};

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
		media: summary?.media || [],
		video_recording: summary?.videoRecording || null,
		browser: summary?.browser || null,
		transport: summary?.transport || snapshot.transportUsed,
	};
};

export const createBrowserSessionStartTool = (
	options: BrowserSessionToolOptions,
	dependencies: Partial<BrowserControlDependencies> = {},
) => {
	return tool(
		async (input: BrowserSessionStartInput) => {
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
				'Default browser automation entrypoint. Start a managed browser session for screenshots, extraction, QA, and multi-step automation; you can use it for one-shot tasks or continue the same browser state across multiple tool calls. Use browser_session_action to continue and browser_session_close when finished. Transport can be selected per session with "auto", "playwright", or "relay".',
			schema: BrowserSessionStartInputSchema,
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
				"Continue the default managed browser workflow by running more actions inside an existing browser session. Use the session_id returned by browser_session_start to keep the same tab/profile state across multiple calls.",
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
				const { snapshot, closeSummary } = await options.sessionManager.closeSession(
					{
					ownerId: options.ownerId,
					sessionId: session_id,
					},
				);
				return buildResponse({
					ok: true,
					closed: true,
					...summarizeResult(snapshot, null),
					media: closeSummary.media,
					video_recording: closeSummary.videoRecording,
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
				"Finish the managed browser workflow by closing a session and releasing any temporary browser resources or profile locks owned by it. Finalized video recordings are returned here.",
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
				"List the managed browser sessions currently owned by this agent run. Use this to recover a session_id before continuing or closing the default browser workflow.",
			schema: BrowserSessionListInputSchema,
		},
	);
};
