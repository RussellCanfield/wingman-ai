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
import * as fs from 'fs';
import * as path from 'path';

// Store type definitions - supporting both string and binary data
interface CheckpointRecord {
    thread_id: string;
    checkpoint_ns: string;
    checkpoint_id: string;
    parent_checkpoint_id?: string;
    type?: string;
    checkpoint: string; // Base64 encoded if binary
    metadata: string; // Base64 encoded if binary
    is_binary?: boolean; // Flag to indicate if data is base64 encoded
}

interface WriteRecord {
    thread_id: string;
    checkpoint_ns: string;
    checkpoint_id: string;
    task_id: string;
    idx: number;
    channel: string;
    type?: string;
    value: string; // Base64 encoded if binary
    is_binary?: boolean; // Flag to indicate if data is base64 encoded
}

interface StoreData {
    checkpoints: Record<string, CheckpointRecord>;
    writes: Record<string, WriteRecord[]>;
}

// Validate metadata keys for filtering
const checkpointMetadataKeys = ["source", "step", "writes", "parents"] as const;

type CheckKeys<T, K extends readonly (keyof T)[]> = [K[number]] extends [keyof T]
    ? [keyof T] extends [K[number]]
    ? K
    : never
    : never;

function validateKeys<T, K extends readonly (keyof T)[]>(
    keys: CheckKeys<T, K>
): K {
    return keys;
}

const validCheckpointMetadataKeys = validateKeys<
    CheckpointMetadata,
    typeof checkpointMetadataKeys
>(checkpointMetadataKeys);

export class FileSystemCheckpointer extends BaseCheckpointSaver {
    private checkpoints: Map<string, CheckpointRecord> = new Map();
    private writes: Map<string, WriteRecord[]> = new Map();
    private storePath: string;
    private loaded: boolean = false;

    /**
     * Creates a new FileSystemCheckpointer instance
     * @param storePath Path to the file where checkpoints will be stored
     * @param serde Optional serializer protocol
     */
    constructor(storePath: string, serde?: SerializerProtocol) {
        super(serde);
        console.log('Agent Checkpointer: ', storePath);
        this.storePath = storePath;
        this.ensureDirectory();
    }

