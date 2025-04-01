import type { RunnableConfig } from "@langchain/core/runnables";
import {
	BaseCheckpointSaver,
	type Checkpoint,
	type CheckpointListOptions,
	type CheckpointTuple,
	type SerializerProtocol,
	type PendingWrite,
	type CheckpointMetadata,
	TASKS,
	copyCheckpoint,
} from "@langchain/langgraph-checkpoint";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

// Store type definitions
interface CheckpointRecord {
	thread_id: string;
	checkpoint_ns: string;
	checkpoint_id: string;
	parent_checkpoint_id?: string;
	type?: string;
	checkpoint: string; // Base64 encoded if binary or path to file if large
	metadata: string; // Base64 encoded if binary
	is_binary?: boolean; // Flag to indicate if data is base64 encoded
	is_file?: boolean; // Flag to indicate if checkpoint is stored in a separate file
}

interface WriteRecord {
	thread_id: string;
	checkpoint_ns: string;
	checkpoint_id: string;
	task_id: string;
	idx: number;
	channel: string;
	type?: string;
	value: string; // Base64 encoded if binary or path to file if large
	is_binary?: boolean; // Flag to indicate if data is base64 encoded
	is_file?: boolean; // Flag to indicate if value is stored in a separate file
}

interface IndexData {
	threads: string[];
	checkpointCount: number;
	lastUpdated: string;
}

// Validate metadata keys for filtering
const checkpointMetadataKeys = ["source", "step", "writes", "parents"] as const;

type CheckKeys<T, K extends readonly (keyof T)[]> = [K[number]] extends [
	keyof T,
]
	? [keyof T] extends [K[number]]
		? K
		: never
	: never;

function validateKeys<T, K extends readonly (keyof T)[]>(
	keys: CheckKeys<T, K>,
): K {
	return keys;
}

const validCheckpointMetadataKeys = validateKeys<
	CheckpointMetadata,
	typeof checkpointMetadataKeys
>(checkpointMetadataKeys);

// Size threshold for storing data in separate files (5MB)
const FILE_SIZE_THRESHOLD = 5 * 1024 * 1024;

export class PartitionedFileSystemSaver extends BaseCheckpointSaver {
	private baseDir: string;
	private indexPath: string;
	private checkpointsDir: string;
	private writesDir: string;
	private dataDir: string;
	private threadMap: Map<string, Map<string, CheckpointRecord>> = new Map();
	private writeMap: Map<string, WriteRecord[]> = new Map();
	private loadedThreads: Set<string> = new Set();
	private dirtyThreads: Set<string> = new Set();
	private index: IndexData = {
		threads: [],
		checkpointCount: 0,
		lastUpdated: new Date().toISOString(),
	};
	private indexLoaded = false;

	/**
	 * Creates a new PartitionedFileSystemSaver instance
	 * @param baseDir Directory where checkpoints will be stored
	 * @param serde Optional serializer protocol
	 */
	constructor(baseDir: string, serde?: SerializerProtocol) {
		super(serde);
		this.baseDir = baseDir;
		this.indexPath = path.join(baseDir, "index.json");
		this.checkpointsDir = path.join(baseDir, "checkpoints");
		this.writesDir = path.join(baseDir, "writes");
		this.dataDir = path.join(baseDir, "data");
		this.ensureDirectories();
	}

	/**
	 * Ensures all required directories exist
	 */
	private ensureDirectories(): void {
		// biome-ignore lint/complexity/noForEach: <explanation>
		[this.baseDir, this.checkpointsDir, this.writesDir, this.dataDir].forEach(
			(dir) => {
				if (!fs.existsSync(dir)) {
					fs.mkdirSync(dir, { recursive: true });
				}
			},
		);
	}

	/**
	 * Helper function to create a hash of a string
	 */
	private hashString(str: string): string {
		return crypto.createHash("md5").update(str).digest("hex");
	}

	/**
	 * Loads the central index file
	 */
	private loadIndex(): void {
		if (this.indexLoaded) return;

		try {
			if (fs.existsSync(this.indexPath)) {
				const fileData = fs.readFileSync(this.indexPath, "utf8");
				this.index = JSON.parse(fileData);
			} else {
				// Create default index
				this.index = {
					threads: [],
					checkpointCount: 0,
					lastUpdated: new Date().toISOString(),
				};
				this.saveIndex();
			}
		} catch (error) {
			console.warn(`Error loading index: ${error}`);
			// Continue with default index if loading fails
		}

		this.indexLoaded = true;
	}

	/**
	 * Saves the central index file
	 */
	private saveIndex(): void {
		try {
			const serialized = JSON.stringify(this.index);
			fs.writeFileSync(this.indexPath, serialized, "utf8");
		} catch (error) {
			console.error(`Error saving index: ${error}`);
		}
	}

	/**
	 * Gets the path to a thread's checkpoint file
	 */
	private getThreadCheckpointsPath(
		threadId: string,
		checkpoint_ns = "",
	): string {
		const hashedId = this.hashString(`${threadId}_${checkpoint_ns}`);
		return path.join(this.checkpointsDir, `${hashedId}.json`);
	}

