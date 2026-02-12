import { createHash, randomUUID } from "node:crypto";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { basename, extname, join } from "node:path";
import { createFalClient, type QueueStatus } from "@fal-ai/client";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type {
	ContentBlock,
	ImageContent,
	TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod";
import {
	resolveFalLocalMediaPath,
	resolveFalOutputDir,
	resolveFalStateDir,
	resolveFalWorkdir,
} from "./fal/runtime.js";
import { buildFalGenerationSummary } from "./fal/summary.js";

const FAL_DEFAULT_POLL_INTERVAL_MS =
	parsePositiveInt(process.env.FAL_MCP_POLL_INTERVAL_MS) || 2500;
const FAL_DEFAULT_STATUS_TIMEOUT_MS =
	parsePositiveInt(process.env.FAL_MCP_STATUS_TIMEOUT_MS) || 60_000;
const FAL_HTTP_TIMEOUT_MS =
	parsePositiveInt(process.env.FAL_MCP_HTTP_TIMEOUT_MS) || 120_000;
const FAL_DEFAULT_LOG_LIMIT = 40;

const FAL_API_KEY_ENV =
	process.env.FAL_API_KEY?.trim() || process.env.FAL_KEY?.trim() || "";
const FAL_REVIEW_MODE = normalizeReviewMode(process.env.FAL_MCP_REVIEW_MODE);

const FAL_MODELS = {
	imageOrTexture:
		process.env.FAL_MODEL_IMAGE_OR_TEXTURE?.trim() ||
		"fal-ai/nano-banana-pro",
	imageEdit:
		process.env.FAL_MODEL_IMAGE_EDIT?.trim() ||
		"fal-ai/kling-image/v3/image-to-image",
	audioMusic:
		process.env.FAL_MODEL_AUDIO_OR_MUSIC?.trim() || "fal-ai/elevenlabs/music",
	audioSoundEffect:
		process.env.FAL_MODEL_SOUND_EFFECT?.trim() ||
		"beatoven/sound-effect-generation",
	videoFromImage:
		process.env.FAL_MODEL_VIDEO_FROM_IMAGE?.trim() ||
		"fal-ai/kling-video/o3/standard/image-to-video",
};

const FAL_WORKDIR = resolveFalWorkdir();
const FAL_STATE_DIR = resolveFalStateDir();
const FAL_OUTPUT_DIR = resolveFalOutputDir();

const JOBS_DIR = join(FAL_STATE_DIR, "jobs");
const PENDING_DIR = join(FAL_STATE_DIR, "pending");

const inMemoryJobs = new Map<string, FalJobState>();

type MediaModality = "image" | "audio" | "video" | "file";
type JobStatus =
	| "in_queue"
	| "in_progress"
	| "awaiting_review"
	| "completed"
	| "cancelled"
	| "denied"
	| "failed";

type ReviewState = "pending" | "accepted" | "denied" | null;

type StoredMedia = {
	id: string;
	modality: MediaModality;
	mimeType: string;
	remoteUrl: string;
	path: string | null;
	name: string;
	sizeBytes: number | null;
	createdAt: string;
};

type FalJobState = {
	jobId: string;
	requestId: string;
	toolName: string;
	modelId: string;
	modality: MediaModality;
	prompt: string;
	status: JobStatus;
	reviewRequired: boolean;
	reviewState: ReviewState;
	error: string | null;
	submittedAt: string;
	updatedAt: string;
	queueStatus: QueueStatus["status"] | null;
	queueStatusUrl: string | null;
	queueResponseUrl: string | null;
	queueCancelUrl: string | null;
	logs: string[];
	media: StoredMedia[];
	rawResult: unknown | null;
};

type MediaCandidate = {
	url: string;
	modality: MediaModality;
	mimeType?: string;
	label?: string;
};

const server = new McpServer({
	name: "wingman-fal-ai",
	version: "0.1.0",
});

const sharedInputSchema = z.object({
	apiKey: z
		.string()
		.min(1)
		.optional()
		.describe("Optional FAL API key override for this tool call."),
	modelInput: z
		.record(z.string(), z.any())
		.optional()
		.describe(
			"Optional raw model input overrides merged into the default payload.",
		),
	waitForCompletion: z
		.boolean()
		.optional()
		.default(false)
		.describe(
			"If true, block in-tool and poll status until complete or timeout.",
		),
	timeoutSeconds: z
		.number()
		.int()
		.min(1)
		.max(3600)
		.optional()
		.describe("Optional timeout in seconds for waitForCompletion mode."),
	pollIntervalMs: z
		.number()
		.int()
		.min(250)
		.max(30000)
		.optional()
		.describe("Optional polling interval in ms for waitForCompletion mode."),
});

const generateImageOrTextureSchema = sharedInputSchema.extend({
	prompt: z.string().min(1),
});

const generateImageEditSchema = sharedInputSchema.extend({
	prompt: z.string().min(1),
	sourceImage: z
		.string()
		.min(1)
		.describe("Source image as data URL, local file path, or http(s) URL."),
});

const generateAudioOrMusicSchema = sharedInputSchema.extend({
	prompt: z.string().min(1),
	audioMode: z
		.enum(["music", "sound_effect"])
		.optional()
		.default("music")
		.describe("Use 'music' for songs/tracks or 'sound_effect' for effects."),
});

const generateVideoFromImageSchema = sharedInputSchema.extend({
	prompt: z.string().min(1),
	sourceImage: z
		.string()
		.min(1)
		.describe("Source image as data URL, local file path, or http(s) URL."),
});

const falGenerationStatusSchema = z.object({
	jobId: z.string().min(1).describe("Job id returned from a generate_* tool."),
	action: z
		.enum(["check", "wait", "cancel", "accept", "deny"])
		.optional()
		.default("check")
		.describe(
			"Status action. Use wait for polling, accept/deny for review flow.",
		),
	includeLogs: z
		.boolean()
		.optional()
		.default(true)
		.describe("Include recent queue logs in the result payload."),
	timeoutSeconds: z
		.number()
		.int()
		.min(1)
		.max(3600)
		.optional()
		.describe("Timeout in seconds when action=wait."),
	pollIntervalMs: z
		.number()
		.int()
		.min(250)
		.max(30000)
		.optional()
		.describe("Polling interval in ms when action=wait."),
	apiKey: z
		.string()
		.min(1)
		.optional()
		.describe("Optional FAL API key override for queue status calls."),
});

server.registerTool(
	"generate_image_or_texture",
	{
		title: "FAL Generate Image Or Texture",
		description:
			"Generate an image or texture with FAL using a queue-backed async job. Returns a job id. Use fal_generation_status for updates and completion.",
		inputSchema: generateImageOrTextureSchema,
	},
	async ({
		prompt,
		modelInput,
		apiKey,
		waitForCompletion,
		timeoutSeconds,
		pollIntervalMs,
	}) => {
		const resolvedApiKey = resolveFalApiKey(apiKey);
		const client = createFalClient({ credentials: resolvedApiKey });
		const payload = mergeModelInput({ prompt }, modelInput);
		const job = await submitFalJob({
			client,
			modelId: FAL_MODELS.imageOrTexture,
			modality: "image",
			toolName: "generate_image_or_texture",
			prompt,
			input: payload,
		});

		if (waitForCompletion) {
			return runStatusAction({
				job,
				action: "wait",
				includeLogs: true,
				client,
				timeoutMs: normalizeTimeoutMs(timeoutSeconds),
				pollIntervalMs: normalizePollIntervalMs(pollIntervalMs),
			});
		}

		return toToolResult(job);
	},
);

server.registerTool(
	"generate_image_edit",
	{
		title: "FAL Generate Image Edit",
		description:
			"Edit an image using FAL image-to-image queue jobs. Returns a job id. Use fal_generation_status for updates and completion.",
		inputSchema: generateImageEditSchema,
	},
	async ({
		prompt,
		sourceImage,
		modelInput,
		apiKey,
		waitForCompletion,
		timeoutSeconds,
		pollIntervalMs,
	}) => {
		const resolvedApiKey = resolveFalApiKey(apiKey);
		const client = createFalClient({ credentials: resolvedApiKey });
		const sourceImageUrl = await resolveImageSourceToFalUrl(
			sourceImage,
			client,
		);
		const payload = mergeModelInput(
			{
				prompt,
				image_url: sourceImageUrl,
			},
			modelInput,
		);
		const job = await submitFalJob({
			client,
			modelId: FAL_MODELS.imageEdit,
			modality: "image",
			toolName: "generate_image_edit",
			prompt,
			input: payload,
		});

		if (waitForCompletion) {
			return runStatusAction({
				job,
				action: "wait",
				includeLogs: true,
				client,
				timeoutMs: normalizeTimeoutMs(timeoutSeconds),
				pollIntervalMs: normalizePollIntervalMs(pollIntervalMs),
			});
		}

		return toToolResult(job);
	},
);

server.registerTool(
	"generate_audio_or_music",
	{
		title: "FAL Generate Audio Or Music",
		description:
			"Generate audio or music through FAL queue jobs. Returns a job id. Use fal_generation_status for updates and completion.",
		inputSchema: generateAudioOrMusicSchema,
	},
	async ({
		prompt,
		audioMode,
		modelInput,
		apiKey,
		waitForCompletion,
		timeoutSeconds,
		pollIntervalMs,
	}) => {
		const resolvedApiKey = resolveFalApiKey(apiKey);
		const client = createFalClient({ credentials: resolvedApiKey });
		const modelId =
			audioMode === "sound_effect"
				? FAL_MODELS.audioSoundEffect
				: FAL_MODELS.audioMusic;
		const payload = mergeModelInput({ prompt }, modelInput);
		const job = await submitFalJob({
			client,
			modelId,
			modality: "audio",
			toolName: "generate_audio_or_music",
			prompt,
			input: payload,
		});

		if (waitForCompletion) {
			return runStatusAction({
				job,
				action: "wait",
				includeLogs: true,
				client,
				timeoutMs: normalizeTimeoutMs(timeoutSeconds),
				pollIntervalMs: normalizePollIntervalMs(pollIntervalMs),
			});
		}

		return toToolResult(job);
	},
);

server.registerTool(
	"generate_video_from_image",
	{
		title: "FAL Generate Video From Image",
		description:
			"Generate a video from an image using FAL queue jobs. Returns a job id. Use fal_generation_status for updates and completion.",
		inputSchema: generateVideoFromImageSchema,
	},
	async ({
		prompt,
		sourceImage,
		modelInput,
		apiKey,
		waitForCompletion,
		timeoutSeconds,
		pollIntervalMs,
	}) => {
		const resolvedApiKey = resolveFalApiKey(apiKey);
		const client = createFalClient({ credentials: resolvedApiKey });
		const sourceImageUrl = await resolveImageSourceToFalUrl(
			sourceImage,
			client,
		);
		const payload = mergeModelInput(
			{
				prompt,
				image_url: sourceImageUrl,
			},
			modelInput,
		);
		const job = await submitFalJob({
			client,
			modelId: FAL_MODELS.videoFromImage,
			modality: "video",
			toolName: "generate_video_from_image",
			prompt,
			input: payload,
		});

		if (waitForCompletion) {
			return runStatusAction({
				job,
				action: "wait",
				includeLogs: true,
				client,
				timeoutMs: normalizeTimeoutMs(timeoutSeconds),
				pollIntervalMs: normalizePollIntervalMs(pollIntervalMs),
			});
		}

		return toToolResult(job);
	},
);

server.registerTool(
	"fal_generation_status",
	{
		title: "FAL Generation Status",
		description:
			"Check, wait, cancel, or review FAL generation jobs. Use action=wait to poll until completion. Use action=accept/deny when review mode is enabled.",
		inputSchema: falGenerationStatusSchema,
	},
	async ({
		jobId,
		action,
		includeLogs,
		timeoutSeconds,
		pollIntervalMs,
		apiKey,
	}) => {
		const existing = loadJobState(jobId);
		if (!existing) {
			throw new Error(
				`Unknown FAL job "${jobId}". Submit a new generation first or check the job id.`,
			);
		}

		if (action === "accept" || action === "deny") {
			return runReviewDecision(existing, action);
		}

		if (action === "check" && isTerminal(existing.status)) {
			return toToolResult(existing);
		}

		const resolvedApiKey = resolveFalApiKey(apiKey);
		const client = createFalClient({ credentials: resolvedApiKey });

		return runStatusAction({
			job: existing,
			action,
			includeLogs,
			client,
			timeoutMs: normalizeTimeoutMs(timeoutSeconds),
			pollIntervalMs: normalizePollIntervalMs(pollIntervalMs),
		});
	},
);

function normalizeReviewMode(raw?: string): "auto" | "hil" {
	return raw?.trim().toLowerCase() === "hil" ? "hil" : "auto";
}

function parsePositiveInt(raw?: string): number | null {
	if (!raw) return null;
	const parsed = Number.parseInt(raw, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeTimeoutMs(timeoutSeconds?: number): number {
	if (timeoutSeconds && timeoutSeconds > 0) {
		return timeoutSeconds * 1000;
	}
	return FAL_DEFAULT_STATUS_TIMEOUT_MS;
}

function normalizePollIntervalMs(interval?: number): number {
	if (interval && interval >= 250) return interval;
	return FAL_DEFAULT_POLL_INTERVAL_MS;
}

function resolveFalApiKey(override?: string): string {
	const candidate = override?.trim() || FAL_API_KEY_ENV;
	if (!candidate) {
		throw new Error(
			"FAL API key missing. Set FAL_API_KEY (or FAL_KEY) in MCP env, or pass apiKey in tool input.",
		);
	}
	return candidate;
}

function sanitizeJobId(value: string): string {
	const normalized = (value || "").trim();
	if (!normalized) return randomUUID();
	const sanitized = normalized.replace(/[^a-zA-Z0-9._-]/g, "_");
	return sanitized.slice(0, 120) || randomUUID();
}

function buildJobPath(jobId: string): string {
	return join(JOBS_DIR, `${sanitizeJobId(jobId)}.json`);
}

function loadJobState(jobId: string): FalJobState | null {
	const normalized = sanitizeJobId(jobId);
	const cached = inMemoryJobs.get(normalized);
	if (cached) return cached;

	const path = buildJobPath(normalized);
	if (!existsSync(path)) return null;

	try {
		const parsed = JSON.parse(readFileSync(path, "utf-8")) as FalJobState;
		if (!parsed || typeof parsed !== "object") return null;
		inMemoryJobs.set(normalized, parsed);
		return parsed;
	} catch {
		return null;
	}
}

function saveJobState(job: FalJobState): FalJobState {
	const normalizedId = sanitizeJobId(job.jobId);
	const normalized: FalJobState = {
		...job,
		jobId: normalizedId,
		updatedAt: new Date().toISOString(),
	};
	mkdirSync(JOBS_DIR, { recursive: true });
	writeFileSync(
		buildJobPath(normalizedId),
		JSON.stringify(normalized, null, 2),
	);
	inMemoryJobs.set(normalizedId, normalized);
	return normalized;
}

function mapQueueStatus(status: QueueStatus["status"]): JobStatus {
	switch (status) {
		case "IN_QUEUE":
			return "in_queue";
		case "IN_PROGRESS":
			return "in_progress";
		case "COMPLETED":
			return "completed";
		default:
			return "failed";
	}
}

function isTerminal(status: JobStatus): boolean {
	return (
		status === "completed" ||
		status === "failed" ||
		status === "cancelled" ||
		status === "awaiting_review" ||
		status === "denied"
	);
}

function mergeModelInput(
	base: Record<string, unknown>,
	overrides?: Record<string, unknown>,
): Record<string, unknown> {
	if (!overrides || typeof overrides !== "object") return base;
	return {
		...base,
		...overrides,
	};
}

async function resolveImageSourceToFalUrl(
	source: string,
	client: ReturnType<typeof createFalClient>,
): Promise<string> {
	const trimmed = source.trim();
	if (!trimmed) {
		throw new Error("sourceImage cannot be empty.");
	}
	if (/^https?:\/\//i.test(trimmed)) {
		return trimmed;
	}

	const inline = parseBase64DataUrl(trimmed);
	if (inline) {
		if (!inline.mimeType.startsWith("image/")) {
			throw new Error(`Expected image data URL, got ${inline.mimeType}.`);
		}
		const bytes = Buffer.from(inline.data, "base64");
		if (bytes.length === 0) {
			throw new Error("sourceImage data URL is empty.");
		}
		return uploadToFalStorage(client, bytes, inline.mimeType, "source-image");
	}

	const localPath = resolveFalLocalMediaPath(trimmed, FAL_WORKDIR);
	if (!existsSync(localPath) || !statSync(localPath).isFile()) {
		throw new Error(
			`sourceImage must be a data URL, http(s) URL, or local file path: ${source}`,
		);
	}

	const bytes = readFileSync(localPath);
	if (bytes.length === 0) {
		throw new Error(`sourceImage file is empty: ${localPath}`);
	}
	const mimeType = mimeTypeFromPath(localPath) || "image/png";
	if (!mimeType.startsWith("image/")) {
		throw new Error(`sourceImage must be an image file, got ${mimeType}.`);
	}
	return uploadToFalStorage(client, bytes, mimeType, basename(localPath));
}

async function uploadToFalStorage(
	client: ReturnType<typeof createFalClient>,
	bytes: Buffer,
	mimeType: string,
	name: string,
): Promise<string> {
	const ext = extensionFromMimeType(mimeType);
	const blob = new Blob([bytes], { type: mimeType });
	const file = new File([blob], `${sanitizeName(name)}.${ext}`, {
		type: mimeType,
	});
	return client.storage.upload(file, {
		lifecycle: { expiresIn: "1d" },
	});
}

async function submitFalJob(input: {
	client: ReturnType<typeof createFalClient>;
	modelId: string;
	modality: MediaModality;
	toolName: string;
	prompt: string;
	input: Record<string, unknown>;
}): Promise<FalJobState> {
	const queued = await input.client.queue.submit(input.modelId, {
		input: input.input,
	});
	const now = new Date().toISOString();
	const job: FalJobState = {
		jobId: sanitizeJobId(queued.request_id || randomUUID()),
		requestId: queued.request_id,
		toolName: input.toolName,
		modelId: input.modelId,
		modality: input.modality,
		prompt: input.prompt,
		status: mapQueueStatus(queued.status),
		reviewRequired: FAL_REVIEW_MODE === "hil",
		reviewState: null,
		error: null,
		submittedAt: now,
		updatedAt: now,
		queueStatus: queued.status,
		queueStatusUrl:
			typeof queued.status_url === "string" ? queued.status_url : null,
		queueResponseUrl:
			typeof queued.response_url === "string" ? queued.response_url : null,
		queueCancelUrl:
			typeof queued.cancel_url === "string" ? queued.cancel_url : null,
		logs: [],
		media: [],
		rawResult: null,
	};
	return saveJobState(job);
}

async function runStatusAction(input: {
	job: FalJobState;
	action: "check" | "wait" | "cancel";
	includeLogs: boolean;
	client: ReturnType<typeof createFalClient>;
	timeoutMs: number;
	pollIntervalMs: number;
}) {
	let job = input.job;
	if (input.action === "cancel") {
		if (isTerminal(job.status)) {
			return toToolResult(job);
		}
		await input.client.queue.cancel(job.modelId, { requestId: job.requestId });
		job = saveJobState({
			...job,
			status: "cancelled",
			error: null,
		});
		return toToolResult(job);
	}

	const deadline =
		input.action === "wait" ? Date.now() + Math.max(1000, input.timeoutMs) : 0;

	for (;;) {
		job = await refreshQueueStatus(job, input.client, input.includeLogs);

		if (job.status === "completed") {
			job = await materializeCompletedJob(job, input.client);
		}

		if (isTerminal(job.status)) {
			return toToolResult(job);
		}

		if (input.action !== "wait") {
			return toToolResult(job);
		}
		if (Date.now() >= deadline) {
			return toToolResult(job);
		}
		await sleep(input.pollIntervalMs);
	}
}

async function refreshQueueStatus(
	job: FalJobState,
	client: ReturnType<typeof createFalClient>,
	includeLogs: boolean,
): Promise<FalJobState> {
	const status = await client.queue.status(job.modelId, {
		requestId: job.requestId,
		logs: includeLogs,
	});
	const statusWithLogs = status as QueueStatus & {
		logs?: Array<{ message?: string }>;
	};
	const logs =
		includeLogs && Array.isArray(statusWithLogs.logs)
			? statusWithLogs.logs
					.map((entry) =>
						typeof entry?.message === "string" ? entry.message : "",
					)
					.filter((entry) => entry.trim().length > 0)
					.slice(-FAL_DEFAULT_LOG_LIMIT)
			: job.logs;

	return saveJobState({
		...job,
		status: mapQueueStatus(status.status),
		queueStatus: status.status,
		queueStatusUrl:
			typeof status.status_url === "string" ? status.status_url : null,
		queueResponseUrl:
			typeof status.response_url === "string" ? status.response_url : null,
		queueCancelUrl:
			typeof status.cancel_url === "string" ? status.cancel_url : null,
		logs,
	});
}

async function materializeCompletedJob(
	job: FalJobState,
	client: ReturnType<typeof createFalClient>,
): Promise<FalJobState> {
	if (job.rawResult && job.media.length > 0) {
		if (job.reviewRequired && job.reviewState === "pending") {
			return saveJobState({
				...job,
				status: "awaiting_review",
			});
		}
		return saveJobState({
			...job,
			status: "completed",
		});
	}

	try {
		const result = await client.queue.result(job.modelId, {
			requestId: job.requestId,
		});
		const rawData = result?.data ?? null;
		const candidates = extractMediaCandidates(rawData, job.modality);

		const media =
			candidates.length > 0
				? await materializeMediaCandidates(job, candidates)
				: [];
		const nextStatus: JobStatus =
			job.reviewRequired && media.length > 0 ? "awaiting_review" : "completed";
		const reviewState: ReviewState =
			job.reviewRequired && media.length > 0
				? "pending"
				: media.length > 0
					? "accepted"
					: null;

		return saveJobState({
			...job,
			status: nextStatus,
			reviewState,
			error: null,
			media,
			rawResult: rawData,
		});
	} catch (error) {
		return saveJobState({
			...job,
			status: "failed",
			error: errorToString(error),
		});
	}
}

async function materializeMediaCandidates(
	job: FalJobState,
	candidates: MediaCandidate[],
): Promise<StoredMedia[]> {
	const destinationRoot = job.reviewRequired
		? join(PENDING_DIR, job.jobId)
		: resolveFinalOutputDir(job.modality);
	mkdirSync(destinationRoot, { recursive: true });

	const records: StoredMedia[] = [];

	for (const [index, candidate] of candidates.entries()) {
		let bytes: Buffer;
		let mimeType: string;

		try {
			const downloaded = await downloadRemoteFile(candidate.url);
			bytes = downloaded.bytes;
			mimeType =
				normalizeMimeType(downloaded.mimeType) ||
				candidate.mimeType ||
				"application/octet-stream";
		} catch {
			continue;
		}

		const extension =
			extensionFromMimeType(mimeType) || extensionFromUrl(candidate.url);
		const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
		const filename = `${Date.now()}-${index + 1}-${hash}.${extension || "bin"}`;
		const outputPath = join(destinationRoot, filename);
		writeFileSync(outputPath, bytes);

		records.push({
			id: `${job.jobId}-${index + 1}`,
			modality: classifyModality(candidate, mimeType),
			mimeType,
			remoteUrl: candidate.url,
			path: outputPath,
			name: candidate.label || filename,
			sizeBytes: bytes.length,
			createdAt: new Date().toISOString(),
		});
	}

	return records;
}

function resolveFinalOutputDir(modality: MediaModality): string {
	const folder =
		modality === "image"
			? "images"
			: modality === "audio"
				? "audio"
				: modality === "video"
					? "video"
					: "files";
	const dir = join(FAL_OUTPUT_DIR, folder);
	mkdirSync(dir, { recursive: true });
	return dir;
}

function runReviewDecision(
	job: FalJobState,
	decision: "accept" | "deny",
): ReturnType<typeof toToolResult> {
	if (job.reviewRequired !== true || job.reviewState !== "pending") {
		throw new Error(
			`Job ${job.jobId} is not waiting for review. Current reviewState=${job.reviewState || "none"}.`,
		);
	}

	if (decision === "deny") {
		for (const media of job.media) {
			if (!media.path) continue;
			try {
				unlinkSync(media.path);
			} catch {
				// ignore cleanup failures
			}
		}
		try {
			rmSync(join(PENDING_DIR, job.jobId), { recursive: true, force: true });
		} catch {
			// ignore
		}
		const denied = saveJobState({
			...job,
			status: "denied",
			reviewState: "denied",
			media: job.media.map((entry) => ({ ...entry, path: null })),
		});
		return toToolResult(denied);
	}

	const acceptedMedia = job.media.map((entry) => {
		if (!entry.path) return entry;
		const targetDir = resolveFinalOutputDir(entry.modality);
		const targetPath = join(targetDir, basename(entry.path));
		moveFile(entry.path, targetPath);
		return {
			...entry,
			path: targetPath,
		};
	});
	try {
		rmSync(join(PENDING_DIR, job.jobId), { recursive: true, force: true });
	} catch {
		// ignore
	}
	const accepted = saveJobState({
		...job,
		status: "completed",
		reviewState: "accepted",
		media: acceptedMedia,
	});
	return toToolResult(accepted);
}

function moveFile(sourcePath: string, targetPath: string): void {
	try {
		renameSync(sourcePath, targetPath);
		return;
	} catch {
		copyFileSync(sourcePath, targetPath);
		unlinkSync(sourcePath);
	}
}

function extractMediaCandidates(
	payload: unknown,
	fallbackModality: MediaModality,
): MediaCandidate[] {
	const output: MediaCandidate[] = [];
	const seen = new Set<string>();

	const walk = (
		value: unknown,
		path: string[],
		parent: Record<string, unknown> | null,
	): void => {
		if (!value) return;
		if (Array.isArray(value)) {
			for (const item of value) {
				walk(item, path, parent);
			}
			return;
		}
		if (typeof value === "string") {
			const trimmed = value.trim();
			if (!/^https?:\/\//i.test(trimmed)) return;
			if (seen.has(trimmed)) return;
			const hint = path[path.length - 1] || "";
			const mimeType = inferMimeTypeFromContext(trimmed, parent);
			if (!looksLikeMediaCandidate(trimmed, hint, mimeType)) {
				return;
			}
			seen.add(trimmed);
			output.push({
				url: trimmed,
				mimeType,
				modality: inferModalityFromHint(hint, mimeType, fallbackModality),
				label: buildCandidateLabel(path),
			});
			return;
		}
		if (typeof value !== "object") return;

		const record = value as Record<string, unknown>;
		for (const [key, nested] of Object.entries(record)) {
			walk(nested, [...path, key], record);
		}
	};

	walk(payload, [], null);
	return output;
}

function looksLikeMediaCandidate(
	url: string,
	hint: string,
	mimeType?: string,
): boolean {
	if (mimeType) {
		if (
			mimeType.startsWith("image/") ||
			mimeType.startsWith("audio/") ||
			mimeType.startsWith("video/")
		) {
			return true;
		}
	}

	const normalizedHint = hint.toLowerCase();
	for (const fragment of [
		"image",
		"audio",
		"music",
		"video",
		"file",
		"media",
	]) {
		if (normalizedHint.includes(fragment)) return true;
	}

	const extension = extensionFromUrl(url).toLowerCase();
	return Boolean(mimeTypeFromExtension(extension));
}

function buildCandidateLabel(path: string[]): string | undefined {
	if (path.length === 0) return undefined;
	return sanitizeName(path.join("-")) || undefined;
}

function inferMimeTypeFromContext(
	url: string,
	parent: Record<string, unknown> | null,
): string | undefined {
	if (parent) {
		for (const key of [
			"mime_type",
			"mimeType",
			"content_type",
			"contentType",
		]) {
			const value = parent[key];
			if (typeof value === "string" && value.trim()) {
				return normalizeMimeType(value);
			}
		}
	}

	const extension = extensionFromUrl(url);
	if (!extension) return undefined;
	return mimeTypeFromExtension(extension) || undefined;
}

function inferModalityFromHint(
	hint: string,
	mimeType: string | undefined,
	fallback: MediaModality,
): MediaModality {
	const normalizedHint = hint.toLowerCase();
	if (mimeType) {
		if (mimeType.startsWith("image/")) return "image";
		if (mimeType.startsWith("audio/")) return "audio";
		if (mimeType.startsWith("video/")) return "video";
	}
	if (normalizedHint.includes("image")) return "image";
	if (normalizedHint.includes("audio") || normalizedHint.includes("music")) {
		return "audio";
	}
	if (normalizedHint.includes("video")) return "video";
	return fallback;
}

function classifyModality(
	candidate: MediaCandidate,
	mimeType: string,
): MediaModality {
	if (mimeType.startsWith("image/")) return "image";
	if (mimeType.startsWith("audio/")) return "audio";
	if (mimeType.startsWith("video/")) return "video";
	return candidate.modality;
}

async function downloadRemoteFile(
	url: string,
): Promise<{ bytes: Buffer; mimeType: string }> {
	const response = await fetchWithTimeout(url, {
		method: "GET",
		headers: {
			"User-Agent": "wingman-mcp-fal-ai",
		},
	});
	if (!response.ok) {
		throw new Error(`Failed to download media (${response.status}): ${url}`);
	}
	const mimeType = normalizeMimeType(
		response.headers.get("content-type") || "",
	);
	const arrayBuffer = await response.arrayBuffer();
	const bytes = Buffer.from(arrayBuffer);
	if (bytes.length === 0) {
		throw new Error(`Downloaded media is empty: ${url}`);
	}
	return {
		bytes,
		mimeType,
	};
}

function parseBase64DataUrl(
	dataUrl: string,
): { mimeType: string; data: string } | null {
	const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/i);
	if (!match) return null;
	return {
		mimeType: normalizeMimeType(match[1]),
		data: match[2].trim(),
	};
}

function extensionFromUrl(url: string): string {
	try {
		const parsed = new URL(url);
		const extension = extname(parsed.pathname || "")
			.replace(/^\./, "")
			.toLowerCase();
		return extension;
	} catch {
		return "";
	}
}

function normalizeMimeType(raw: string): string {
	return raw.split(";")[0]?.trim().toLowerCase() || "";
}

function mimeTypeFromExtension(extension: string): string | null {
	switch (extension.replace(/^\./, "").toLowerCase()) {
		case "png":
			return "image/png";
		case "jpg":
		case "jpeg":
			return "image/jpeg";
		case "webp":
			return "image/webp";
		case "gif":
			return "image/gif";
		case "bmp":
			return "image/bmp";
		case "tif":
		case "tiff":
			return "image/tiff";
		case "avif":
			return "image/avif";
		case "mp3":
			return "audio/mpeg";
		case "wav":
			return "audio/wav";
		case "ogg":
			return "audio/ogg";
		case "m4a":
			return "audio/mp4";
		case "webm":
			return "video/webm";
		case "mp4":
			return "video/mp4";
		case "mov":
			return "video/quicktime";
		default:
			return null;
	}
}

function mimeTypeFromPath(pathname: string): string | null {
	return mimeTypeFromExtension(extname(pathname).replace(/^\./, ""));
}

function extensionFromMimeType(mimeType: string): string {
	switch (normalizeMimeType(mimeType)) {
		case "image/jpeg":
			return "jpg";
		case "image/png":
			return "png";
		case "image/webp":
			return "webp";
		case "image/gif":
			return "gif";
		case "image/bmp":
			return "bmp";
		case "image/tiff":
			return "tiff";
		case "image/avif":
			return "avif";
		case "audio/mpeg":
			return "mp3";
		case "audio/wav":
			return "wav";
		case "audio/ogg":
			return "ogg";
		case "audio/mp4":
			return "m4a";
		case "video/mp4":
			return "mp4";
		case "video/webm":
			return "webm";
		case "video/quicktime":
			return "mov";
		default: {
			const subtype = normalizeMimeType(mimeType).split("/")[1] || "";
			const sanitized = subtype.replace(/[^a-z0-9]/g, "");
			return sanitized || "bin";
		}
	}
}

function sanitizeName(value: string): string {
	const normalized = (value || "").trim().toLowerCase();
	const sanitized = normalized
		.replace(/[^a-z0-9._-]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return sanitized.slice(0, 80) || "asset";
}

function toGatewayFileUrl(pathname: string): string {
	return `/api/fs/file?path=${encodeURIComponent(pathname)}`;
}

function buildStructuredImages(media: StoredMedia[]) {
	return media
		.filter((entry) => entry.modality === "image")
		.map((entry) => ({
			path: entry.path,
			url: entry.path ? toGatewayFileUrl(entry.path) : entry.remoteUrl,
			mimeType: entry.mimeType,
			name: entry.name,
		}));
}

function toToolResult(job: FalJobState) {
	const summary = buildFalGenerationSummary({
		toolName: job.toolName,
		jobId: job.jobId,
		status: job.status,
		modelId: job.modelId,
		reviewState: job.reviewState,
		media: job.media.map((entry) => ({
			modality: entry.modality,
			path: entry.path,
			remoteUrl: entry.remoteUrl,
			mimeType: entry.mimeType,
		})),
		error: job.error,
		cwd: FAL_WORKDIR,
	});

	const content: ContentBlock[] = [
		{ type: "text", text: summary } satisfies TextContent,
	];

	for (const media of job.media) {
		if (media.modality === "image" && media.path) {
			try {
				const bytes = readFileSync(media.path);
				if (bytes.length > 0 && bytes.length <= 5 * 1024 * 1024) {
					content.push({
						type: "image",
						data: bytes.toString("base64"),
						mimeType: media.mimeType || "image/png",
					} satisfies ImageContent);
				}
			} catch {
				// ignore image inline preview failures
			}
		}
	}

	return {
		content,
		structuredContent: {
			jobId: job.jobId,
			requestId: job.requestId,
			toolName: job.toolName,
			modelId: job.modelId,
			modality: job.modality,
			status: job.status,
			reviewRequired: job.reviewRequired,
			reviewState: job.reviewState,
			error: job.error,
			submittedAt: job.submittedAt,
			updatedAt: job.updatedAt,
			queueStatus: job.queueStatus,
			queueStatusUrl: job.queueStatusUrl,
			queueResponseUrl: job.queueResponseUrl,
			queueCancelUrl: job.queueCancelUrl,
			logs: job.logs,
			images: buildStructuredImages(job.media),
			media: job.media.map((entry) => ({
				id: entry.id,
				modality: entry.modality,
				mimeType: entry.mimeType,
				name: entry.name,
				path: entry.path,
				url: entry.path ? toGatewayFileUrl(entry.path) : entry.remoteUrl,
				remoteUrl: entry.remoteUrl,
				sizeBytes: entry.sizeBytes,
				createdAt: entry.createdAt,
			})),
		},
	};
}

async function fetchWithTimeout(
	url: string,
	init: RequestInit,
	timeoutMs = FAL_HTTP_TIMEOUT_MS,
): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(
		() => controller.abort(),
		Math.max(1000, timeoutMs),
	);
	try {
		return await fetch(url, {
			...init,
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timeout);
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorToString(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	try {
		return JSON.stringify(error);
	} catch {
		return String(error);
	}
}

mkdirSync(FAL_STATE_DIR, { recursive: true });
mkdirSync(FAL_OUTPUT_DIR, { recursive: true });
mkdirSync(JOBS_DIR, { recursive: true });
mkdirSync(PENDING_DIR, { recursive: true });

const transport = new StdioServerTransport();
await server.connect(transport);

console.error(
	[
		"wingman-mcp-fal-ai ready",
		`workdir=${FAL_WORKDIR}`,
		`stateDir=${FAL_STATE_DIR}`,
		`outputDir=${FAL_OUTPUT_DIR}`,
		`reviewMode=${FAL_REVIEW_MODE}`,
		`defaultImageModel=${FAL_MODELS.imageOrTexture}`,
	].join(" | "),
);
