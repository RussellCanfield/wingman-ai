import * as path from "node:path";
import type { Connection, ConnectionOptions, Table } from "@lancedb/lancedb";
import * as arrow from "apache-arrow";
import { Field, Schema } from "apache-arrow";
import type { Embeddings } from "@langchain/core/embeddings";
import type { Settings } from "@shared/types/Settings";
import { CreateEmbeddingProvider } from "../../service/utils/models";
import { loggingProvider } from "../loggingProvider";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

export interface VectorMetadata {
	filePath: string;
	lastModified?: number;
	[key: string]: any;
}

export interface SearchResult {
	filePath: string;
	summary: string;
	similarity: number;
	metadata: VectorMetadata;
}

async function loadLanceDB() {
	const { connect } = await import("@lancedb/lancedb");
	return connect;
}

export const buildSummarizationQuery = (
	code: string,
	filePath: string,
) => `Summarize the provided code with key details: 
- Core purpose and functionality 
- Primary classes/interfaces and their relationships 
- Key methods and their specific roles 
- Data structures, algorithms, and design patterns employed 
- Notable configuration options and parameters 
- Relevant technical domains (e.g., "vector-database", "authentication", "image-processing") 

Keep it concise, technical, and unique to the code. 
Use searchable terminology. 
Avoid boilerplate or standard patterns unless critical. 
Include: list of symbol names, list of integration points (e.g., auth, routing, layout), file name + 1 sentence summary of the role the file plays.

**DO NOT USE MARKDOWN, USE PLAIN TEXT**
**DO NOT INCLUDE ADDITIONAL TEXT**

File:
${filePath}

Code:
${code}`;

export class VectorStore {
	private connection: Connection | null = null;
	private table: Table | null = null;
	private numDimensions: number;
	private tableName = "vector_store";
	private indexName = "vector";
	private storageDirectory: string | null = null;
	private currentFilePaths: Set<string> = new Set();
	private embedder: Embeddings;
	private summaryModel: BaseChatModel;
	private connect?: (
		uri: string,
		options?: Partial<ConnectionOptions>,
	) => Promise<Connection>;
	private indexCreated = false;
	private pendingVectors = 0;

	/**
	 * Creates a new vector store
	 * @param settings Application settings
	 * @param workspace Current workspace path
	 * @param storageDirectory Directory to persist the index (required for LanceDB)
	 */
	constructor(
		private readonly settings: Settings,
		private readonly workspace: string,
		storageDirectory: string | null = null,
	) {
		const embeddingSettings =
			settings.embeddingSettings[settings.embeddingProvider];
		const embeddingProvider = CreateEmbeddingProvider(
			settings,
			loggingProvider,
		);
		this.embedder = embeddingProvider.getEmbedder();
		this.summaryModel = embeddingProvider.getLightweightModel();

		this.numDimensions = embeddingSettings?.dimensions!;
		this.storageDirectory =
			storageDirectory || path.join(process.cwd(), ".lancedb");
	}

	/**
	 * Initialize LanceDB connection and table
	 */
	async initialize() {
		try {
			this.connect = await loadLanceDB();

			// Connect to LanceDB (creates directory if it doesn't exist)
			this.connection = await this.connect(this.storageDirectory!);

			// Check if the table exists
			const tableExists = await this.tableExists();

			try {
				if (tableExists) {
					this.table = await this.connection.openTable(this.tableName);

					// Check if index exists
					try {
						const indexStats = await this.table.indexStats(this.indexName);
						this.indexCreated = !!indexStats;
					} catch (e) {
						console.log(
							"Could not determine index status, assuming not created",
						);
						this.indexCreated = false;
					}

					// Load existing files to track current entries
					await this.loadCurrentEntries();
					return;
				}
			} catch (e) {
				console.error("Failed to load table", e);
			}

			try {
				await this.removeIndex();
			} catch (e) {
				console.error("Failed to clean up old tables", e);
			}

			console.log("Creating table without index (lazy initialization)");

			// Create schema for the table
			const schema = new Schema([
				new Field("filePath", new arrow.Utf8()),
				new Field("summary", new arrow.Utf8()),
				new Field(
					"vector",
					new arrow.FixedSizeList(
						typeof this.numDimensions === "number"
							? this.numDimensions
							: Number.parseInt(this.numDimensions),
						new Field("item", new arrow.Float32(), true),
					),
				),
				new Field("lastModified", new arrow.Int64(), true),
			]);

			// Create new table with the schema but no index yet
			this.table = await this.connection.createTable(
				this.tableName,
				[], // Start with an empty table
				{
					schema,
				},
			);

			this.indexCreated = false;
			console.log("LanceDB Vector Store initialized (without index)");
		} catch (error) {
			console.error("Failed to initialize LanceDB:", error);
			throw error;
		}
	}

