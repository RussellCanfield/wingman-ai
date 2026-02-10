import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

export type TerminalSessionStatus =
	| "running"
	| "completed"
	| "error"
	| "killed"
	| "timed_out";

export interface TerminalSessionSnapshot {
	sessionId: string;
	ownerId: string;
	command: string;
	cwd: string;
	status: TerminalSessionStatus;
	startedAt: number;
	updatedAt: number;
	finishedAt?: number;
	exitCode?: number | null;
	signal?: NodeJS.Signals | null;
	droppedChars: number;
}

export interface TerminalPollResult extends TerminalSessionSnapshot {
	output: string;
	hasMore: boolean;
}

export interface TerminalSessionManagerOptions {
	maxSessionsPerOwner?: number;
	maxBufferedCharsPerSession?: number;
	maxRuntimeMs?: number;
	idleTimeoutMs?: number;
	completedSessionRetentionMs?: number;
	terminationGraceMs?: number;
}

export interface StartTerminalSessionInput {
	ownerId: string;
	command: string;
	cwd: string;
	env: Record<string, string>;
	runtimeLimitMs?: number;
}

export interface PollTerminalSessionInput {
	ownerId: string;
	sessionId: string;
	waitMs?: number;
	maxOutputChars?: number;
}

export interface WriteTerminalSessionInput {
	ownerId: string;
	sessionId: string;
	chars: string;
}

export interface KillTerminalSessionInput {
	ownerId: string;
	sessionId: string;
	signal?: NodeJS.Signals;
}

type TerminalSessionRecord = {
	sessionId: string;
	ownerId: string;
	command: string;
	cwd: string;
	process: ChildProcess;
	status: TerminalSessionStatus;
	startedAt: number;
	updatedAt: number;
	finishedAt?: number;
	exitCode?: number | null;
	signal?: NodeJS.Signals | null;
	output: string;
	cursor: number;
	droppedChars: number;
	killRequested: boolean;
	runtimeLimitMs: number;
	runtimeTimer: ReturnType<typeof setTimeout> | null;
	emitter: EventEmitter;
};

const DEFAULT_MAX_SESSIONS_PER_OWNER = 4;
const DEFAULT_MAX_BUFFERED_CHARS = 256_000;
const DEFAULT_MAX_RUNTIME_MS = 30 * 60 * 1000;
const DEFAULT_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_COMPLETED_RETENTION_MS = 15 * 60 * 1000;
const DEFAULT_TERMINATION_GRACE_MS = 2_000;
const DEFAULT_POLL_WAIT_MS = 1_000;
const DEFAULT_MAX_POLL_OUTPUT_CHARS = 8_000;

export class TerminalSessionManager {
	private readonly sessions = new Map<string, TerminalSessionRecord>();
	private readonly ownerIndex = new Map<string, Set<string>>();
	private readonly cleanupTimer: ReturnType<typeof setInterval>;

	private readonly maxSessionsPerOwner: number;
	private readonly maxBufferedCharsPerSession: number;
	private readonly maxRuntimeMs: number;
	private readonly idleTimeoutMs: number;
	private readonly completedSessionRetentionMs: number;
	private readonly terminationGraceMs: number;

	constructor(options: TerminalSessionManagerOptions = {}) {
		this.maxSessionsPerOwner =
			options.maxSessionsPerOwner ?? DEFAULT_MAX_SESSIONS_PER_OWNER;
		this.maxBufferedCharsPerSession =
			options.maxBufferedCharsPerSession ?? DEFAULT_MAX_BUFFERED_CHARS;
		this.maxRuntimeMs = options.maxRuntimeMs ?? DEFAULT_MAX_RUNTIME_MS;
		this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
		this.completedSessionRetentionMs =
			options.completedSessionRetentionMs ?? DEFAULT_COMPLETED_RETENTION_MS;
		this.terminationGraceMs =
			options.terminationGraceMs ?? DEFAULT_TERMINATION_GRACE_MS;

		this.cleanupTimer = setInterval(() => {
			this.cleanupExpiredSessions();
		}, 60_000);
		this.cleanupTimer.unref?.();
	}

	dispose(): void {
		clearInterval(this.cleanupTimer);
		for (const record of this.sessions.values()) {
			if (record.runtimeTimer) {
				clearTimeout(record.runtimeTimer);
			}
			if (record.status === "running") {
				this.safeKill(record.process, "SIGKILL");
			}
			record.emitter.removeAllListeners();
		}
		this.sessions.clear();
		this.ownerIndex.clear();
	}

