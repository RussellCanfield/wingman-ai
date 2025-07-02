import type { BaseMessage } from "@langchain/core/messages";
import Database, { type Database as SQLDatabase } from "better-sqlite3";

export type Conversation = {
	id: string;
	threadId: string;
	title?: string;
	messages: Array<{
		id: string;
		type: "human" | "ai" | "system" | "tool";
		content: string;
		toolCalls?: any[];
		timestamp?: Date;
	}>;
	createdAt?: string;
	metadata?: any;
};

export class ConversationRetriever {
	db: SQLDatabase;

	constructor(dbPath: string) {
		this.db = new Database(dbPath);
	}

	getAllConversations(): Conversation[] {
		try {
			const stmt = this.db.prepare(`
				SELECT DISTINCT 
					thread_id,
					MAX(checkpoint_ns) as latest_checkpoint,
					MAX(checkpoint_id) as checkpoint_id,
					metadata
				FROM checkpoints 
				GROUP BY thread_id 
				ORDER BY latest_checkpoint DESC
			`);

			return stmt.all().map((row: any) => {
				const metadata = row.metadata ? JSON.parse(row.metadata) : {};

				// Extract title from metadata if available
				let title = "Untitled";
				let messages: any[] = [];
				let createdAt: string | undefined;

				// Try to extract meaningful information from metadata
				if (metadata.writes?.agent?.messages) {
					const agentMessages = metadata.writes.agent.messages;
					if (agentMessages.length > 0) {
						// Use first message content as title (truncated)
						const firstMessage = agentMessages[0];
						if (
							firstMessage?.kwargs?.content &&
							typeof firstMessage.kwargs.content === "string"
						) {
							title =
								firstMessage.kwargs.content.substring(0, 50) +
								(firstMessage.kwargs.content.length > 50 ? "..." : "");
						}
					}

					// Convert messages to expected format
					messages = agentMessages.map((msg: any, index: number) => ({
						id: `msg-${index}`,
						type: "ai" as const,
						content: msg?.kwargs?.content || "",
						timestamp: new Date(),
					}));
				}

				// Try to extract creation date from checkpoint timestamp
				if (row.latest_checkpoint) {
					createdAt = new Date(row.latest_checkpoint).toISOString();
				}

				return {
					id: row.thread_id,
					threadId: row.thread_id,
					title,
					messages,
					createdAt,
					metadata,
				};
			});
		} catch (error) {
			console.error("Error retrieving conversations:", error);
			return [];
		}
	}

	close() {
		this.db.close();
	}

	// Static convenience method
	static async getAllConversations(
		dbPath = "./.wingman/memory.db",
	): Promise<Conversation[]> {
		const retriever = new ConversationRetriever(dbPath);
		try {
			return retriever.getAllConversations();
		} finally {
			retriever.close();
		}
	}
}
