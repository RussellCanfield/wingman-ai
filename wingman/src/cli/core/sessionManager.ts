import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { createDeepAgent } from "deepagents";
import { v4 as uuidv4 } from "uuid";

type DatabaseLike = {
	prepare: (sql: string) => {
		get: (...params: any[]) => any;
		all: (...params: any[]) => any[];
		run: (...params: any[]) => any;
	};
	run: (sql: string, ...params: any[]) => any;
	close: () => void;
};

const isBunRuntime = typeof (globalThis as any).Bun !== "undefined";

export interface Session {
	id: string;
	name: string;
	agentName: string;
	createdAt: Date;
	updatedAt: Date;
	status: "active" | "archived" | "deleted";
	messageCount: number;
	lastMessagePreview?: string;
	metadata?: Record<string, any>;
}

export interface ListSessionsOptions {
	status?: "active" | "archived" | "deleted";
	limit?: number;
	offset?: number;
	agentName?: string;
}

export interface SessionMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	attachments?: SessionAttachment[];
	createdAt: number;
}

export interface SessionAttachment {
	kind: "image" | "audio";
	dataUrl: string;
	name?: string;
	mimeType?: string;
	size?: number;
}

type CheckpointRow = {
	checkpoint?: string | Uint8Array;
};

/**
 * SessionManager handles session metadata and provides unified access to
 * both the custom sessions table and LangGraph's SqliteSaver checkpointer.
 */
export class SessionManager {
	private checkpointer: SqliteSaver | null = null;
	private stateReaderAgent: ReturnType<typeof createDeepAgent> | null = null;
	private db: DatabaseLike | null = null;
	private dbPath: string;

	constructor(dbPath: string) {
		this.dbPath = dbPath;
	}