	startSession(input: StartTerminalSessionInput): TerminalSessionSnapshot {
		const ownerId = this.normalizeOwnerId(input.ownerId);
		const existing = this.ownerIndex.get(ownerId);
		if ((existing?.size || 0) >= this.maxSessionsPerOwner) {
			throw new Error(
				`Owner "${ownerId}" reached terminal session limit (${this.maxSessionsPerOwner})`,
			);
		}

		const runtimeLimitMs = Math.max(
			1_000,
			input.runtimeLimitMs ?? this.maxRuntimeMs,
		);
		const process = spawn(input.command, [], {
			cwd: input.cwd,
			env: input.env,
			shell: true,
			stdio: ["pipe", "pipe", "pipe"],
			windowsHide: true,
		});

		const now = Date.now();
		const sessionId = randomUUID();
		const record: TerminalSessionRecord = {
			sessionId,
			ownerId,
			command: input.command,
			cwd: input.cwd,
			process,
			status: "running",
			startedAt: now,
			updatedAt: now,
			output: "",
			cursor: 0,
			droppedChars: 0,
			killRequested: false,
			runtimeLimitMs,
			runtimeTimer: null,
			emitter: new EventEmitter(),
		};

		record.runtimeTimer = setTimeout(() => {
			if (record.status !== "running") return;
			record.status = "timed_out";
			record.killRequested = true;
			this.appendOutput(
				record,
				`\n[terminal] Session timed out after ${Math.floor(runtimeLimitMs / 1000)}s\n`,
			);
			this.safeKill(record.process, "SIGTERM");
			setTimeout(() => {
				if (record.status === "running" || !record.finishedAt) {
					this.safeKill(record.process, "SIGKILL");
				}
			}, this.terminationGraceMs).unref?.();
		}, runtimeLimitMs);
		record.runtimeTimer.unref?.();

		process.stdout?.on("data", (chunk: Buffer | string) => {
			this.appendOutput(record, chunk.toString());
		});

		process.stderr?.on("data", (chunk: Buffer | string) => {
			this.appendOutput(record, chunk.toString());
		});

		process.on("error", (error) => {
			if (record.status === "running") {
				record.status = "error";
			}
			this.appendOutput(record, `\n[terminal:error] ${error.message}\n`);
			this.finalizeRecord(record, null, null);
		});

		process.on("exit", (code, signal) => {
			if (record.status === "running") {
				if (record.killRequested || signal) {
					record.status = "killed";
				} else if (typeof code === "number" && code !== 0) {
					record.status = "error";
				} else {
					record.status = "completed";
				}
			}
			this.finalizeRecord(record, code, signal);
		});

		this.sessions.set(sessionId, record);
		if (!existing) {
			this.ownerIndex.set(ownerId, new Set([sessionId]));
		} else {
			existing.add(sessionId);
		}

		return this.toSnapshot(record);
	}

	async pollSession(
		input: PollTerminalSessionInput,
	): Promise<TerminalPollResult> {
		const record = this.getOwnedRecord(input.ownerId, input.sessionId);
		const waitMs = Math.max(0, input.waitMs ?? DEFAULT_POLL_WAIT_MS);
		const maxOutputChars = Math.max(
			1,
			input.maxOutputChars ?? DEFAULT_MAX_POLL_OUTPUT_CHARS,
		);
		if (
			waitMs > 0 &&
			record.status === "running" &&
			record.cursor >= record.output.length
		) {
			await this.waitForUpdate(record, waitMs);
		}

		const available = Math.max(0, record.output.length - record.cursor);
		const readChars = Math.min(maxOutputChars, available);
		const output =
			readChars > 0
				? record.output.slice(record.cursor, record.cursor + readChars)
				: "";
		record.cursor += readChars;

		return {
			...this.toSnapshot(record),
			output,
			hasMore: record.cursor < record.output.length,
		};
	}

	writeSession(input: WriteTerminalSessionInput): TerminalSessionSnapshot {
		const record = this.getOwnedRecord(input.ownerId, input.sessionId);
		if (record.status !== "running") {
			throw new Error(`Terminal session ${record.sessionId} is not running`);
		}
		if (!record.process.stdin || record.process.stdin.destroyed) {
			throw new Error(
				`Terminal session ${record.sessionId} has no writable stdin`,
			);
		}

		record.process.stdin.write(input.chars);
		record.updatedAt = Date.now();
		record.emitter.emit("update");
		return this.toSnapshot(record);
	}

	killSession(input: KillTerminalSessionInput): TerminalSessionSnapshot {
		const record = this.getOwnedRecord(input.ownerId, input.sessionId);
		if (record.status !== "running") {
			return this.toSnapshot(record);
		}
		const signal = input.signal || "SIGTERM";
		record.killRequested = true;
		this.safeKill(record.process, signal);
		if (signal !== "SIGKILL") {
			setTimeout(() => {
				if (record.status === "running") {
					record.killRequested = true;
					this.safeKill(record.process, "SIGKILL");
				}
			}, this.terminationGraceMs).unref?.();
		}
		return this.toSnapshot(record);
	}

	listSessions(ownerId: string): TerminalSessionSnapshot[] {
		const normalizedOwnerId = this.normalizeOwnerId(ownerId);
		const sessionIds = this.ownerIndex.get(normalizedOwnerId);
		if (!sessionIds || sessionIds.size === 0) return [];
		return [...sessionIds]
			.map((sessionId) => this.sessions.get(sessionId))
			.filter((entry): entry is TerminalSessionRecord => Boolean(entry))
			.sort((a, b) => b.startedAt - a.startedAt)
			.map((entry) => this.toSnapshot(entry));
	}