	/**
	 * Gets the path to a thread's writes file
	 */
	private getThreadWritesPath(threadId: string, checkpoint_ns = ""): string {
		const hashedId = this.hashString(`${threadId}_${checkpoint_ns}`);
		return path.join(this.writesDir, `${hashedId}.json`);
	}

	/**
	 * Gets the path for storing large data
	 */
	private getDataPath(id: string): string {
		const hashedId = this.hashString(id);
		return path.join(this.dataDir, `${hashedId}.data`);
	}

	/**
	 * Loads thread data (checkpoints and writes) from disk if not already loaded
	 */
	private loadThread(threadId: string, checkpoint_ns = ""): void {
		const threadKey = `${threadId}:${checkpoint_ns}`;
		if (this.loadedThreads.has(threadKey)) return;

		this.loadIndex();

		// Check if thread exists in the index
		if (!this.index.threads.includes(threadKey)) {
			// New thread, just mark as loaded
			this.loadedThreads.add(threadKey);
			this.threadMap.set(threadKey, new Map());
			return;
		}

		// Load checkpoints
		const checkpointsPath = this.getThreadCheckpointsPath(
			threadId,
			checkpoint_ns,
		);
		try {
			if (fs.existsSync(checkpointsPath)) {
				const checkpointsData = fs.readFileSync(checkpointsPath, "utf8");
				const checkpoints = JSON.parse(checkpointsData) as Record<
					string,
					CheckpointRecord
				>;
				this.threadMap.set(threadKey, new Map(Object.entries(checkpoints)));
			} else {
				this.threadMap.set(threadKey, new Map());
			}
		} catch (error) {
			console.warn(
				`Error loading checkpoints for thread ${threadKey}: ${error}`,
			);
			this.threadMap.set(threadKey, new Map());
		}

		// Load writes
		const writesPath = this.getThreadWritesPath(threadId, checkpoint_ns);
		try {
			if (fs.existsSync(writesPath)) {
				const writesData = fs.readFileSync(writesPath, "utf8");
				const writes = JSON.parse(writesData) as Record<string, WriteRecord[]>;

				for (const [key, value] of Object.entries(writes)) {
					this.writeMap.set(key, value);
				}
			}
		} catch (error) {
			console.warn(`Error loading writes for thread ${threadKey}: ${error}`);
		}

		this.loadedThreads.add(threadKey);
	}

	/**
	 * Saves a thread's data to disk
	 */
	private saveThread(threadId: string, checkpoint_ns = ""): void {
		const threadKey = `${threadId}:${checkpoint_ns}`;
		if (!this.dirtyThreads.has(threadKey)) return;

		this.loadIndex();

		// Add thread to index if not already there
		if (!this.index.threads.includes(threadKey)) {
			this.index.threads.push(threadKey);
			this.saveIndex();
		}

		// Save checkpoints
		const threadCheckpoints = this.threadMap.get(threadKey);
		if (threadCheckpoints) {
			const checkpointsPath = this.getThreadCheckpointsPath(
				threadId,
				checkpoint_ns,
			);
			try {
				const checkpointsData = JSON.stringify(
					Object.fromEntries(threadCheckpoints),
				);
				fs.writeFileSync(checkpointsPath, checkpointsData, "utf8");
			} catch (error) {
				console.error(
					`Error saving checkpoints for thread ${threadKey}: ${error}`,
				);
			}
		}

		// Save writes - collect all writes that belong to this thread
		const threadWrites: Record<string, WriteRecord[]> = {};
		for (const [key, value] of this.writeMap.entries()) {
			if (key.startsWith(threadKey)) {
				threadWrites[key] = value;
			}
		}

		const writesPath = this.getThreadWritesPath(threadId, checkpoint_ns);
		try {
			const writesData = JSON.stringify(threadWrites);
			fs.writeFileSync(writesPath, writesData, "utf8");
		} catch (error) {
			console.error(`Error saving writes for thread ${threadKey}: ${error}`);
		}

		this.dirtyThreads.delete(threadKey);
	}

	/**
	 * Helper method to serialize data, using files for large data
	 */
	private serializeData(
		data: string | Uint8Array,
		id: string,
	): { value: string; is_binary: boolean; is_file: boolean } {
		// For string data
		if (typeof data === "string") {
			// Check if the string is large enough to store in a file
			if (data.length > FILE_SIZE_THRESHOLD) {
				const filePath = this.getDataPath(id);
				fs.writeFileSync(filePath, data, "utf8");
				return { value: filePath, is_binary: false, is_file: true };
			}
			return { value: data, is_binary: false, is_file: false };
		}

		// For binary data
		if (data.byteLength > FILE_SIZE_THRESHOLD) {
			const filePath = this.getDataPath(id);
			fs.writeFileSync(filePath, Buffer.from(data));
			return { value: filePath, is_binary: true, is_file: true };
		}

		return {
			value: Buffer.from(data).toString("base64"),
			is_binary: true,
			is_file: false,
		};
	}

