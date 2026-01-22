import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import { Database } from "bun:sqlite";
import { BunSqliteAdapter } from "./database/bunSqliteAdapter.js";
import { v4 as uuidv4 } from "uuid";

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

/**
 * SessionManager handles session metadata and provides unified access to
 * both the custom sessions table and LangGraph's SqliteSaver checkpointer.
 */
export class SessionManager {
	private checkpointer: SqliteSaver | null = null;
	private db: Database | null = null;
	private dbPath: string;

	constructor(dbPath: string) {
		this.dbPath = dbPath;
	}

	/**
	 * Initialize the SessionManager with SqliteSaver and create custom tables
	 */
	async initialize(): Promise<void> {
		// Create native bun:sqlite database
		const bunDb = new Database(this.dbPath, { create: true });

		// Wrap for SqliteSaver compatibility
		const adapter = new BunSqliteAdapter(bunDb);

		// Create SqliteSaver directly with the adapter
		// Note: SqliteSaver expects a better-sqlite3 Database instance
		// Our adapter provides the same API surface
		this.checkpointer = new SqliteSaver(adapter as any);

		// Initialize checkpoint tables (setup is protected but necessary)
		// @ts-ignore - We need to call setup() to create checkpoint tables
		await this.checkpointer.setup();

		// Store native database reference for direct queries
		// Access the actual bun:sqlite database through the adapter
		this.db = adapter.db;

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
	 * Get the checkpointer for use with DeepAgents
	 */
	getCheckpointer(): SqliteSaver {
		if (!this.checkpointer) {
			throw new Error("SessionManager not initialized");
		}
		return this.checkpointer;
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
