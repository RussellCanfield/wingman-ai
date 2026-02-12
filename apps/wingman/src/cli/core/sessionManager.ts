import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { createDeepAgent } from "deepagents";
import { v4 as uuidv4 } from "uuid";
import { persistAssistantImagesToDisk } from "./imagePersistence.js";

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
	uiBlocks?: Array<{
		spec: unknown;
		uiOnly?: boolean;
		textFallback?: string;
	}>;
	uiTextFallback?: string;
}

export interface SessionAttachment {
	kind: "image" | "audio" | "file";
	dataUrl: string;
	name?: string;
	mimeType?: string;
	size?: number;
	path?: string;
}

type CheckpointRow = {
	checkpoint?: string | Uint8Array;
};

type PendingMessageRow = {
	id: string;
	role: "user" | "assistant";
	content: string;
	attachments: string | null;
	created_at: number;
};

/**
 * SessionManager handles session metadata and provides unified access to
 * both the custom sessions table and LangGraph's SqliteSaver checkpointer.
 */
export class SessionManager {
	private checkpointer: SqliteSaver | null = null;
	private stateReaderAgent: { getState?: (args: any) => Promise<any> } | null =
		null;
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

		const { BunSqliteAdapter } = await import("./database/bunSqliteAdapter.js");

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
	      CREATE INDEX IF NOT EXISTS idx_sessions_status_updated ON sessions(status, updated_at DESC);
	      CREATE INDEX IF NOT EXISTS idx_sessions_status_agent_updated ON sessions(status, agent_name, updated_at DESC);

	      CREATE TABLE IF NOT EXISTS session_pending_messages (
	        id TEXT PRIMARY KEY,
	        session_id TEXT NOT NULL,
	        request_id TEXT NOT NULL,
	        role TEXT NOT NULL,
	        content TEXT NOT NULL,
	        attachments TEXT,
	        created_at INTEGER NOT NULL
	      );

	      CREATE INDEX IF NOT EXISTS idx_pending_messages_session_created ON session_pending_messages(session_id, created_at ASC);
	      CREATE INDEX IF NOT EXISTS idx_pending_messages_session_request ON session_pending_messages(session_id, request_id);
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
	getOrCreateSession(
		sessionId: string,
		agentName: string,
		name?: string,
	): Session {
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

		const { status = "active", limit = 10, offset = 0, agentName } = options;

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

		const pendingStmt = this.db.prepare(
			"DELETE FROM session_pending_messages WHERE session_id = ?",
		);
		pendingStmt.run(sessionId);
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

		const pendingStmt = this.db.prepare(
			"DELETE FROM session_pending_messages WHERE session_id = ?",
		);
		pendingStmt.run(sessionId);

		const sessionStmt = this.db.prepare(`
	      UPDATE sessions
	      SET message_count = 0, last_message_preview = NULL, updated_at = ?
	      WHERE id = ?
	    `);
		sessionStmt.run(Date.now(), sessionId);
	}

	persistPendingMessage(input: {
		sessionId: string;
		requestId: string;
		message: SessionMessage;
	}): void {
		if (!this.db) {
			throw new Error("SessionManager not initialized");
		}

		const attachments =
			Array.isArray(input.message.attachments) && input.message.attachments.length > 0
				? JSON.stringify(input.message.attachments)
				: null;
		const stmt = this.db.prepare(`
	      INSERT INTO session_pending_messages (
	        id, session_id, request_id, role, content, attachments, created_at
	      )
	      VALUES (?, ?, ?, ?, ?, ?, ?)
	      ON CONFLICT(id) DO UPDATE SET
	        role = excluded.role,
	        content = excluded.content,
	        attachments = excluded.attachments,
	        created_at = excluded.created_at
	    `);
		stmt.run(
			input.message.id,
			input.sessionId,
			input.requestId,
			input.message.role,
			input.message.content || "",
			attachments,
			input.message.createdAt,
		);
	}