	/**
	 * Helper method to deserialize data
	 */
	private deserializeData(
		data: string,
		is_binary = false,
		is_file = false,
	): string | Uint8Array {
		if (is_file) {
			// Data is stored in a file
			if (fs.existsSync(data)) {
				const fileData = fs.readFileSync(data);
				// Try to detect if this is a JSON string to avoid binary misinterpretation
				if (!is_binary) {
					try {
						// Test if it's valid JSON by parsing
						JSON.parse(fileData.toString("utf8"));
						return fileData.toString("utf8");
					} catch (e) {
						// If parsing fails, treat as binary
						return fileData;
					}
				}
				return fileData; // Return as buffer for binary data
			}
			throw new Error(`File not found: ${data}`);
		}

		// Data is inline
		if (!is_binary) {
			return data;
		}

		return Buffer.from(data, "base64");
	}

	/**
	 * Creates a unique key for checkpoints
	 */
	private makeCheckpointKey(
		thread_id: string,
		checkpoint_ns: string,
		checkpoint_id: string,
	): string {
		return `${thread_id}:${checkpoint_ns}:${checkpoint_id}`;
	}

	/**
	 * Creates a unique key for writes
	 */
	private makeWritesKey(
		thread_id: string,
		checkpoint_ns: string,
		checkpoint_id: string,
	): string {
		return `${thread_id}:${checkpoint_ns}:${checkpoint_id}`;
	}

	/**
	 * Retrieves a checkpoint tuple by config
	 */
	async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
		const {
			thread_id,
			checkpoint_ns = "",
			checkpoint_id,
		} = config.configurable ?? {};

		if (!thread_id) {
			return undefined;
		}

		// Load thread data
		this.loadThread(thread_id, checkpoint_ns);
		const threadKey = `${thread_id}:${checkpoint_ns}`;
		const threadCheckpoints = this.threadMap.get(threadKey);

		if (!threadCheckpoints || threadCheckpoints.size === 0) {
			return undefined;
		}

		let record: CheckpointRecord | undefined;

		if (checkpoint_id) {
			// Get specific checkpoint
			const key = this.makeCheckpointKey(
				thread_id,
				checkpoint_ns,
				checkpoint_id,
			);
			record = threadCheckpoints.get(key);
		} else {
			// Get latest checkpoint by sorting correctly
			// Ensure proper sorting of IDs - assuming they're timestamp-based or sequential
			const sortedCheckpoints = Array.from(threadCheckpoints.values()).sort(
				(a, b) => {
					// Try numerical comparison first (for timestamp-based IDs)
					const numA = Number(a.checkpoint_id);
					const numB = Number(b.checkpoint_id);

					if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
						return numB - numA; // Descending order
					}

					// Fall back to string comparison
					return b.checkpoint_id.localeCompare(a.checkpoint_id);
				},
			);

