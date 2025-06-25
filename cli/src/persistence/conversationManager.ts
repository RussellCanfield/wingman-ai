import type { BaseMessage } from "@langchain/core/messages";
import Database, { type Database as SQLDatabase } from "better-sqlite3";

export type Conversation = {
	threadId: string;
	metadata: {
		writes: {
			agent: {
				messages: [
					{
						kwargs: {
							content: string;
						};
					},
				];
			};
		};
	};
};

export class ConversationRetriever {
	db: SQLDatabase;

	constructor(dbPath: string) {
		this.db = new Database(dbPath);
	}

	getAllConversations() {
		try {
			const stmt = this.db.prepare(`
    SELECT DISTINCT 
      thread_id,
      MAX(checkpoint_ns) as latest_checkpoint,
      MAX(checkpoint_id) as checkpoint_id,
      metadata
    FROM checkpoints 
    GROUP BY thread_id 
  `);

			return stmt.all().map((row) => ({
				//@ts-expect-error
				threadId: row.thread_id,
				//@ts-expect-error
				latestCheckpoint: row.latest_checkpoint,
				//@ts-expect-error
				metadata: row.metadata ? JSON.parse(row.metadata) : {},
			})) as Conversation[];
		} catch (error) {
			console.error("Error retrieving conversations:", error);
			return [];
		}
	}

	close() {
		this.db.close();
	}
}