	clearPendingMessagesForRequest(sessionId: string, requestId: string): void {
		if (!this.db) {
			throw new Error("SessionManager not initialized");
		}
		const stmt = this.db.prepare(`
	      DELETE FROM session_pending_messages
	      WHERE session_id = ? AND request_id = ?
	    `);
		stmt.run(sessionId, requestId);
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

		const pendingMessages = this.listPendingMessages(sessionId);
		const stateMessages = await this.loadMessagesFromState(sessionId);
		if (stateMessages !== null) {
			const mergedStateMessages = mergePendingMessages(
				stateMessages,
				pendingMessages,
			);
			this.persistAssistantImageAttachments(sessionId, mergedStateMessages);
			return mergedStateMessages;
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
		if (checkpoints.length === 0) {
			this.persistAssistantImageAttachments(sessionId, pendingMessages);
			return pendingMessages;
		}

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

		if (bestMessages.length === 0) {
			this.persistAssistantImageAttachments(sessionId, pendingMessages);
			return pendingMessages;
		}

		const filteredMessages = filterEmptyAssistantMessages(bestMessages);
		const mergedMessages = mergePendingMessages(
			filteredMessages,
			pendingMessages,
		);
		this.persistAssistantImageAttachments(sessionId, mergedMessages);
		return mergedMessages;
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

	private getStateReaderAgent(): { getState?: (args: any) => Promise<any> } {
		if (!this.checkpointer) {
			throw new Error("SessionManager not initialized");
		}

		if (!this.stateReaderAgent) {
			this.stateReaderAgent = createDeepAgent({
				checkpointer: this.checkpointer as any,
			}) as { getState?: (args: any) => Promise<any> };
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

	private persistAssistantImageAttachments(
		sessionId: string,
		messages: SessionMessage[],
	): void {
		try {
			persistAssistantImagesToDisk({
				dbPath: this.dbPath,
				sessionId,
				messages: messages as Array<{
					role: "user" | "assistant";
					attachments?: Array<{
						kind: "image" | "audio" | "file";
						dataUrl: string;
						mimeType?: string;
						name?: string;
						size?: number;
						path?: string;
					}>;
				}>,
			});
		} catch {
			// Non-fatal: sessions should still load even if image materialization fails.
		}
	}

	private listPendingMessages(sessionId: string): SessionMessage[] {
		if (!this.db) return [];
		const stmt = this.db.prepare(`
	      SELECT id, role, content, attachments, created_at
	      FROM session_pending_messages
	      WHERE session_id = ?
	      ORDER BY created_at ASC, rowid ASC
	    `);
		const rows = stmt.all(sessionId) as PendingMessageRow[];
		if (!rows.length) return [];

		return rows
			.map((row) => {
				const attachments = parseSessionAttachments(row.attachments);
				return {
					id: row.id,
					role: row.role,
					content: row.content || "",
					attachments,
					createdAt: row.created_at || Date.now(),
				} satisfies SessionMessage;
			})
			.filter(
				(message) =>
					message.role === "user" ||
					message.content.trim().length > 0 ||
					(message.attachments?.length || 0) > 0,
			);
	}
}

function mergePendingMessages(
	persisted: SessionMessage[],
	pending: SessionMessage[],
): SessionMessage[] {
	if (pending.length === 0) return persisted;
	if (persisted.length === 0) return pending;

	const merged = [...persisted];
	for (const candidate of pending) {
		const duplicate = merged.some((message) =>
			isLikelyDuplicateMessage(message, candidate),
		);
		if (!duplicate) {
			merged.push(candidate);
		}
	}

	merged.sort((a, b) => {
		if (a.createdAt === b.createdAt) {
			if (a.role === b.role) return 0;
			return a.role === "user" ? -1 : 1;
		}
		return a.createdAt - b.createdAt;
	});
	return merged;
}

function isLikelyDuplicateMessage(
	left: SessionMessage,
	right: SessionMessage,
): boolean {
	if (left.id && right.id && left.id === right.id) return true;
	if (left.role !== right.role) return false;
	if ((left.content || "").trim() !== (right.content || "").trim()) return false;

	const leftAttachments = left.attachments || [];
	const rightAttachments = right.attachments || [];
	if (leftAttachments.length !== rightAttachments.length) return false;
	for (let index = 0; index < leftAttachments.length; index += 1) {
		if (!isAttachmentEquivalent(leftAttachments[index], rightAttachments[index])) {
			return false;
		}
	}

	return Math.abs((left.createdAt || 0) - (right.createdAt || 0)) < 30_000;
}

function isAttachmentEquivalent(
	left?: SessionAttachment,
	right?: SessionAttachment,
): boolean {
	if (!left || !right) return left === right;
	return (
		left.kind === right.kind &&
		(left.dataUrl || "") === (right.dataUrl || "") &&
		(left.name || "") === (right.name || "") &&
		(left.mimeType || "") === (right.mimeType || "") &&
		(left.size || 0) === (right.size || 0)
	);
}

function parseSessionAttachments(
	raw: string | null | undefined,
): SessionAttachment[] | undefined {
	if (!raw) return undefined;
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return undefined;
		const attachments = parsed.filter(
			(item) =>
				item &&
				typeof item === "object" &&
				typeof (item as any).kind === "string" &&
				typeof (item as any).dataUrl === "string",
		) as SessionAttachment[];
		return attachments.length > 0 ? attachments : undefined;
	} catch {
		return undefined;
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
	if (
		entry?.additional_kwargs?.ui_hidden ||
		entry?.additional_kwargs?.uiHidden
	) {
		return null;
	}
	if (entry?.metadata?.ui_hidden || entry?.metadata?.uiHidden) {
		return null;
	}

	const role = resolveMessageRole(entry);

	if (role !== "user" && role !== "assistant") {
		if (isToolMessage(entry)) {
			const blocks = extractContentBlocks(entry);
			const toolContent = extractMessageContent(entry, blocks);
			const ui = extractUiFromPayload(toolContent);
			const attachments = extractAttachments(blocks);
			if (ui?.spec || attachments.length > 0) {
				const content = toolContent || ui?.textFallback || "";
				return {
					id: `msg-${index}`,
					role: "assistant",
					content,
					attachments: attachments.length > 0 ? attachments : undefined,
					createdAt: baseTime + index,
					...(ui?.spec
						? {
								uiBlocks: [
									{
										spec: ui.spec,
										uiOnly: ui.uiOnly,
										textFallback: ui.textFallback,
									},
								],
								uiTextFallback: ui.textFallback,
							}
						: {}),
				};
			}
		}
		return null;
	}

	const blocks = extractContentBlocks(entry);
	const content = extractMessageContent(entry, blocks);

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

export function extractMessagesFromState(state: any): SessionMessage[] | null {
	if (!state || typeof state !== "object") return null;

	const values = state?.values ?? state?.value ?? state?.state ?? {};
	const candidates = [
		values?.messages,
		values?.channel_values?.messages,
		values?.channelValues?.messages,
		state?.channel_values?.messages,
		state?.channelValues?.messages,
	];
	const messages = candidates.find((candidate) => Array.isArray(candidate)) as
		| any[]
		| undefined;

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

	const filtered = filterUiOnlyAssistantMessages(messages);
	const mapped = filtered
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
		entry?.artifact,
		entry?.kwargs?.artifact,
		entry?.additional_kwargs?.artifact,
		entry?.data?.artifact,
	];
	for (const candidate of candidates) {
		const blocks = extractContentBlocksFromValue(candidate);
		if (blocks.length > 0) return blocks;
	}
	return [];
}

function extractContentBlocksFromValue(value: unknown, depth = 0): any[] {
	if (depth > 5 || value === null || value === undefined) return [];
	if (Array.isArray(value)) {
		const unwrapped: any[] = [];
		for (const item of value) {
			const parsedBlocks = extractBlocksFromTextLikeItem(item, depth + 1);
			if (parsedBlocks.length > 0) {
				unwrapped.push(...parsedBlocks);
				continue;
			}
			unwrapped.push(item);
		}
		return unwrapped;
	}
	if (typeof value === "string") {
		const parsed = tryParseJsonPayload(value);
		return parsed ? extractContentBlocksFromValue(parsed, depth + 1) : [];
	}
	if (typeof value !== "object") return [];

	const record = value as Record<string, unknown>;
	const candidates = [
		record.content,
		(record as any)?.kwargs?.content,
		(record as any)?.additional_kwargs?.content,
		(record as any)?.data?.content,
	];
	for (const candidate of candidates) {
		const blocks = extractContentBlocksFromValue(candidate, depth + 1);
		if (blocks.length > 0) return blocks;
	}
	return [];
}

function extractBlocksFromTextLikeItem(value: unknown, depth = 0): any[] {
	if (!value || typeof value !== "object" || Array.isArray(value)) return [];
	const record = value as Record<string, unknown>;

	const text =
		typeof record.text === "string"
			? record.text
			: typeof record.value === "string" && isTextLikeContentType(record.type)
				? record.value
				: typeof record.output_text === "string"
					? record.output_text
					: typeof record.input_text === "string"
						? record.input_text
						: null;
	if (!text) return [];

	const parsed = tryParseJsonPayload(text);
	if (!parsed) return [];
	return extractContentBlocksFromValue(parsed, depth + 1);
}

function extractMessageContent(entry: any, blocks: any[] = []): string {
	if (!entry || typeof entry !== "object") return "";

	const candidates = [
		entry.content,
		entry?.kwargs?.content,
		entry?.additional_kwargs?.content,
		entry?.data?.content,
	];

	for (const candidate of candidates) {
		const extracted = extractTextContent(candidate);
		if (extracted) {
			return extracted;
		}
	}

	if (blocks.length > 0) {
		return extractTextContent(blocks);
	}

	return "";
}

function extractTextContent(value: unknown, depth = 0): string {
	if (depth > 5 || value === null || value === undefined) {
		return "";
	}
	if (typeof value === "string") {
		const parsed = tryParseJsonPayload(value);
		if (parsed !== null) {
			const extracted = extractTextContent(parsed, depth + 1).trim();
			if (extracted) return extracted;
		}
		return value;
	}
	if (Array.isArray(value)) {
		return value
			.map((entry) => extractTextContent(entry, depth + 1))
			.filter((entry) => entry.length > 0)
			.join("");
	}
	if (typeof value !== "object") {
		return "";
	}

	const record = value as Record<string, unknown>;

	if (typeof record.text === "string") {
		const parsed = tryParseJsonPayload(record.text);
		if (parsed !== null) {
			const extracted = extractTextContent(parsed, depth + 1).trim();
			if (extracted) return extracted;
		}
		return record.text;
	}
	if (
		record.text &&
		typeof record.text === "object" &&
		typeof (record.text as Record<string, unknown>).value === "string"
	) {
		return (record.text as Record<string, unknown>).value as string;
	}
	if (typeof record.output_text === "string") {
		const parsed = tryParseJsonPayload(record.output_text);
		if (parsed !== null) {
			const extracted = extractTextContent(parsed, depth + 1).trim();
			if (extracted) return extracted;
		}
		return record.output_text;
	}
	if (typeof record.input_text === "string") {
		const parsed = tryParseJsonPayload(record.input_text);
		if (parsed !== null) {
			const extracted = extractTextContent(parsed, depth + 1).trim();
			if (extracted) return extracted;
		}
		return record.input_text;
	}
	if (typeof record.value === "string" && isTextLikeContentType(record.type)) {
		const parsed = tryParseJsonPayload(record.value);
		if (parsed !== null) {
			const extracted = extractTextContent(parsed, depth + 1).trim();
			if (extracted) return extracted;
		}
		return record.value;
	}

	if ("content" in record) {
		return extractTextContent(record.content, depth + 1);
	}

	return "";
}

function tryParseJsonPayload(value: string): unknown | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
		return null;
	}
	try {
		return JSON.parse(trimmed);
	} catch {
		return null;
	}
}

function isTextLikeContentType(type: unknown): boolean {
	if (typeof type !== "string") return false;
	const normalized = type.toLowerCase();
	return (
		normalized === "text" ||
		normalized === "input_text" ||
		normalized === "output_text" ||
		normalized === "text_delta"
	);
}

function extractUiMetaFromPayload(payload: unknown): {
	uiOnly?: boolean;
	textFallback?: string;
} {
	if (typeof payload === "string") {
		try {
			const parsed = JSON.parse(payload);
			return extractUiMetaFromPayload(parsed);
		} catch {
			return {};
		}
	}
	if (!payload || typeof payload !== "object") return {};
	const record = payload as Record<string, unknown>;
	const uiOnly = typeof record.uiOnly === "boolean" ? record.uiOnly : undefined;
	const textFallback =
		typeof record.textFallback === "string" ? record.textFallback : undefined;
	if (uiOnly !== undefined || textFallback) {
		return { uiOnly, textFallback };
	}
	const content =
		typeof record.content === "string"
			? record.content
			: typeof (record as any)?.kwargs?.content === "string"
				? (record as any).kwargs.content
				: undefined;
	if (content) {
		return extractUiMetaFromPayload(content);
	}
	return {};
}

function isToolMessage(entry: any): boolean {
	if (!entry || typeof entry !== "object") return false;
	const role =
		(entry.role as string | undefined) ||
		(entry?.kwargs?.role as string | undefined) ||
		(entry?.additional_kwargs?.role as string | undefined);
	if (role && role.toLowerCase() === "tool") return true;
	const type = typeof entry.type === "string" ? entry.type.toLowerCase() : "";
	return type === "tool" || type === "toolmessage";
}

function filterUiOnlyAssistantMessages(messages: any[]): any[] {
	if (!Array.isArray(messages) || messages.length === 0) return messages;
	const filtered: any[] = [];
	let pendingFallback: string | null = null;

	for (const entry of messages) {
		if (isToolMessage(entry)) {
			const blocks = extractContentBlocks(entry);
			const content = extractMessageContent(entry, blocks);
			const ui = extractUiFromPayload(content);
			const attachments = extractAttachments(blocks);
			if (ui?.uiOnly && ui?.textFallback) {
				pendingFallback = ui.textFallback.trim();
			}
			if (ui?.spec || attachments.length > 0) {
				filtered.push(entry);
			}
			continue;
		}

		const role = resolveMessageRole(entry);
		if (role === "assistant" && pendingFallback) {
			const content = extractMessageContent(
				entry,
				extractContentBlocks(entry),
			).trim();
			if (content && content === pendingFallback) {
				pendingFallback = null;
				continue;
			}
			pendingFallback = null;
		}

		filtered.push(entry);
	}

	return filtered;
}

function extractUiFromPayload(payload: unknown): {
	spec?: unknown;
	uiOnly?: boolean;
	textFallback?: string;
} {
	if (typeof payload === "string") {
		try {
			const parsed = JSON.parse(payload);
			return extractUiFromPayload(parsed);
		} catch {
			return {};
		}
	}
	if (!payload || typeof payload !== "object") return {};
	const record = payload as Record<string, unknown>;
	const uiOnly = typeof record.uiOnly === "boolean" ? record.uiOnly : undefined;
	const textFallback =
		typeof record.textFallback === "string" ? record.textFallback : undefined;
	const ui = record.ui;
	if (ui && typeof ui === "object" && Array.isArray((ui as any).components)) {
		return { spec: ui, uiOnly, textFallback };
	}
	const content =
		typeof record.content === "string"
			? record.content
			: typeof (record as any)?.kwargs?.content === "string"
				? (record as any).kwargs.content
				: undefined;
	if (content) {
		return extractUiFromPayload(content);
	}
	return {};
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
		if (audioUrl) {
			attachments.push({
				kind: "audio",
				dataUrl: audioUrl,
			});
			continue;
		}
		const fileAttachment = extractFileAttachment(block);
		if (fileAttachment) {
			attachments.push(fileAttachment);
		}
	}
	return attachments;
}

export function extractImageAttachments(blocks: any[]): SessionAttachment[] {
	return extractAttachments(blocks).filter(
		(attachment) => attachment.kind === "image",
	);
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
	if (block.type === "image") {
		const sourceType = block.source_type || block.sourceType;
		const mimeType =
			block.mime_type ||
			block.mimeType ||
			block.media_type ||
			block.mediaType ||
			"image/png";
		if (sourceType === "base64" && typeof block.data === "string") {
			return `data:${mimeType};base64,${block.data}`;
		}
		if (sourceType === "url" && typeof block.url === "string") {
			return block.url;
		}
		if (typeof block.data === "string") {
			return `data:${mimeType};base64,${block.data}`;
		}
	}
	if (block.type === "output_image") {
		if (typeof block.image_url === "string") return block.image_url;
		if (typeof block.image_url?.url === "string") return block.image_url.url;
		if (typeof block.url === "string") return block.url;
	}
	if (block.type === "resource_link") {
		const mimeType =
			typeof block.mimeType === "string"
				? block.mimeType.trim().toLowerCase()
				: "";
		const uri = typeof block.uri === "string" ? block.uri.trim() : "";
		if (uri && (!mimeType || mimeType.startsWith("image/"))) {
			return uri;
		}
	}
	if (block.type === "resource" && block.resource) {
		const resource = block.resource;
		const mimeType =
			typeof resource.mimeType === "string"
				? resource.mimeType.trim().toLowerCase()
				: "";
		if (!mimeType || !mimeType.startsWith("image/")) return null;
		if (typeof resource.blob === "string" && resource.blob.trim()) {
			return `data:${mimeType};base64,${resource.blob.trim()}`;
		}
		if (typeof resource.uri === "string" && resource.uri.trim()) {
			return resource.uri.trim();
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
		const format = typeof input?.format === "string" ? input.format : undefined;
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
	if (block.type === "audio") {
		const sourceType = block.source_type || block.sourceType;
		const data = block.data;
		if (sourceType === "base64" && typeof data === "string") {
			const rawFormat =
				block.mime_type || block.media_type || block.mediaType || block.format;
			const mimeType =
				typeof rawFormat === "string"
					? rawFormat.includes("/")
						? rawFormat
						: resolveAudioMimeType(rawFormat)
					: "audio/wav";
			return `data:${mimeType};base64,${data}`;
		}
		if (sourceType === "url" && typeof block.url === "string") {
			return block.url;
		}
	}
	return null;
}

function parseDataUrlMime(dataUrl?: string): string | undefined {
	if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
		return undefined;
	}
	const match = dataUrl.match(/^data:([^;,]+)[;,]/i);
	return match?.[1];
}

function extractString(...values: unknown[]): string | undefined {
	for (const value of values) {
		if (typeof value === "string" && value.trim().length > 0) {
			return value.trim();
		}
	}
	return undefined;
}

function extractFileAttachment(block: any): SessionAttachment | null {
	if (!block || typeof block !== "object") return null;

	if (block.type === "file") {
		const sourceType = block.source_type || block.sourceType;
		const metadata = (
			block.metadata && typeof block.metadata === "object" ? block.metadata : {}
		) as Record<string, unknown>;
		const name = extractString(
			block.name,
			block.filename,
			metadata.filename,
			metadata.name,
			metadata.title,
		);
		const declaredMime = extractString(
			block.mime_type,
			block.mimeType,
			block.media_type,
			block.mediaType,
		);
		if (sourceType === "base64" && typeof block.data === "string") {
			const mimeType = declaredMime || "application/octet-stream";
			return {
				kind: "file",
				dataUrl: `data:${mimeType};base64,${block.data}`,
				name,
				mimeType,
			};
		}
		if (sourceType === "url" && typeof block.url === "string") {
			const mimeType = declaredMime || parseDataUrlMime(block.url);
			return {
				kind: "file",
				dataUrl: block.url,
				name,
				mimeType,
			};
		}
		const openAiFile = block.file;
		if (openAiFile && typeof openAiFile === "object") {
			const fileData = extractString(openAiFile.file_data, openAiFile.data);
			const fileUrl = extractString(openAiFile.file_url, openAiFile.url);
			const fileName = extractString(openAiFile.filename, name);
			if (fileData) {
				return {
					kind: "file",
					dataUrl: fileData,
					name: fileName,
					mimeType: parseDataUrlMime(fileData),
				};
			}
			if (fileUrl) {
				return {
					kind: "file",
					dataUrl: fileUrl,
					name: fileName,
					mimeType: parseDataUrlMime(fileUrl),
				};
			}
		}
	}

	if (block.type === "input_file") {
		const dataUrl = extractString(block.file_data, block.file_url);
		if (!dataUrl) return null;
		return {
			kind: "file",
			dataUrl,
			name: extractString(block.filename),
			mimeType: parseDataUrlMime(dataUrl),
		};
	}

	if (
		block.type === "document" &&
		block.source &&
		typeof block.source === "object"
	) {
		const source = block.source as Record<string, unknown>;
		const sourceType = extractString(source.type);
		const name = extractString(block.title);
		if (sourceType === "base64" && typeof source.data === "string") {
			const mimeType = extractString(source.media_type, "application/pdf");
			return {
				kind: "file",
				dataUrl: `data:${mimeType};base64,${source.data}`,
				name,
				mimeType,
			};
		}
		if (sourceType === "url" && typeof source.url === "string") {
			return {
				kind: "file",
				dataUrl: source.url,
				name,
				mimeType: parseDataUrlMime(source.url),
			};
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
	return ((entry?.role as string | undefined) ||
		(entry?.kwargs?.role as string | undefined) ||
		(entry?.additional_kwargs?.role as string | undefined) ||
		mapMessageType(entry?.type as string | undefined) ||
		mapMessageTypeFromId(entry?.id ?? entry?.lc_id ?? entry?.kwargs?.id)) as
		| "user"
		| "assistant"
		| null;
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

function scoreMessages(
	candidate: any[],
	baseTime: number,
): {
	score: number;
	messages: SessionMessage[];
} {
	const filtered = filterUiOnlyAssistantMessages(candidate);
	const messages = filtered
		.map((message, index) => toSessionMessage(message, index, baseTime))
		.filter(Boolean) as SessionMessage[];
	const contentful = messages.filter(
		(msg) =>
			msg.content.trim().length > 0 || (msg.attachments?.length ?? 0) > 0,
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
			(message.attachments?.length ?? 0) > 0 ||
			(Array.isArray((message as any).uiBlocks) &&
				(message as any).uiBlocks.length > 0),
	);
	return filtered.length > 0 ? filtered : messages;
}
