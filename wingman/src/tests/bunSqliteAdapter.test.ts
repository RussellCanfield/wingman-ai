import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { unlink } from "node:fs/promises";

const isBun = typeof (globalThis as any).Bun !== "undefined";
const describeIfBun = isBun ? describe : describe.skip;

describeIfBun("BunSqliteAdapter", () => {
	const testDbPath = "./test-adapter.db";
	let BunSqliteAdapter: any;
	let Database: any;
	let adapter: any;

	beforeAll(async () => {
		const module = await import("../cli/core/database/bunSqliteAdapter.js");
		BunSqliteAdapter = module.BunSqliteAdapter;
		const sqliteModule = await import("bun:sqlite");
		Database = sqliteModule.Database;
	});

	beforeEach(() => {
		// Create a new adapter for each test
		adapter = new BunSqliteAdapter(testDbPath);
	});

	afterEach(async () => {
		// Clean up: close connection and remove test database
		try {
			adapter.close();
			await unlink(testDbPath);
		} catch {
			// Ignore errors if file doesn't exist
		}
	});

	describe("constructor", () => {
		it("should create adapter from file path", () => {
			expect(adapter).toBeDefined();
		});

		it("should create adapter from existing Database instance", () => {
			const db = new Database(":memory:");
			const memAdapter = new BunSqliteAdapter(db);

			expect(memAdapter).toBeDefined();
			memAdapter.close();
		});
	});

	describe("exec and run", () => {
		it("should execute SQL statements to create tables via exec", () => {
			const result = adapter.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        );
      `);

			expect(result).toBeDefined();
		});

		it("should execute SQL statements to create tables via run", () => {
			const result = adapter.run(`
        CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
          content TEXT NOT NULL
        );
      `);

			expect(result).toBeDefined();
		});

		it("should create multiple tables in one exec call", () => {
			adapter.exec(`
        CREATE TABLE accounts (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE transactions (id INTEGER PRIMARY KEY, account_id INTEGER);
      `);

			// Verify tables were created by trying to insert
			const stmt = adapter.prepare("INSERT INTO accounts (name) VALUES (?)");
			const result = stmt.run("Alice");
			expect(result).toBeDefined();
		});
	});

	describe("prepare and run", () => {
		beforeEach(() => {
			adapter.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT
        );
      `);
		});

		it("should prepare and execute INSERT statement", () => {
			const stmt = adapter.prepare(
				"INSERT INTO users (name, email) VALUES (?, ?)",
			);
			const result = stmt.run("John Doe", "john@example.com");

			expect(result).toBeDefined();
			expect(result.changes).toBe(1);
		});

		it("should prepare and execute UPDATE statement", () => {
			// Insert a user first
			const insertStmt = adapter.prepare("INSERT INTO users (name) VALUES (?)");
			insertStmt.run("Jane");

			// Update the user
			const updateStmt = adapter.prepare(
				"UPDATE users SET name = ? WHERE name = ?",
			);
			const result = updateStmt.run("Jane Doe", "Jane");

			expect(result.changes).toBe(1);
		});

		it("should prepare and execute DELETE statement", () => {
			// Insert users first
			const insertStmt = adapter.prepare("INSERT INTO users (name) VALUES (?)");
			insertStmt.run("User1");
			insertStmt.run("User2");

			// Delete one user
			const deleteStmt = adapter.prepare("DELETE FROM users WHERE name = ?");
			const result = deleteStmt.run("User1");

			expect(result.changes).toBe(1);
		});
	});

	describe("prepare and get", () => {
		beforeEach(() => {
			adapter.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          age INTEGER
        );
      `);

			// Insert test data
			const stmt = adapter.prepare("INSERT INTO users (name, age) VALUES (?, ?)");
			stmt.run("Alice", 30);
			stmt.run("Bob", 25);
		});

		it("should get a single row", () => {
			const stmt = adapter.prepare("SELECT * FROM users WHERE name = ?");
			const row = stmt.get("Alice") as any;

			expect(row).toBeDefined();
			expect(row.name).toBe("Alice");
			expect(row.age).toBe(30);
		});

		it("should return undefined for non-existent row", () => {
			const stmt = adapter.prepare("SELECT * FROM users WHERE name = ?");
			const row = stmt.get("NonExistent");

			expect(row).toBeUndefined();
		});
	});

	describe("prepare and all", () => {
		beforeEach(() => {
			adapter.exec(`
        CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          active INTEGER DEFAULT 1
        );
      `);

			// Insert test data
			const stmt = adapter.prepare("INSERT INTO users (name, active) VALUES (?, ?)");
			stmt.run("Alice", 1);
			stmt.run("Bob", 1);
			stmt.run("Charlie", 0);
		});

		it("should get all matching rows", () => {
			const stmt = adapter.prepare("SELECT * FROM users WHERE active = ?");
			const rows = stmt.all(1) as any[];

			expect(rows).toHaveLength(2);
			expect(rows[0].name).toBe("Alice");
			expect(rows[1].name).toBe("Bob");
		});

		it("should return empty array when no matches", () => {
			const stmt = adapter.prepare("SELECT * FROM users WHERE name = ?");
			const rows = stmt.all("Nobody") as any[];

			expect(rows).toHaveLength(0);
		});

		it("should get all rows without parameters", () => {
			const stmt = adapter.prepare("SELECT * FROM users");
			const rows = stmt.all() as any[];

			expect(rows).toHaveLength(3);
		});
	});

	describe("transaction", () => {
		beforeEach(() => {
			adapter.exec(`
        CREATE TABLE accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          balance INTEGER DEFAULT 0
        );
      `);
		});

		it("should execute transaction successfully", () => {
			const insertMany = adapter.transaction((names: string[]) => {
				const stmt = adapter.prepare(
					"INSERT INTO accounts (name, balance) VALUES (?, ?)",
				);
				for (const name of names) {
					stmt.run(name, 100);
				}
			});

			insertMany(["Alice", "Bob", "Charlie"]);

			// Verify all were inserted
			const stmt = adapter.prepare("SELECT COUNT(*) as count FROM accounts");
			const result = stmt.get() as any;
			expect(result.count).toBe(3);
		});

		it("should rollback transaction on error", () => {
			const failedTransaction = adapter.transaction(() => {
				const stmt = adapter.prepare(
					"INSERT INTO accounts (name, balance) VALUES (?, ?)",
				);
				stmt.run("Alice", 100);
				// This will throw an error
				throw new Error("Transaction failed");
			});

			expect(() => failedTransaction()).toThrow("Transaction failed");

			// Verify nothing was inserted
			const stmt = adapter.prepare("SELECT COUNT(*) as count FROM accounts");
			const result = stmt.get() as any;
			expect(result.count).toBe(0);
		});
	});

	describe("pragma", () => {
		it("should execute pragma statements", () => {
			const result = adapter.pragma("journal_mode", true);

			expect(result).toBeDefined();
		});

		it("should return pragma result without simplify", () => {
			const result = adapter.pragma("journal_mode", false);

			expect(result).toBeDefined();
			expect(typeof result).toBe("object");
		});
	});

	describe("close", () => {
		it("should close database connection", () => {
			const tempDb = new BunSqliteAdapter(":memory:");

			expect(() => tempDb.close()).not.toThrow();
		});
	});

	describe("inTransaction", () => {
		it("should return false by default", () => {
			expect(adapter.inTransaction).toBe(false);
		});
	});

	describe("SqliteSaver compatibility", () => {
		it("should be compatible with LangGraph checkpoint operations", () => {
			// Create tables similar to what SqliteSaver would create
			adapter.exec(`
        CREATE TABLE checkpoints (
          thread_id TEXT NOT NULL,
          checkpoint_ns TEXT NOT NULL DEFAULT '',
          checkpoint_id TEXT NOT NULL,
          parent_checkpoint_id TEXT,
          type TEXT,
          checkpoint BLOB NOT NULL,
          metadata BLOB NOT NULL,
          PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
        );

        CREATE TABLE checkpoint_writes (
          thread_id TEXT NOT NULL,
          checkpoint_ns TEXT NOT NULL DEFAULT '',
          checkpoint_id TEXT NOT NULL,
          task_id TEXT NOT NULL,
          idx INTEGER NOT NULL,
          channel TEXT NOT NULL,
          type TEXT,
          value BLOB,
          PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
        );
      `);

			// Test INSERT operation
			const insertStmt = adapter.prepare(`
        INSERT INTO checkpoints (thread_id, checkpoint_id, checkpoint, metadata)
        VALUES (?, ?, ?, ?)
      `);
			const result = insertStmt.run(
				"thread-1",
				"checkpoint-1",
				JSON.stringify({ data: "test" }),
				JSON.stringify({ version: 1 }),
			);
			expect(result.changes).toBe(1);

			// Test SELECT operation
			const selectStmt = adapter.prepare(
				"SELECT * FROM checkpoints WHERE thread_id = ?",
			);
			const row = selectStmt.get("thread-1") as any;
			expect(row).toBeDefined();
			expect(row.thread_id).toBe("thread-1");
			expect(row.checkpoint_id).toBe("checkpoint-1");

			// Test DELETE operation
			const deleteStmt = adapter.prepare(
				"DELETE FROM checkpoints WHERE thread_id = ?",
			);
			const deleteResult = deleteStmt.run("thread-1");
			expect(deleteResult.changes).toBe(1);
		});
	});
});