	/**
	 * Initialize the SessionManager with SqliteSaver and create custom tables
	 */
	async initialize(): Promise<void> {
		if (!isBunRuntime) {
			throw new Error(
				"SessionManager requires Bun runtime (bun:sqlite not available)",
			);
		}

		const { BunSqliteAdapter } = await import(
			"./database/bunSqliteAdapter.js"
		);

		// Create native bun:sqlite database via adapter
		const adapter = new BunSqliteAdapter(this.dbPath);

		// Create SqliteSaver directly with the adapter
		// Note: SqliteSaver expects a better-sqlite3 Database instance
		// Our adapter provides the same API surface
		this.checkpointer = new SqliteSaver(adapter as any);

		// Initialize checkpoint tables (setup is protected but necessary)
		// @ts-ignore - We need to call setup() to create checkpoint tables
		await this.checkpointer.setup();

		// Store native database reference for direct queries
		// Access the actual bun:sqlite database through the adapter
		this.db = adapter.db as DatabaseLike;

		// Create custom sessions table for UI/metadata
		this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        message_count INTEGER DEFAULT 0,
        last_message_preview TEXT,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent_name);
    `);
	}

	/**
	 * Create a new session
	 */
	createSession(agentName: string, name?: string): Session {
		if (!this.db) {
			throw new Error("SessionManager not initialized");
		}

		const id = uuidv4();
		const now = Date.now();
		const sessionName = name || `Session ${new Date().toLocaleString()}`;

		const stmt = this.db.prepare(`
      INSERT INTO sessions (id, name, agent_name, created_at, updated_at, status, message_count)
      VALUES (?, ?, ?, ?, ?, 'active', 0)
    `);

		stmt.run(id, sessionName, agentName, now, now);

		return {
			id,
			name: sessionName,
			agentName,
			createdAt: new Date(now),
			updatedAt: new Date(now),
			status: "active",
			messageCount: 0,
		};
	}

	/**
	 * Get or create a session with a fixed ID
	 */
	getOrCreateSession(sessionId: string, agentName: string, name?: string): Session {
		if (!this.db) {
			throw new Error("SessionManager not initialized");
		}

		const existing = this.getSession(sessionId);
		if (existing) {
			return existing;
		}

		const now = Date.now();
		const sessionName = name || `Session ${new Date().toLocaleString()}`;

		const stmt = this.db.prepare(`
      INSERT INTO sessions (id, name, agent_name, created_at, updated_at, status, message_count)
      VALUES (?, ?, ?, ?, ?, 'active', 0)
    `);

		stmt.run(sessionId, sessionName, agentName, now, now);

		return {
			id: sessionId,
			name: sessionName,
			agentName,
			createdAt: new Date(now),
			updatedAt: new Date(now),
			status: "active",
			messageCount: 0,
		};
	}

	/**
	 * Get a session by ID
	 */
	getSession(sessionId: string): Session | null {
		if (!this.db) {
			throw new Error("SessionManager not initialized");
		}

		const stmt = this.db.prepare(`
      SELECT * FROM sessions WHERE id = ?
    `);

		const row = stmt.get(sessionId) as any;

		if (!row) {
			return null;
		}

		return this.rowToSession(row);
	}

	/**
	 * Get the most recently updated session
	 */
	getLastSession(): Session | null {
		if (!this.db) {
			throw new Error("SessionManager not initialized");
		}

		const stmt = this.db.prepare(`
      SELECT * FROM sessions
      WHERE status = 'active'
      ORDER BY updated_at DESC
      LIMIT 1
    `);

		const row = stmt.get() as any;

		if (!row) {
			return null;
		}

		return this.rowToSession(row);
	}

	/**
	 * List sessions with optional filtering
	 */
	listSessions(options: ListSessionsOptions = {}): Session[] {
		if (!this.db) {
			throw new Error("SessionManager not initialized");
		}

		const {
			status = "active",
			limit = 10,
			offset = 0,
			agentName,
		} = options;

		let query = `
      SELECT * FROM sessions
      WHERE status = ?
    `;
		const params: any[] = [status];

		if (agentName) {
			query += " AND agent_name = ?";
			params.push(agentName);
		}

		query += " ORDER BY updated_at DESC LIMIT ? OFFSET ?";
		params.push(limit, offset);

		const stmt = this.db.prepare(query);
		const rows = stmt.all(...params) as any[];

		return rows.map(this.rowToSession);
	}

	/**
	 * Update a session's metadata
	 */
	updateSession(
		sessionId: string,
		updates: Partial<
			Pick<Session, "name" | "status" | "messageCount" | "lastMessagePreview">
		>,
	): void {
		if (!this.db) {
			throw new Error("SessionManager not initialized");
		}

		const fields: string[] = [];
		const values: any[] = [];

		if (updates.name !== undefined) {
			fields.push("name = ?");
			values.push(updates.name);
		}

		if (updates.status !== undefined) {
			fields.push("status = ?");
			values.push(updates.status);
		}

		if (updates.messageCount !== undefined) {
			fields.push("message_count = ?");
			values.push(updates.messageCount);
		}

		if (updates.lastMessagePreview !== undefined) {
			fields.push("last_message_preview = ?");
			values.push(updates.lastMessagePreview);
		}

		// Always update updated_at
		fields.push("updated_at = ?");
		values.push(Date.now());

		values.push(sessionId);

		const stmt = this.db.prepare(`
      UPDATE sessions
      SET ${fields.join(", ")}
      WHERE id = ?
    `);

		stmt.run(...values);
	}

	/**
	 * Merge and update session metadata
	 */
	updateSessionMetadata(
		sessionId: string,
		metadata: Record<string, any>,
	): void {
		if (!this.db) {
			throw new Error("SessionManager not initialized");
		}

		const existing = this.getSession(sessionId);
		const nextMetadata = {
			...(existing?.metadata || {}),
			...metadata,
		};

		const stmt = this.db.prepare(`
      UPDATE sessions
      SET metadata = ?, updated_at = ?
      WHERE id = ?
    `);

		stmt.run(JSON.stringify(nextMetadata), Date.now(), sessionId);
	}

	/**
	 * Archive a session (soft delete)
	 */
	archiveSession(sessionId: string): void {
		this.updateSession(sessionId, { status: "archived" });
	}

	/**
	 * Delete a session (hard delete from database)
	 */
	deleteSession(sessionId: string): void {
		if (!this.db || !this.checkpointer) {
			throw new Error("SessionManager not initialized");
		}

		// Delete from sessions table
		const sessionStmt = this.db.prepare("DELETE FROM sessions WHERE id = ?");
		sessionStmt.run(sessionId);

		// Delete checkpoints for this thread_id
		const checkpointStmt = this.db.prepare(
			"DELETE FROM checkpoints WHERE thread_id = ?",
		);
		checkpointStmt.run(sessionId);

		// Note: The table is named 'writes' in newer versions of @langchain/langgraph-checkpoint-sqlite
		const writesStmt = this.db.prepare(
			"DELETE FROM writes WHERE thread_id = ?",
		);
		writesStmt.run(sessionId);
	}

	/**
	 * Clear session messages while preserving the session record
	 */
	clearSessionMessages(sessionId: string): void {
		if (!this.db || !this.checkpointer) {
			throw new Error("SessionManager not initialized");
		}

		const checkpointStmt = this.db.prepare(
			"DELETE FROM checkpoints WHERE thread_id = ?",
		);
		checkpointStmt.run(sessionId);

		const writesStmt = this.db.prepare(
			"DELETE FROM writes WHERE thread_id = ?",
		);
		writesStmt.run(sessionId);

		const sessionStmt = this.db.prepare(`
      UPDATE sessions
      SET message_count = 0, last_message_preview = NULL, updated_at = ?
      WHERE id = ?
    `);
		sessionStmt.run(Date.now(), sessionId);
	}

	/**
	 * Get the checkpointer for use with DeepAgents
	 */
	getCheckpointer(): SqliteSaver {
		if (!this.checkpointer) {
			throw new Error("SessionManager not initialized");
		}
		return this.checkpointer;
	}

	/**
	 * List messages for a session by reading the latest checkpoint.
	 */
	async listMessages(sessionId: string): Promise<SessionMessage[]> {
		if (!this.checkpointer) {
			throw new Error("SessionManager not initialized");
		}

		const stateMessages = await this.loadMessagesFromState(sessionId);
		if (stateMessages !== null) {
			return stateMessages;
		}

		const rawCheckpoints = this.loadRecentCheckpoints(sessionId, 25);
		const fallbackTuple =
			rawCheckpoints.length === 0
				? await this.checkpointer.getTuple({
						configurable: { thread_id: sessionId },
					})
				: null;

		const checkpoints = [
			...rawCheckpoints,
			...(fallbackTuple?.checkpoint ? [fallbackTuple.checkpoint as any] : []),
		];
		if (checkpoints.length === 0) return [];

		let bestScore = -1;
		let bestMessages: SessionMessage[] = [];

		for (const checkpoint of checkpoints) {
			const channelValues =
				checkpoint?.channel_values ||
				checkpoint?.channelValues ||
				checkpoint?.state?.channel_values ||
				checkpoint?.state?.channelValues ||
				{};

			const candidates: any[][] = [];
			if (Array.isArray(channelValues?.messages)) {
				candidates.push(channelValues.messages);
			}
			for (const value of Object.values(channelValues)) {
				if (Array.isArray(value)) {
					candidates.push(value);
				}
			}

			const relevantCandidates = candidates.filter((arr) =>
				arr.some(isMessageLike),
			);
			if (relevantCandidates.length === 0) continue;

			const baseTime = parseTimestamp(checkpoint?.ts);
			const scored = relevantCandidates.map((candidate) =>
				scoreMessages(candidate, baseTime),
			);
			scored.sort((a, b) => b.score - a.score);

			if (scored[0] && scored[0].score > bestScore) {
				bestScore = scored[0].score;
				bestMessages = scored[0].messages;
			}
		}

		if (bestMessages.length === 0) return [];

		return filterEmptyAssistantMessages(bestMessages);
	}

	/**
	 * Convert database row to Session object
	 */
	private rowToSession(row: any): Session {
		return {
			id: row.id,
			name: row.name,
			agentName: row.agent_name,
			createdAt: new Date(row.created_at),
			updatedAt: new Date(row.updated_at),
			status: row.status,
			messageCount: row.message_count,
			lastMessagePreview: row.last_message_preview,
			metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
		};
	}

	/**
	 * Close the database connection
	 */
	close(): void {
		if (this.db) {
			this.db.close();
		}
	}

	private loadRecentCheckpoints(sessionId: string, limit: number): any[] {
		if (!this.db) return [];
		const stmt = this.db.prepare(`
      SELECT checkpoint
      FROM checkpoints
      WHERE thread_id = ?
      ORDER BY rowid DESC
      LIMIT ?
    `);
		const rows = stmt.all(sessionId, limit) as CheckpointRow[];
		const checkpoints: any[] = [];

		for (const row of rows) {
			if (!row?.checkpoint) continue;
			const raw = row.checkpoint;
			let text: string | null = null;
			if (typeof raw === "string") {
				text = raw;
			} else if (raw instanceof Uint8Array) {
				text = new TextDecoder().decode(raw);
			}

			if (!text) continue;
			try {
				checkpoints.push(JSON.parse(text));
			} catch {
				continue;
			}
		}

		return checkpoints;
	}

	private getStateReaderAgent(): ReturnType<typeof createDeepAgent> {
		if (!this.checkpointer) {
			throw new Error("SessionManager not initialized");
		}

		if (!this.stateReaderAgent) {
			this.stateReaderAgent = createDeepAgent({
				checkpointer: this.checkpointer as any,
			}) as ReturnType<typeof createDeepAgent>;
		}

		return this.stateReaderAgent;
	}

	private async loadMessagesFromState(
		sessionId: string,
	): Promise<SessionMessage[] | null> {
		if (!this.checkpointer) return null;

		try {
			const agent = this.getStateReaderAgent() as any;
			if (typeof agent.getState !== "function") {
				return null;
			}

			const state = await agent.getState({
				configurable: { thread_id: sessionId },
			});

			return extractMessagesFromState(state);
		} catch {
			return null;
		}
	}
}

function isMessageLike(entry: any): boolean {
	if (!entry || typeof entry !== "object") return false;
	return (
		typeof entry.role === "string" ||
		typeof entry.type === "string" ||
		typeof entry?.kwargs?.role === "string" ||
		typeof entry?.additional_kwargs?.role === "string"
	);
}

function toSessionMessage(
	entry: any,
	index: number,
	baseTime: number,
): SessionMessage | null {
	if (!entry || typeof entry !== "object") return null;
	if (entry?.additional_kwargs?.ui_hidden || entry?.additional_kwargs?.uiHidden) {
		return null;
	}
	if (entry?.metadata?.ui_hidden || entry?.metadata?.uiHidden) {
		return null;
	}

	const role = resolveMessageRole(entry);

	if (role !== "user" && role !== "assistant") {
		return null;
	}

	const blocks = extractContentBlocks(entry);
	const content =
		typeof entry.content === "string"
			? entry.content
			: typeof entry?.kwargs?.content === "string"
				? entry.kwargs.content
				: typeof entry?.additional_kwargs?.content === "string"
					? entry.additional_kwargs.content
					: typeof entry?.data?.content === "string"
						? entry.data.content
						: blocks.length > 0
							? blocks
									.filter((block: any) => block && block.type === "text" && block.text)
									.map((block: any) => block.text)
									.join("")
							: "";

	if (role === "user" && isUiHiddenContent(content)) {
		return null;
	}

	const attachments = extractAttachments(blocks);

	return {
		id: `msg-${index}`,
		role,
		content,
		attachments: attachments.length > 0 ? attachments : undefined,
		createdAt: baseTime + index,
	};
}

export function extractMessagesFromState(
	state: any,
): SessionMessage[] | null {
	if (!state || typeof state !== "object") return null;

	const values = state?.values ?? state?.value ?? state?.state ?? {};
	const candidates = [
		values?.messages,
		values?.channel_values?.messages,
		values?.channelValues?.messages,
		state?.channel_values?.messages,
		state?.channelValues?.messages,
	];
	const messages = candidates.find((candidate) =>
		Array.isArray(candidate),
	) as any[] | undefined;

	if (!messages) {
		return null;
	}

	const baseTime = parseTimestamp(
		state?.createdAt ??
			values?.createdAt ??
			state?.metadata?.createdAt ??
			state?.metadata?.created_at ??
			state?.ts,
	);

	const mapped = messages
		.map((message, index) => toSessionMessage(message, index, baseTime))
		.filter(Boolean) as SessionMessage[];

	return filterEmptyAssistantMessages(mapped);
}

function extractContentBlocks(entry: any): any[] {
	if (!entry || typeof entry !== "object") return [];
	const candidates = [
		entry?.content,
		entry?.kwargs?.content,
		entry?.additional_kwargs?.content,
		entry?.data?.content,
	];
	for (const candidate of candidates) {
		if (Array.isArray(candidate)) {
			return candidate;
		}
	}
	return [];
}

export function extractAttachments(blocks: any[]): SessionAttachment[] {
	const attachments: SessionAttachment[] = [];
	for (const block of blocks) {
		if (!block || typeof block !== "object") continue;
		const imageUrl = extractImageUrl(block);
		if (imageUrl) {
			attachments.push({
				kind: "image",
				dataUrl: imageUrl,
			});
			continue;
		}
		const audioUrl = extractAudioUrl(block);
		if (!audioUrl) continue;
		attachments.push({
			kind: "audio",
			dataUrl: audioUrl,
		});
	}
	return attachments;
}

export function extractImageAttachments(blocks: any[]): SessionAttachment[] {
	return extractAttachments(blocks).filter((attachment) => attachment.kind === "image");
}

export function extractImageUrl(block: any): string | null {
	if (block.type === "image_url") {
		if (typeof block.image_url === "string") return block.image_url;
		if (typeof block.image_url?.url === "string") return block.image_url.url;
	}
	if (block.type === "input_image") {
		if (typeof block.image_url === "string") return block.image_url;
		if (typeof block.image_url?.url === "string") return block.image_url.url;
		if (typeof block.url === "string") return block.url;
	}
	if (block.type === "image" && block.source) {
		const mediaType = block.source.media_type || block.source.mediaType;
		const data = block.source.data;
		if (mediaType && data) {
			return `data:${mediaType};base64,${data}`;
		}
	}
	return null;
}

function extractAudioUrl(block: any): string | null {
	if (block.type === "audio_url") {
		if (typeof block.audio_url === "string") return block.audio_url;
		if (typeof block.audio_url?.url === "string") return block.audio_url.url;
	}
	if (block.type === "input_audio") {
		const input = block.input_audio || block.audio;
		const data = typeof input?.data === "string" ? input.data : null;
		const format =
			typeof input?.format === "string" ? input.format : undefined;
		if (data) {
			const mimeType = format ? resolveAudioMimeType(format) : "audio/wav";
			return `data:${mimeType};base64,${data}`;
		}
	}
	if (block.type === "audio" && block.source) {
		const mediaType = block.source.media_type || block.source.mediaType;
		const data = block.source.data;
		if (mediaType && data) {
			return `data:${mediaType};base64,${data}`;
		}
	}
	return null;
}

function resolveAudioMimeType(format: string): string {
	const normalized = format.toLowerCase();
	switch (normalized) {
		case "mp3":
		case "mpeg":
			return "audio/mpeg";
		case "wav":
			return "audio/wav";
		case "m4a":
		case "mp4":
			return "audio/mp4";
		case "ogg":
			return "audio/ogg";
		case "webm":
			return "audio/webm";
		default:
			return `audio/${normalized}`;
	}
}

function mapMessageType(type?: string): "user" | "assistant" | null {
	if (!type) return null;
	if (type === "human" || type === "user") return "user";
	if (type === "ai" || type === "assistant") return "assistant";
	return null;
}

function mapMessageTypeFromId(id?: unknown): "user" | "assistant" | null {
	if (!Array.isArray(id) || id.length === 0) return null;
	const last = String(id[id.length - 1] || "").toLowerCase();
	if (last.includes("human") || last.includes("user")) return "user";
	if (last.includes("ai") || last.includes("assistant")) return "assistant";
	return null;
}

export function resolveMessageRole(entry: any): "user" | "assistant" | null {
	return (
		(entry?.role as string | undefined) ||
		(entry?.kwargs?.role as string | undefined) ||
		(entry?.additional_kwargs?.role as string | undefined) ||
		mapMessageType(entry?.type as string | undefined) ||
		mapMessageTypeFromId(entry?.id ?? entry?.lc_id ?? entry?.kwargs?.id)
	) as "user" | "assistant" | null;
}

function parseTimestamp(value?: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string") {
		const parsed = Date.parse(value);
		if (!Number.isNaN(parsed)) {
			return parsed;
		}
	}
	return Date.now();
}

function isUiHiddenContent(content: string): boolean {
	if (!content) return false;
	return (
		content.includes("Current Date Time (UTC):") ||
		content.startsWith("# User's Machine Information")
	);
}

function scoreMessages(candidate: any[], baseTime: number): {
	score: number;
	messages: SessionMessage[];
} {
	const messages = candidate
		.map((message, index) => toSessionMessage(message, index, baseTime))
		.filter(Boolean) as SessionMessage[];
	const contentful = messages.filter(
		(msg) => msg.content.trim().length > 0 || (msg.attachments?.length ?? 0) > 0,
	).length;
	const assistantContentful = messages.filter(
		(msg) => msg.role === "assistant" && msg.content.trim().length > 0,
	).length;
	const score = assistantContentful * 3 + contentful * 2 + messages.length;
	return { score, messages };
}

function filterEmptyAssistantMessages(
	messages: SessionMessage[],
): SessionMessage[] {
	const filtered = messages.filter(
		(message) =>
			message.role !== "assistant" ||
			message.content.trim().length > 0 ||
			(message.attachments?.length ?? 0) > 0,
	);
	return filtered.length > 0 ? filtered : messages;
}