    /**
     * Ensures the directory exists for storing the checkpoint file
     */
    private ensureDirectory(): void {
        const directory = path.dirname(this.storePath);
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }
    }

    /**
     * Helper method to convert possibly binary data to string
     */
    private serializeData(data: string | Uint8Array): { value: string, is_binary: boolean } {
        if (typeof data === 'string') {
            return { value: data, is_binary: false };
        }
        return {
            value: Buffer.from(data).toString('base64'),
            is_binary: true
        };
    }

    /**
     * Helper method to deserialize data based on its type
     */
    private deserializeData(data: string, is_binary: boolean = false): string | Uint8Array {
        if (!is_binary) {
            return data;
        }
        return Buffer.from(data, 'base64');
    }

    /**
     * Loads data from disk if it exists and hasn't been loaded yet
     */
    private loadFromDisk(): void {
        if (this.loaded) return;

        try {
            if (fs.existsSync(this.storePath)) {
                const fileData = fs.readFileSync(this.storePath, 'utf8');
                const data: StoreData = JSON.parse(fileData);

                // Convert objects to Maps
                this.checkpoints = new Map(Object.entries(data.checkpoints));
                this.writes = new Map();

                for (const [key, value] of Object.entries(data.writes)) {
                    this.writes.set(key, value);
                }
            }
        } catch (error) {
            console.warn(`Error loading checkpoint data: ${error}`);
            // Continue with empty maps if loading fails
        }

        this.loaded = true;
    }

    /**
     * Saves current state to disk
     */
    private saveToDisk(): void {
        try {
            // Convert Maps to objects for serialization
            const data: StoreData = {
                checkpoints: Object.fromEntries(this.checkpoints),
                writes: Object.fromEntries(this.writes),
            };

            const serialized = JSON.stringify(data);
            fs.writeFileSync(this.storePath, serialized, 'utf8');
        } catch (error) {
            console.error(`Error saving checkpoint data: ${error}`);
        }
    }

    /**
     * Creates a unique key for storing checkpoints
     */
    private makeCheckpointKey(thread_id: string, checkpoint_ns: string, checkpoint_id: string): string {
        return `${thread_id}:${checkpoint_ns}:${checkpoint_id}`;
    }

    /**
     * Creates a unique key for storing writes
     */
    private makeWritesKey(thread_id: string, checkpoint_ns: string, checkpoint_id: string): string {
        return `${thread_id}:${checkpoint_ns}:${checkpoint_id}`;
    }

    /**
     * Retrieves a checkpoint tuple by config
     */
    async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
        this.loadFromDisk();

        const {
            thread_id,
            checkpoint_ns = "",
            checkpoint_id,
        } = config.configurable ?? {};

        if (!thread_id) {
            return undefined;
        }

        let record: CheckpointRecord | undefined;

        if (checkpoint_id) {
            // Get specific checkpoint
            const key = this.makeCheckpointKey(thread_id, checkpoint_ns, checkpoint_id);
            record = this.checkpoints.get(key);
        } else {
            // Get latest checkpoint
            const prefix = `${thread_id}:${checkpoint_ns}:`;
            const matches = Array.from(this.checkpoints.entries())
                .filter(([key]) => key.startsWith(prefix))
                .map(([, value]) => value);

            // Sort by checkpoint_id in descending order
            record = matches.sort((a, b) =>
                b.checkpoint_id.localeCompare(a.checkpoint_id)
            )[0];
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
        const writesKey = this.makeWritesKey(record.thread_id, record.checkpoint_ns, record.checkpoint_id);
        const checkpointWrites = this.writes.get(writesKey) || [];

        // Process pending writes
        const pendingWrites = await Promise.all(
            checkpointWrites.map(async (write) => {
                const deserializedValue = this.deserializeData(write.value, write.is_binary);
                return [
                    write.task_id,
                    write.channel,
                    await this.serde.loadsTyped(
                        write.type ?? "json",
                        deserializedValue
                    ),
                ] as [string, string, unknown];
            })
        );

        // Get pending sends (tasks from parent checkpoint)
        const pendingSends: unknown[] = [];
        if (record.parent_checkpoint_id) {
            const parentWritesKey = this.makeWritesKey(
                record.thread_id,
                record.checkpoint_ns,
                record.parent_checkpoint_id
            );
            const parentWrites = this.writes.get(parentWritesKey) || [];

            // Get task writes from parent
            const taskWrites = parentWrites.filter(write => write.channel === TASKS);

            // Sort by index
            taskWrites.sort((a, b) => a.idx - b.idx);

            // Process the sends
            for (const send of taskWrites) {
                const deserializedValue = this.deserializeData(send.value, send.is_binary);
                pendingSends.push(
                    await this.serde.loadsTyped(send.type ?? "json", deserializedValue)
                );
            }
        }

        // Deserialize checkpoint and add pending_sends
        const deserializedCheckpoint = this.deserializeData(record.checkpoint, record.is_binary);
        const checkpointObj = {
            ...(await this.serde.loadsTyped(record.type ?? "json", deserializedCheckpoint)),
            pending_sends: pendingSends,
        } as Checkpoint;

        // Deserialize metadata
        const deserializedMetadata = this.deserializeData(record.metadata, record.is_binary);
        const metadataObj = await this.serde.loadsTyped(
            record.type ?? "json",
            deserializedMetadata
        ) as CheckpointMetadata;

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
    }

    /**
     * List checkpoints with optional filtering
     */
    async *list(
        config: RunnableConfig,
        options?: CheckpointListOptions
    ): AsyncGenerator<CheckpointTuple> {
        this.loadFromDisk();

        const { limit, before, filter } = options ?? {};
        const thread_id = config.configurable?.thread_id;
        const checkpoint_ns = config.configurable?.checkpoint_ns ?? "";

        if (!thread_id) {
            return;
        }

        // Filter sanitization - only allow valid metadata keys
        const sanitizedFilter = Object.fromEntries(
            Object.entries(filter ?? {}).filter(
                ([key, value]) =>
                    value !== undefined &&
                    validCheckpointMetadataKeys.includes(key as keyof CheckpointMetadata)
            )
        );

        // Get all matching checkpoints
        const prefix = `${thread_id}:${checkpoint_ns}:`;
        let matches = Array.from(this.checkpoints.entries())
            .filter(([key]) => key.startsWith(prefix))
            .map(([, value]) => value);

        // Apply "before" filter if specified
        if (before?.configurable?.checkpoint_id) {
            const beforeId = before.configurable.checkpoint_id;
            matches = matches.filter(record => record.checkpoint_id < beforeId);
        }

        // Apply metadata filters
        if (Object.keys(sanitizedFilter).length > 0) {
            const filteredMatches: CheckpointRecord[] = [];

            for (const record of matches) {
                const deserializedMetadata = this.deserializeData(record.metadata, record.is_binary);
                const metadata = await this.serde.loadsTyped(
                    record.type ?? "json",
                    deserializedMetadata
                ) as CheckpointMetadata;

                let includeRecord = true;
                for (const [key, value] of Object.entries(sanitizedFilter)) {
                    if (JSON.stringify(metadata[key as keyof CheckpointMetadata]) !== JSON.stringify(value)) {
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
        matches.sort((a, b) => b.checkpoint_id.localeCompare(a.checkpoint_id));

        // Apply limit if specified
        if (limit !== undefined) {
            matches = matches.slice(0, parseInt(String(limit), 10));
        }

        // Process and yield each matching checkpoint
        for (const record of matches) {
            // Get writes for this checkpoint
            const writesKey = this.makeWritesKey(record.thread_id, record.checkpoint_ns, record.checkpoint_id);
            const checkpointWrites = this.writes.get(writesKey) || [];

            // Process pending writes
            const pendingWrites = await Promise.all(
                checkpointWrites.map(async (write) => {
                    const deserializedValue = this.deserializeData(write.value, write.is_binary);
                    return [
                        write.task_id,
                        write.channel,
                        await this.serde.loadsTyped(
                            write.type ?? "json",
                            deserializedValue
                        ),
                    ] as [string, string, unknown];
                })
            );

            // Get pending sends (tasks from parent checkpoint)
            const pendingSends: unknown[] = [];
            if (record.parent_checkpoint_id) {
                const parentWritesKey = this.makeWritesKey(
                    record.thread_id,
                    record.checkpoint_ns,
                    record.parent_checkpoint_id
                );
                const parentWrites = this.writes.get(parentWritesKey) || [];

                // Get task writes from parent
                const taskWrites = parentWrites.filter(write => write.channel === TASKS);

                // Sort by index
                taskWrites.sort((a, b) => a.idx - b.idx);

                // Process the sends
                for (const send of taskWrites) {
                    const deserializedValue = this.deserializeData(send.value, send.is_binary);
                    pendingSends.push(
                        await this.serde.loadsTyped(send.type ?? "json", deserializedValue)
                    );
                }
            }

            // Deserialize checkpoint and add pending_sends
            const deserializedCheckpoint = this.deserializeData(record.checkpoint, record.is_binary);
            const checkpointObj = {
                ...(await this.serde.loadsTyped(record.type ?? "json", deserializedCheckpoint)),
                pending_sends: pendingSends,
            } as Checkpoint;

            // Deserialize metadata
            const deserializedMetadata = this.deserializeData(record.metadata, record.is_binary);
            const metadataObj = await this.serde.loadsTyped(
                record.type ?? "json",
                deserializedMetadata
            ) as CheckpointMetadata;

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
        metadata: CheckpointMetadata
    ): Promise<RunnableConfig> {
        this.loadFromDisk();

        if (!config.configurable) {
            throw new Error("Empty configuration supplied.");
        }

        const thread_id = config.configurable?.thread_id;
        const checkpoint_ns = config.configurable?.checkpoint_ns ?? "";
        const parent_checkpoint_id = config.configurable?.checkpoint_id;

        if (!thread_id) {
            throw new Error(
                `Missing "thread_id" field in passed "config.configurable".`
            );
        }

        // Prepare checkpoint for serialization (remove pending_sends)
        const preparedCheckpoint: Partial<Checkpoint> = copyCheckpoint(checkpoint);
        delete preparedCheckpoint.pending_sends;

        // Serialize checkpoint and metadata
        const [type1, serializedCheckpoint] = this.serde.dumpsTyped(preparedCheckpoint);
        const [type2, serializedMetadata] = this.serde.dumpsTyped(metadata);

        if (type1 !== type2) {
            throw new Error(
                "Failed to serialized checkpoint and metadata to the same type."
            );
        }

        // Handle binary data properly
        const { value: checkpointValue, is_binary: checkpointIsBinary } =
            this.serializeData(serializedCheckpoint);
        const { value: metadataValue, is_binary: metadataIsBinary } =
            this.serializeData(serializedMetadata);

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
        };

        // Store the checkpoint
        const key = this.makeCheckpointKey(thread_id, checkpoint_ns, checkpoint.id);
        this.checkpoints.set(key, record);

        // Save to disk
        this.saveToDisk();

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
        taskId: string
    ): Promise<void> {
        this.loadFromDisk();

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

        // Create write records
        const writeRecords: WriteRecord[] = [];

        for (let idx = 0; idx < writes.length; idx++) {
            const write = writes[idx];
            const [type, serializedWrite] = this.serde.dumpsTyped(write[1]);

            // Handle binary data properly
            const { value, is_binary } = this.serializeData(serializedWrite);

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
            });
        }

        // Store the writes
        const key = this.makeWritesKey(thread_id, checkpoint_ns, checkpoint_id);
        this.writes.set(key, [...(this.writes.get(key) || []), ...writeRecords]);

        // Save to disk
        this.saveToDisk();
    }

    /**
     * Clear all stored data (both in memory and on disk)
     */
    clear(): void {
        this.checkpoints.clear();
        this.writes.clear();

        // Remove the file if it exists
        if (fs.existsSync(this.storePath)) {
            fs.unlinkSync(this.storePath);
        }

        this.loaded = true; // Mark as loaded to prevent reloading the deleted data
    }

    /**
     * Force persisting current state to disk
     */
    flush(): void {
        this.saveToDisk();
    }

    /**
     * Remove specific thread data
     * @param threadId The thread ID to remove
     * @param checkpoint_ns Optional namespace (removes all namespaces if not specified)
     */
    removeThread(threadId: string, checkpoint_ns?: string): void {
        this.loadFromDisk();

        const prefix = checkpoint_ns !== undefined
            ? `${threadId}:${checkpoint_ns}:`
            : `${threadId}:`;

        // Remove matching checkpoints
        for (const key of this.checkpoints.keys()) {
            if (key.startsWith(prefix)) {
                this.checkpoints.delete(key);
            }
        }

        // Remove matching writes
        for (const key of this.writes.keys()) {
            if (key.startsWith(prefix)) {
                this.writes.delete(key);
            }
        }

        // Save changes
        this.saveToDisk();
    }
}