	/**
	 * Check if the table exists in the database
	 */
	private async tableExists(): Promise<boolean> {
		try {
			const tables = await this.connection!.tableNames();
			console.log("Available tables:", tables);
			return tables.includes(this.tableName);
		} catch (error) {
			return false;
		}
	}

	/**
	 * Load existing entries from the table to track current files
	 */
	private async loadCurrentEntries() {
		try {
			// Reset tracking data
			this.currentFilePaths.clear();

			// Query all entries - using column name without quotes
			for await (const batch of this.table!.query().select(["filePath"])) {
				for (const item of batch.toArray()) {
					const row = item as unknown as { filePath: string };
					this.currentFilePaths.add(row.filePath);
				}
			}

			this.pendingVectors = this.currentFilePaths.size;
			console.log(`Loaded ${this.currentFilePaths.size} entries`);
		} catch (error) {
			console.error("Failed to load current entries:", error);
		}
	}

	/**
	 * Create the vector index when we have enough vectors
	 * This is called after adding vectors to ensure we have enough data
	 */
	private async createIndexIfNeeded() {
		// Only try to create the index if we haven't already and we have enough vectors
		if (!this.indexCreated && this.pendingVectors >= 256) {
			try {
				console.log(`Creating index with ${this.pendingVectors} vectors`);
				await this.table!.createIndex(this.indexName);
				this.indexCreated = true;
				console.log("Vector index created successfully");
			} catch (error) {
				console.error("Failed to create index:", error);
				// Don't set indexCreated to true if it failed
			}
		}
	}

	async shouldUpdateFile(
		filePath: string,
		metadata: Omit<VectorMetadata, "filePath"> = {},
	): Promise<boolean> {
		await this.ensureInitialized();

		if (this.currentFilePaths.has(filePath)) {
			const existingData = await this.table!.query()
				.where(`"filePath" = '${filePath}'`)
				.select(["lastModified"])
				.toArray();

			if (
				existingData.length > 0 &&
				existingData[0].lastModified === metadata.lastModified
			) {
				console.log(`File: ${filePath} hasn't changed, skipping indexing`);
				return false;
			}

			return true;
		}

		return true;
	}

	/**
	 * Add or update a vector in the store
	 * @param filePath The path to the file this vector represents
	 * @param fileContents The contents of the file
	 * @param metadata Additional metadata to store
	 * @returns The file path of the inserted/updated vector
	 */
	async upsert(
		filePath: string,
		fileContents: string,
		metadata: Omit<VectorMetadata, "filePath"> = {},
	): Promise<string> {
		await this.ensureInitialized();

		const fullMetadata: VectorMetadata = {
			filePath,
			...metadata,
		};

		const shouldUpdate = await this.shouldUpdateFile(filePath, metadata);

		if (!shouldUpdate) return filePath;

		const summary = (
			await this.summaryModel.invoke(
				buildSummarizationQuery(
					fileContents,
					path.relative(this.workspace, filePath),
				),
			)
		).content.toString();
		const vector = await this.embedder.embedQuery(summary);

		if (this.currentFilePaths.has(filePath)) {
			console.log(`Index - Updating file: ${filePath}`);

			// Update existing file
			await this.table!.update({
				where: `filePath = '${filePath}'`,
				values: {
					summary,
					vector: vector,
					lastModified: fullMetadata.lastModified!,
				},
			});
		} else {
			console.log(`Index - Adding file: ${filePath}`);

			// New file, add it
			await this.table!.add([
				{
					filePath,
					vector,
					summary,
					lastModified: fullMetadata.lastModified,
					...metadata,
				},
			]);

			this.currentFilePaths.add(filePath);
			this.pendingVectors++;

			// Try to create the index if we've reached the threshold
			await this.createIndexIfNeeded();
		}

		return filePath;
	}

