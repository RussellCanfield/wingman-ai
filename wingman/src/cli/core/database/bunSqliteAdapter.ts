import { Database } from "bun:sqlite";

/**
 * Adapter making bun:sqlite compatible with better-sqlite3 interface
 * for LangGraph's SqliteSaver.
 *
 * This allows SqliteSaver to work with bun:sqlite without modification.
 * The APIs are intentionally similar as bun:sqlite was designed to be
 * compatible with better-sqlite3.
 */
export class BunSqliteAdapter {
	// Make db public so SqliteSaver can access it if needed
	public db: Database;

	constructor(filenameOrDatabase: string | Database) {
		this.db =
			typeof filenameOrDatabase === "string"
				? new Database(filenameOrDatabase, { create: true })
				: filenameOrDatabase;
	}

	prepare(sql: string) {
		const stmt = this.db.prepare(sql);

		// Wrap the statement to convert null to undefined for better-sqlite3 compatibility
		return {
			...stmt,
			get: (...params: any[]) => {
				const result = stmt.get(...params);
				// bun:sqlite returns null for no results, better-sqlite3 returns undefined
				return result === null ? undefined : result;
			},
			all: (...params: any[]) => stmt.all(...params),
			run: (...params: any[]) => stmt.run(...params),
		};
	}

	exec(sql: string) {
		// bun:sqlite's exec() is deprecated, use run() instead
		// run() executes SQL statements and returns a Changes object
		return this.db.run(sql);
	}

	run(sql: string, ...params: any[]) {
		// Support for direct run() calls
		return this.db.run(sql, ...params);
	}

	pragma(pragma: string, simplify?: boolean) {
		// bun:sqlite doesn't have a dedicated pragma method
		// Use prepare + get to execute PRAGMA statements
		const result = this.db.prepare(`PRAGMA ${pragma}`).get();
		return simplify ? result : { [pragma]: result };
	}

	transaction(fn: (...args: any[]) => any) {
		return this.db.transaction(fn);
	}

	close() {
		return this.db.close();
	}

	get inTransaction() {
		// bun:sqlite doesn't expose transaction state
		// Return false as a safe default
		return false;
	}
}