			record = sortedCheckpoints[0];
		}

		if (!record) {
			return undefined;
		}

		// Create final config with checkpoint_id if it wasn't provided
		let finalConfig = config;
		if (!checkpoint_id) {
			finalConfig = {
				configurable: {
					thread_id: record.thread_id,
					checkpoint_ns,
					checkpoint_id: record.checkpoint_id,
				},
			};
		}

		if (
			finalConfig.configurable?.thread_id === undefined ||
			finalConfig.configurable?.checkpoint_id === undefined
		) {
			throw new Error("Missing thread_id or checkpoint_id");
		}

		// Get writes for this checkpoint
		const writesKey = this.makeWritesKey(
			record.thread_id,
			record.checkpoint_ns,
			record.checkpoint_id,
		);
		const checkpointWrites = this.writeMap.get(writesKey) || [];

		// Process pending writes
		const pendingWrites = await Promise.all(
			checkpointWrites.map(async (write) => {
				const deserializedValue = this.deserializeData(
					write.value,
					write.is_binary,
					write.is_file,
				);
				return [
					write.task_id,
					write.channel,
					await this.serde.loadsTyped(write.type ?? "json", deserializedValue),
				] as [string, string, unknown];
			}),
		);

		// Get pending sends (tasks from parent checkpoint)
		const pendingSends: unknown[] = [];
		if (record.parent_checkpoint_id) {
			const parentWritesKey = this.makeWritesKey(
				record.thread_id,
				record.checkpoint_ns,
				record.parent_checkpoint_id,
			);
			const parentWrites = this.writeMap.get(parentWritesKey) || [];

			// Get task writes from parent
			const taskWrites = parentWrites.filter(
				(write) => write.channel === TASKS,
			);

			// Sort by index
			taskWrites.sort((a, b) => a.idx - b.idx);

			// Process the sends
			for (const send of taskWrites) {
				const deserializedValue = this.deserializeData(
					send.value,
					send.is_binary,
					send.is_file,
				);
				pendingSends.push(
					await this.serde.loadsTyped(send.type ?? "json", deserializedValue),
				);
			}
		}

		try {
			// Deserialize checkpoint and add pending_sends
			const deserializedCheckpoint = this.deserializeData(
				record.checkpoint,
				record.is_binary,
				record.is_file,
			);
			const checkpointObj = {
				...(await this.serde.loadsTyped(
					record.type ?? "json",
					deserializedCheckpoint,
				)),
				pending_sends: pendingSends,
			} as Checkpoint;

			// Deserialize metadata
			const deserializedMetadata = this.deserializeData(
				record.metadata,
				record.is_binary,
			);
			const metadataObj = (await this.serde.loadsTyped(
				record.type ?? "json",
				deserializedMetadata,
			)) as CheckpointMetadata;

			// Construct the checkpoint tuple
			return {
				checkpoint: checkpointObj,
				config: finalConfig,
				metadata: metadataObj,
				parentConfig: record.parent_checkpoint_id
					? {
							configurable: {
								thread_id: record.thread_id,
								checkpoint_ns: record.checkpoint_ns,
								checkpoint_id: record.parent_checkpoint_id,
							},
						}
					: undefined,
				pendingWrites,
			};
		} catch (error) {
			console.error("Error deserializing checkpoint data:", error);
			console.error("Record type:", record.type);
			console.error("Is binary:", record.is_binary);
			console.error("Is file:", record.is_file);
			// Either return undefined or rethrow with more context
			return undefined;
		}
	}

	/**
	 * List checkpoints with optional filtering
	 */
	async *list(
		config: RunnableConfig,
		options?: CheckpointListOptions,
	): AsyncGenerator<CheckpointTuple> {
		const { limit, before, filter } = options ?? {};
		const thread_id = config.configurable?.thread_id;
		const checkpoint_ns = config.configurable?.checkpoint_ns ?? "";

		if (!thread_id) {
			return;
		}

		// Load thread data
		this.loadThread(thread_id, checkpoint_ns);
		const threadKey = `${thread_id}:${checkpoint_ns}`;
		const threadCheckpoints = this.threadMap.get(threadKey);

		if (!threadCheckpoints || threadCheckpoints.size === 0) {
			return;
		}

		// Filter sanitization - only allow valid metadata keys
		const sanitizedFilter = Object.fromEntries(
			Object.entries(filter ?? {}).filter(
				([key, value]) =>
					value !== undefined &&
					validCheckpointMetadataKeys.includes(key as keyof CheckpointMetadata),
			),
		);

		// Get all checkpoints for this thread
		let matches = Array.from(threadCheckpoints.values());

		// Apply "before" filter if specified
		if (before?.configurable?.checkpoint_id) {
			const beforeId = before.configurable.checkpoint_id;
			matches = matches.filter((record) => record.checkpoint_id < beforeId);
		}

		// Apply metadata filters
		if (Object.keys(sanitizedFilter).length > 0) {
			const filteredMatches: CheckpointRecord[] = [];

			for (const record of matches) {
				const deserializedMetadata = this.deserializeData(
					record.metadata,
					record.is_binary,
				);
				const metadata = (await this.serde.loadsTyped(
					record.type ?? "json",
					deserializedMetadata,
				)) as CheckpointMetadata;

				let includeRecord = true;
				for (const [key, value] of Object.entries(sanitizedFilter)) {
					if (
						JSON.stringify(metadata[key as keyof CheckpointMetadata]) !==
						JSON.stringify(value)
					) {
						includeRecord = false;
						break;
					}
				}

				if (includeRecord) {
					filteredMatches.push(record);
				}
			}

			matches = filteredMatches;
		}

		// Sort in descending order by checkpoint_id
		matches.sort((a, b) => {
			// Try numerical comparison first (for timestamp-based IDs)
			const numA = Number(a.checkpoint_id);
			const numB = Number(b.checkpoint_id);

			if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
				return numB - numA; // Descending order
			}

			// Fall back to string comparison
			return b.checkpoint_id.localeCompare(a.checkpoint_id);
		});

		// Apply limit if specified
		if (limit !== undefined) {
			matches = matches.slice(0, Number.parseInt(String(limit), 10));
		}

		// Process and yield each matching checkpoint
		for (const record of matches) {
			// Get writes for this checkpoint
			const writesKey = this.makeWritesKey(
				record.thread_id,
				record.checkpoint_ns,
				record.checkpoint_id,
			);
			const checkpointWrites = this.writeMap.get(writesKey) || [];

			// Process pending writes
			const pendingWrites = await Promise.all(
				checkpointWrites.map(async (write) => {
					const deserializedValue = this.deserializeData(
						write.value,
						write.is_binary,
						write.is_file,
					);
					return [
						write.task_id,
						write.channel,
						await this.serde.loadsTyped(
							write.type ?? "json",
							deserializedValue,
						),
					] as [string, string, unknown];
				}),
			);

			// Get pending sends (tasks from parent checkpoint)
			const pendingSends: unknown[] = [];
			if (record.parent_checkpoint_id) {
				const parentWritesKey = this.makeWritesKey(
					record.thread_id,
					record.checkpoint_ns,
					record.parent_checkpoint_id,
				);
				const parentWrites = this.writeMap.get(parentWritesKey) || [];

				// Get task writes from parent
				const taskWrites = parentWrites.filter(
					(write) => write.channel === TASKS,
				);

				// Sort by index
				taskWrites.sort((a, b) => a.idx - b.idx);

				// Process the sends
				for (const send of taskWrites) {
					const deserializedValue = this.deserializeData(
						send.value,
						send.is_binary,
						send.is_file,
					);
					pendingSends.push(
						await this.serde.loadsTyped(send.type ?? "json", deserializedValue),
					);
				}
			}

			// Deserialize checkpoint and add pending_sends
			const deserializedCheckpoint = this.deserializeData(
				record.checkpoint,
				record.is_binary,
				record.is_file,
			);
			const checkpointObj = {
				...(await this.serde.loadsTyped(
					record.type ?? "json",
					deserializedCheckpoint,
				)),
				pending_sends: pendingSends,
			} as Checkpoint;

			// Deserialize metadata
			const deserializedMetadata = this.deserializeData(
				record.metadata,
				record.is_binary,
			);
			const metadataObj = (await this.serde.loadsTyped(
				record.type ?? "json",
				deserializedMetadata,
			)) as CheckpointMetadata;

			// Construct and yield the checkpoint tuple
			yield {
				config: {
					configurable: {
						thread_id: record.thread_id,
						checkpoint_ns: record.checkpoint_ns,
						checkpoint_id: record.checkpoint_id,
					},
				},
				checkpoint: checkpointObj,
				metadata: metadataObj,
				parentConfig: record.parent_checkpoint_id
					? {
							configurable: {
								thread_id: record.thread_id,
								checkpoint_ns: record.checkpoint_ns,
								checkpoint_id: record.parent_checkpoint_id,
							},
						}
					: undefined,
				pendingWrites,
			};
		}
	}

	/**
	 * Store a checkpoint
	 */
	async put(
		config: RunnableConfig,
		checkpoint: Checkpoint,
		metadata: CheckpointMetadata,
	): Promise<RunnableConfig> {
		if (!config.configurable) {
			throw new Error("Empty configuration supplied.");
		}

		const thread_id = config.configurable?.thread_id;
		const checkpoint_ns = config.configurable?.checkpoint_ns ?? "";
		const parent_checkpoint_id = config.configurable?.checkpoint_id;

		if (!thread_id) {
			throw new Error(
				`Missing "thread_id" field in passed "config.configurable".`,
			);
		}

		// Prepare checkpoint for serialization (remove pending_sends)
		const preparedCheckpoint: Partial<Checkpoint> = copyCheckpoint(checkpoint);
		// biome-ignore lint/performance/noDelete: <explanation>
		delete preparedCheckpoint.pending_sends;

		// Serialize checkpoint and metadata
		const [type1, serializedCheckpoint] =
			this.serde.dumpsTyped(preparedCheckpoint);
		const [type2, serializedMetadata] = this.serde.dumpsTyped(metadata);

		if (type1 !== type2) {
			throw new Error(
				"Failed to serialize checkpoint and metadata to the same type.",
			);
		}

		// Generate a unique ID for this data
		const dataId = `${thread_id}:${checkpoint_ns}:${checkpoint.id}`;

		// Handle large checkpoint data and binary data
		const {
			value: checkpointValue,
			is_binary: checkpointIsBinary,
			is_file: checkpointIsFile,
		} = this.serializeData(serializedCheckpoint, `${dataId}_checkpoint`);

		// Metadata is usually small, but handle it the same way
		const {
			value: metadataValue,
			is_binary: metadataIsBinary,
			is_file: metadataIsFile,
		} = this.serializeData(serializedMetadata, `${dataId}_metadata`);

		// Create the checkpoint record
		const record: CheckpointRecord = {
			thread_id,
			checkpoint_ns,
			checkpoint_id: checkpoint.id,
			parent_checkpoint_id,
			type: type1,
			checkpoint: checkpointValue,
			metadata: metadataValue,
			is_binary: checkpointIsBinary,
			is_file: checkpointIsFile,
		};

		// Load thread data if not already loaded
		this.loadThread(thread_id, checkpoint_ns);
		const threadKey = `${thread_id}:${checkpoint_ns}`;

		// Store the checkpoint
		const key = this.makeCheckpointKey(thread_id, checkpoint_ns, checkpoint.id);
		const threadCheckpoints = this.threadMap.get(threadKey);
		if (threadCheckpoints) {
			threadCheckpoints.set(key, record);
			this.dirtyThreads.add(threadKey);

			// Update the index
			this.loadIndex();
			this.index.checkpointCount++;
			this.index.lastUpdated = new Date().toISOString();
			this.saveIndex();

			// Save the thread data
			this.saveThread(thread_id, checkpoint_ns);
		}

		// Important: Return the new checkpoint ID in the config
		// This ensures the state machine knows which checkpoint to use next
		return {
			configurable: {
				thread_id,
				checkpoint_ns,
				checkpoint_id: checkpoint.id,
			},
		};
	}

	/**
	 * Store pending writes for a checkpoint
	 */
	async putWrites(
		config: RunnableConfig,
		writes: PendingWrite[],
		taskId: string,
	): Promise<void> {
		if (!config.configurable) {
			throw new Error("Empty configuration supplied.");
		}

		if (!config.configurable?.thread_id) {
			throw new Error("Missing thread_id field in config.configurable.");
		}

		if (!config.configurable?.checkpoint_id) {
			throw new Error("Missing checkpoint_id field in config.configurable.");
		}

		const thread_id = config.configurable.thread_id;
		const checkpoint_ns = config.configurable.checkpoint_ns ?? "";
		const checkpoint_id = config.configurable.checkpoint_id;

		// Load thread data
		this.loadThread(thread_id, checkpoint_ns);
		const threadKey = `${thread_id}:${checkpoint_ns}`;

		// Create write records
		const writeRecords: WriteRecord[] = [];

		for (let idx = 0; idx < writes.length; idx++) {
			const write = writes[idx];
			const [type, serializedWrite] = this.serde.dumpsTyped(write[1]);

			// Generate a unique ID for this write data
			const writeId = `${thread_id}:${checkpoint_ns}:${checkpoint_id}:${taskId}:${idx}`;

			// Handle large data and binary data
			const { value, is_binary, is_file } = this.serializeData(
				serializedWrite,
				writeId,
			);

			writeRecords.push({
				thread_id,
				checkpoint_ns,
				checkpoint_id,
				task_id: taskId,
				idx,
				channel: write[0],
				type,
				value,
				is_binary,
				is_file,
			});
		}

		// Store the writes
		const key = this.makeWritesKey(thread_id, checkpoint_ns, checkpoint_id);
		this.writeMap.set(key, [
			...(this.writeMap.get(key) || []),
			...writeRecords,
		]);
		this.dirtyThreads.add(threadKey);

		// Save thread data
		this.saveThread(thread_id, checkpoint_ns);
	}

	/**
	 * Clear all stored data
	 */
	clear(): void {
		this.threadMap.clear();
		this.writeMap.clear();
		this.loadedThreads.clear();
		this.dirtyThreads.clear();

		try {
			// Remove all data files
			if (fs.existsSync(this.baseDir)) {
				// Remove all files in data directory
				if (fs.existsSync(this.dataDir)) {
					const files = fs.readdirSync(this.dataDir);
					for (const file of files) {
						fs.unlinkSync(path.join(this.dataDir, file));
					}
				}

				// Remove all files in checkpoints directory
				if (fs.existsSync(this.checkpointsDir)) {
					const files = fs.readdirSync(this.checkpointsDir);
					for (const file of files) {
						fs.unlinkSync(path.join(this.checkpointsDir, file));
					}
				}

				// Remove all files in writes directory
				if (fs.existsSync(this.writesDir)) {
					const files = fs.readdirSync(this.writesDir);
					for (const file of files) {
						fs.unlinkSync(path.join(this.writesDir, file));
					}
				}

				// Reset index
				this.index = {
					threads: [],
					checkpointCount: 0,
					lastUpdated: new Date().toISOString(),
				};
				this.saveIndex();
			}
		} catch (error) {
			console.error(`Error clearing checkpoint data: ${error}`);
		}
	}

	/**
	 * Force saving all pending changes
	 */
	flush(): void {
		for (const threadKey of this.dirtyThreads) {
			const [threadId, checkpoint_ns] = threadKey.split(":", 2);
			this.saveThread(threadId, checkpoint_ns);
		}
	}

	/**
	 * Remove specific thread data
	 * @param threadId The thread ID to remove
	 * @param checkpoint_ns Optional namespace (removes all namespaces if not specified)
	 */
	removeThread(threadId: string, checkpoint_ns?: string): void {
		this.loadIndex();

		const threadPrefix =
			checkpoint_ns !== undefined
				? `${threadId}:${checkpoint_ns}`
				: `${threadId}:`;

		// Get all thread keys to remove
		const threadsToRemove = this.index.threads.filter((t) =>
			t.startsWith(threadPrefix),
		);

		for (const threadKey of threadsToRemove) {
			const [tid, ns] = threadKey.split(":", 2);

			// Remove thread from memory
			this.threadMap.delete(threadKey);
			this.loadedThreads.delete(threadKey);
			this.dirtyThreads.delete(threadKey);

			// Remove thread files
			const checkpointsPath = this.getThreadCheckpointsPath(tid, ns);
			const writesPath = this.getThreadWritesPath(tid, ns);

			try {
				if (fs.existsSync(checkpointsPath)) {
					fs.unlinkSync(checkpointsPath);
				}

				if (fs.existsSync(writesPath)) {
					fs.unlinkSync(writesPath);
				}
			} catch (error) {
				console.error(`Error removing thread ${threadKey}: ${error}`);
			}

			// Remove thread from index
			this.index.threads = this.index.threads.filter((t) => t !== threadKey);
		}

		// Remove any writes associated with this thread
		const writeKeysToRemove: string[] = [];
		for (const key of this.writeMap.keys()) {
			if (key.startsWith(threadPrefix)) {
				writeKeysToRemove.push(key);
			}
		}

		for (const key of writeKeysToRemove) {
			this.writeMap.delete(key);
		}

		// Save index
		this.saveIndex();
	}

	/**
	 * Delete a thread or specific checkpoint(s)
	 * @param config Configuration specifying what to delete
	 * @returns Boolean indicating if deletion was successful
	 */
	async delete(config: RunnableConfig): Promise<boolean> {
		if (!config.configurable) {
			throw new Error("Empty configuration supplied for deletion.");
		}

		const thread_id = config.configurable.thread_id;
		const checkpoint_ns = config.configurable.checkpoint_ns ?? "";
		const checkpoint_id = config.configurable.checkpoint_id;

		if (!thread_id) {
			throw new Error("Missing thread_id field in config.configurable.");
		}

		this.loadIndex();
		const threadKey = `${thread_id}:${checkpoint_ns}`;

		// If checkpoint_id is provided, delete just that checkpoint
		if (checkpoint_id) {
			// Load thread data
			this.loadThread(thread_id, checkpoint_ns);
			const threadCheckpoints = this.threadMap.get(threadKey);

			if (!threadCheckpoints) {
				return false; // Thread not found
			}

			const key = this.makeCheckpointKey(
				thread_id,
				checkpoint_ns,
				checkpoint_id,
			);
			const record = threadCheckpoints.get(key);

			if (!record) {
				return false; // Checkpoint not found
			}

			// Delete the checkpoint record
			threadCheckpoints.delete(key);

			// Delete any associated data files
			if (record.is_file && fs.existsSync(record.checkpoint)) {
				try {
					fs.unlinkSync(record.checkpoint);
				} catch (error) {
					console.warn(
						`Error removing checkpoint file ${record.checkpoint}: ${error}`,
					);
				}
			}

			// Delete associated writes
			const writesKey = this.makeWritesKey(
				thread_id,
				checkpoint_ns,
				checkpoint_id,
			);
			const writes = this.writeMap.get(writesKey);

			if (writes) {
				// Delete any data files from writes
				for (const write of writes) {
					if (write.is_file && fs.existsSync(write.value)) {
						try {
							fs.unlinkSync(write.value);
						} catch (error) {
							console.warn(
								`Error removing write file ${write.value}: ${error}`,
							);
						}
					}
				}

				// Remove the writes entry
				this.writeMap.delete(writesKey);
			}

			// Mark thread as dirty and save changes
			this.dirtyThreads.add(threadKey);
			this.saveThread(thread_id, checkpoint_ns);

			// Update index count if needed
			this.index.checkpointCount--;
			this.index.lastUpdated = new Date().toISOString();
			this.saveIndex();

			return true;
		}

		// If no checkpoint_id is provided, delete the entire thread

		// Check if thread exists in the index
		if (!this.index.threads.includes(threadKey)) {
			return false; // Thread not found
		}

		// Find and delete all data files for this thread
		try {
			// Load thread data if not already loaded
			this.loadThread(thread_id, checkpoint_ns);
			const threadCheckpoints = this.threadMap.get(threadKey);

			if (threadCheckpoints) {
				// Get all checkpoint records for this thread
				const records = Array.from(threadCheckpoints.values());

				// Delete all data files for checkpoints
				for (const record of records) {
					if (record.is_file && fs.existsSync(record.checkpoint)) {
						fs.unlinkSync(record.checkpoint);
					}

					// Delete writes for this checkpoint
					const writesKey = this.makeWritesKey(
						record.thread_id,
						record.checkpoint_ns,
						record.checkpoint_id,
					);

					const writes = this.writeMap.get(writesKey);
					if (writes) {
						// Delete any file data from writes
						for (const write of writes) {
							if (write.is_file && fs.existsSync(write.value)) {
								fs.unlinkSync(write.value);
							}
						}

						// Remove the writes entry
						this.writeMap.delete(writesKey);
					}
				}
			}

			// Delete the thread checkpoint and writes files
			const checkpointsPath = this.getThreadCheckpointsPath(
				thread_id,
				checkpoint_ns,
			);
			const writesPath = this.getThreadWritesPath(thread_id, checkpoint_ns);

			if (fs.existsSync(checkpointsPath)) {
				fs.unlinkSync(checkpointsPath);
			}

			if (fs.existsSync(writesPath)) {
				fs.unlinkSync(writesPath);
			}

			// Remove the thread from memory
			this.threadMap.delete(threadKey);
			this.loadedThreads.delete(threadKey);
			this.dirtyThreads.delete(threadKey);

			// Remove the thread from index
			this.index.threads = this.index.threads.filter((t) => t !== threadKey);
			this.index.lastUpdated = new Date().toISOString();
			this.saveIndex();

			return true;
		} catch (error) {
			console.error(`Error deleting thread ${threadKey}: ${error}`);
			return false;
		}
	}

	/**
	 * Clean up old checkpoints to manage disk space.
	 * If threadId is provided, cleanup is limited to that thread.
	 * @param maxAge Maximum age in milliseconds
	 * @param maxCheckpointsPerThread Maximum number of checkpoints to keep per thread
	 * @param threadId Optional thread ID to limit cleanup scope
	 */
	cleanup(
		maxAge?: number,
		maxCheckpointsPerThread?: number,
		threadId?: string,
	): void {
		this.loadIndex();

		// Determine which threads to process
		let threadsToProcess: string[];
		if (threadId) {
			// Filter index threads to only include those matching the provided threadId
			threadsToProcess = this.index.threads.filter((t) =>
				t.startsWith(`${threadId}:`),
			);
		} else {
			// Process all threads if no specific threadId is given
			threadsToProcess = this.index.threads;
		}

		// Skip if nothing to clean
		if (threadsToProcess.length === 0) {
			return;
		}

		const now = Date.now();
		let removedCount = 0;

		// Process each selected thread
		for (const threadKey of threadsToProcess) {
			const [currentThreadId, checkpoint_ns] = threadKey.split(":", 2);

			// Load thread data
			this.loadThread(currentThreadId, checkpoint_ns);
			const threadCheckpoints = this.threadMap.get(threadKey);

			if (!threadCheckpoints || threadCheckpoints.size === 0) {
				continue;
			}

			// Sort checkpoints by ID descending (latest first)
			const checkpoints = Array.from(threadCheckpoints.values()).sort(
				(a, b) => {
					const numA = Number(a.checkpoint_id);
					const numB = Number(b.checkpoint_id);
					if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
						return numB - numA;
					}
					return b.checkpoint_id.localeCompare(a.checkpoint_id);
				},
			);

			// Keep track of checkpoints to remove
			const checkpointsToRemove: string[] = [];

			// Check age-based cleanup
			if (maxAge !== undefined && maxAge >= 0) {
				for (const checkpoint of checkpoints) {
					// Use checkpoint_id as timestamp if it's numerical
					const timestamp = Number.parseInt(checkpoint.checkpoint_id, 10);
					if (!Number.isNaN(timestamp) && now - timestamp > maxAge) {
						if (!checkpointsToRemove.includes(checkpoint.checkpoint_id)) {
							checkpointsToRemove.push(checkpoint.checkpoint_id);
						}
					}
				}
			}

			// Check count-based cleanup
			if (
				maxCheckpointsPerThread !== undefined &&
				maxCheckpointsPerThread >= 0
			) {
				if (checkpoints.length > maxCheckpointsPerThread) {
					// Keep the most recent checkpoints, remove the older ones
					for (let i = maxCheckpointsPerThread; i < checkpoints.length; i++) {
						if (!checkpointsToRemove.includes(checkpoints[i].checkpoint_id)) {
							checkpointsToRemove.push(checkpoints[i].checkpoint_id);
						}
					}
				}
			}

			// Remove the selected checkpoints
			for (const checkpoint_id of checkpointsToRemove) {
				const key = this.makeCheckpointKey(
					currentThreadId,
					checkpoint_ns,
					checkpoint_id,
				);
				const record = threadCheckpoints.get(key);

				if (record) {
					// Remove the checkpoint
					threadCheckpoints.delete(key);

					// Remove associated data files
					if (record.is_file && fs.existsSync(record.checkpoint)) {
						try {
							fs.unlinkSync(record.checkpoint);
						} catch (error) {
							console.warn(
								`Error removing checkpoint file ${record.checkpoint}: ${error}`,
							);
						}
					}

					// Remove associated writes
					const writesKey = this.makeWritesKey(
						currentThreadId,
						checkpoint_ns,
						checkpoint_id,
					);
					const writes = this.writeMap.get(writesKey);

					if (writes) {
						// Remove any data files associated with writes
						for (const write of writes) {
							if (write.is_file && fs.existsSync(write.value)) {
								try {
									fs.unlinkSync(write.value);
								} catch (error) {
									console.warn(
										`Error removing write file ${write.value}: ${error}`,
									);
								}
							}
						}

						// Remove the writes entry
						this.writeMap.delete(writesKey);
					}

					removedCount++;
				}
			}

			// Mark thread as dirty if we removed any checkpoints
			if (checkpointsToRemove.length > 0) {
				this.dirtyThreads.add(threadKey);
			}
		}

		// Save changes
		this.flush();

		// Update index
		if (removedCount > 0) {
			this.index.checkpointCount -= removedCount;
			this.index.lastUpdated = new Date().toISOString();
			this.saveIndex();
		}
	}
}