	/**
	 * Remove a vector by file path
	 * @param filePath The path to the file to remove
	 * @returns true if the file was found and removed, false otherwise
	 */
	async remove(filePath: string): Promise<boolean> {
		await this.ensureInitialized();

		if (this.currentFilePaths.has(filePath)) {
			// Delete the file from the table
			await this.table!.delete(`filePath = '${filePath}'`);
			this.currentFilePaths.delete(filePath);
			this.pendingVectors--;
			return true;
		}

		return false;
	}

	/**
	 * Handle file renaming/moving
	 * @param oldPath Original file path
	 * @param newPath New file path
	 * @returns true if the file was found and renamed, false otherwise
	 */
	async moveFile(oldPath: string, newPath: string): Promise<boolean> {
		await this.ensureInitialized();

		if (this.currentFilePaths.has(oldPath)) {
			await this.table!.update({
				where: `filePath = '${oldPath}'`,
				values: { filePath: newPath },
			});

			this.currentFilePaths.delete(oldPath);
			this.currentFilePaths.add(newPath);

			return true;
		}

		return false;
	}

	/**
	 * Search for similar vectors
	 * @param queryVector The query vector
	 * @param k Number of results to return
	 * @returns Array of search results sorted by similarity (highest first)
	 */
	async search(queryVector: number[], k = 5): Promise<SearchResult[]> {
		await this.ensureInitialized();

		if (this.currentFilePaths.size === 0) return [];

		// Adjust k if we have fewer items than requested
		const effectiveK = Math.min(k, this.currentFilePaths.size);
		if (effectiveK === 0) return [];

		try {
			// If we don't have an index yet, use brute force search
			const results = await this.table!.search(queryVector, "vector")
				.limit(effectiveK)
				.toArray();

			// Transform results to match the expected output format
			const searchResults: SearchResult[] = results.map((item) => {
				// Create metadata object from all item properties except internal ones
				const metadata: VectorMetadata = { filePath: item.filePath };

				// Add all other properties to metadata
				for (const [key, value] of Object.entries(item)) {
					if (!["vector", "_distance"].includes(key)) {
						metadata[key] = value;
					}
				}

				return {
					filePath: item.filePath,
					summary: item.summary,
					similarity: 1 - item._distance, // Convert distance to similarity
					metadata,
				};
			});

			return searchResults;
		} catch (error) {
			console.error("Search failed:", error);
			return [];
		}
	}

	/**
	 * Ensure the database connection and table are initialized
	 */
	private async ensureInitialized() {
		if (!this.connection || !this.table) {
			await this.initialize();
		}
	}

	/**
	 * Remove the database
	 */
	public async removeIndex() {
		if (!this.connection) return;

		try {
			// Drop the table if it exists
			const tableNames = await this.connection!.tableNames();
			if (tableNames.includes(this.tableName)) {
				this.table = await this.connection!.openTable(this.tableName);

				// Only try to drop the index if it was created
				if (this.indexCreated) {
					try {
						await this.table.dropIndex(this.indexName);
					} catch (e) {
						console.log("Index may not exist, continuing with table removal");
					}
				}

				await this.connection!.dropTable(this.tableName);
				console.log("Removing index table:", this.tableName);
			}

			// Reset state
			this.table = null;
			this.currentFilePaths.clear();
			this.indexCreated = false;
			this.pendingVectors = 0;
		} catch (error) {
			console.error("Failed to remove index:", error);
		}
	}

	/**
	 * Get statistics about the vector store
	 */
	async getStats() {
		await this.ensureInitialized();

		try {
			return {
				totalVectors: this.currentFilePaths.size,
				dimensions: this.numDimensions,
				indexCreated: this.indexCreated,
			};
		} catch (error) {
			console.error("Failed to get stats:", error);
			return {
				totalVectors: this.currentFilePaths.size,
				dimensions: this.numDimensions,
				indexCreated: this.indexCreated,
			};
		}
	}
}
