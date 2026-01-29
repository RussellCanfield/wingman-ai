import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
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
	kind: "image";
	dataUrl: string;
	name?: string;
	mimeType?: string;
	size?: number;
}

/**
 * SessionManager handles session metadata and provides unified access to
 * both the custom sessions table and LangGraph's SqliteSaver checkpointer.
 */
export class SessionManager {
	private checkpointer: SqliteSaver | null = null;
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

		const tuple = await this.checkpointer.getTuple({
			configurable: { thread_id: sessionId },
		});
		if (!tuple?.checkpoint) {
			return [];
		}

		const checkpoint = tuple.checkpoint as any;
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

		const messages = candidates.find((arr) => arr.some(isMessageLike)) || [];
		const baseTime = parseCheckpointTimestamp(checkpoint?.ts);

		return messages
			.map((message, index) => toSessionMessage(message, index, baseTime))
			.filter(Boolean) as SessionMessage[];
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

	const role =
		(entry.role as string | undefined) ||
		(entry?.kwargs?.role as string | undefined) ||
		(entry?.additional_kwargs?.role as string | undefined) ||
		mapMessageType(entry?.type as string | undefined);

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

	const attachments = extractImageAttachments(blocks);

	return {
		id: `msg-${index}`,
		role,
		content,
		attachments: attachments.length > 0 ? attachments : undefined,
		createdAt: baseTime + index,
	};
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

export function extractImageAttachments(blocks: any[]): SessionAttachment[] {
	const attachments: SessionAttachment[] = [];
	for (const block of blocks) {
		if (!block || typeof block !== "object") continue;
		const imageUrl = extractImageUrl(block);
		if (!imageUrl) continue;
		attachments.push({
			kind: "image",
			dataUrl: imageUrl,
		});
	}
	return attachments;
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

function mapMessageType(type?: string): "user" | "assistant" | null {
	if (!type) return null;
	if (type === "human" || type === "user") return "user";
	if (type === "ai" || type === "assistant") return "assistant";
	return null;
}

function parseCheckpointTimestamp(ts?: string): number {
	if (!ts) return Date.now();
	const parsed = Date.parse(ts);
	return Number.isNaN(parsed) ? Date.now() : parsed;
}

function isUiHiddenContent(content: string): boolean {
	if (!content) return false;
	return (
		content.includes("Current Date Time (UTC):") ||
		content.startsWith("# User's Machine Information")
	);
}