	private waitForUpdate(
		record: TerminalSessionRecord,
		waitMs: number,
	): Promise<void> {
		return new Promise((resolve) => {
			let resolved = false;
			const onUpdate = () => {
				if (resolved) return;
				resolved = true;
				clearTimeout(timer);
				record.emitter.off("update", onUpdate);
				resolve();
			};
			const timer = setTimeout(() => {
				if (resolved) return;
				resolved = true;
				record.emitter.off("update", onUpdate);
				resolve();
			}, waitMs);
			timer.unref?.();
			record.emitter.on("update", onUpdate);
		});
	}

	private appendOutput(record: TerminalSessionRecord, chunk: string): void {
		if (!chunk) return;
		record.output += chunk;
		if (record.output.length > this.maxBufferedCharsPerSession) {
			const overflow = record.output.length - this.maxBufferedCharsPerSession;
			record.output = record.output.slice(overflow);
			record.droppedChars += overflow;
			record.cursor = Math.max(0, record.cursor - overflow);
		}
		record.updatedAt = Date.now();
		record.emitter.emit("update");
	}

	private finalizeRecord(
		record: TerminalSessionRecord,
		code: number | null,
		signal: NodeJS.Signals | null,
	): void {
		record.exitCode = code;
		record.signal = signal;
		record.finishedAt = Date.now();
		record.updatedAt = record.finishedAt;
		if (record.runtimeTimer) {
			clearTimeout(record.runtimeTimer);
			record.runtimeTimer = null;
		}
		record.emitter.emit("update");
	}

	private cleanupExpiredSessions(): void {
		const now = Date.now();

		for (const record of this.sessions.values()) {
			if (record.status === "running") {
				const idleForMs = now - record.updatedAt;
				if (idleForMs > this.idleTimeoutMs) {
					record.status = "timed_out";
					record.killRequested = true;
					this.appendOutput(
						record,
						`\n[terminal] Session idle timeout after ${Math.floor(
							this.idleTimeoutMs / 1000,
						)}s\n`,
					);
					this.safeKill(record.process, "SIGTERM");
					setTimeout(() => {
						if (record.status === "running") {
							this.safeKill(record.process, "SIGKILL");
						}
					}, this.terminationGraceMs).unref?.();
				}
				continue;
			}

			if (
				record.finishedAt &&
				now - record.finishedAt > this.completedSessionRetentionMs
			) {
				this.deleteSession(record.sessionId);
			}
		}
	}

	private deleteSession(sessionId: string): void {
		const record = this.sessions.get(sessionId);
		if (!record) return;
		if (record.runtimeTimer) {
			clearTimeout(record.runtimeTimer);
			record.runtimeTimer = null;
		}
		record.emitter.removeAllListeners();
		this.sessions.delete(sessionId);
		const ownerSessions = this.ownerIndex.get(record.ownerId);
		if (!ownerSessions) return;
		ownerSessions.delete(sessionId);
		if (ownerSessions.size === 0) {
			this.ownerIndex.delete(record.ownerId);
		}
	}

	private getOwnedRecord(
		ownerId: string,
		sessionId: string,
	): TerminalSessionRecord {
		const normalizedOwnerId = this.normalizeOwnerId(ownerId);
		const record = this.sessions.get(sessionId);
		if (!record) {
			throw new Error(`Terminal session ${sessionId} was not found`);
		}
		if (record.ownerId !== normalizedOwnerId) {
			throw new Error(`Terminal session ${sessionId} is not accessible`);
		}
		return record;
	}

	private toSnapshot(record: TerminalSessionRecord): TerminalSessionSnapshot {
		return {
			sessionId: record.sessionId,
			ownerId: record.ownerId,
			command: record.command,
			cwd: record.cwd,
			status: record.status,
			startedAt: record.startedAt,
			updatedAt: record.updatedAt,
			finishedAt: record.finishedAt,
			exitCode: record.exitCode,
			signal: record.signal,
			droppedChars: record.droppedChars,
		};
	}

	private normalizeOwnerId(ownerId: string): string {
		const trimmed = ownerId.trim();
		if (!trimmed) {
			throw new Error("Terminal ownerId is required");
		}
		return trimmed;
	}

	private safeKill(process: ChildProcess, signal: NodeJS.Signals): void {
		try {
			process.kill(signal);
		} catch {
			// Ignore process kill failures
		}
	}
}

let sharedTerminalSessionManager: TerminalSessionManager | null = null;

export const getSharedTerminalSessionManager = (): TerminalSessionManager => {
	if (!sharedTerminalSessionManager) {
		sharedTerminalSessionManager = new TerminalSessionManager();
	}
	return sharedTerminalSessionManager;
};
