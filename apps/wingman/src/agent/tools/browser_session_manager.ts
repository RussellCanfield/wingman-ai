import { randomUUID } from "node:crypto";
import {
	type BrowserControlDependencies,
	type BrowserControlInput,
	type BrowserControlToolOptions,
	type BrowserExecutionSummary,
	type BrowserRuntimeTransport,
	type BrowserSessionRuntime,
	type BrowserTransportPreference,
	closeBrowserSessionRuntime,
	executeBrowserSessionRuntime,
	openBrowserSessionRuntime,
} from "./browser_runtime.js";

export interface BrowserSessionSnapshot {
	sessionId: string;
	ownerId: string;
	workspace: string;
	configWorkspace: string;
	status: "running";
	startedAt: number;
	updatedAt: number;
	transportRequested: BrowserTransportPreference;
	transportUsed: BrowserRuntimeTransport;
	mode: "headless" | "headed";
	persistentProfile: boolean;
	profileId?: string;
	profilePath?: string;
	reusedExistingSession: boolean;
	finalUrl?: string;
	title?: string;
}

export interface BrowserSessionManagerOptions {
	maxSessionsPerOwner?: number;
	idleTimeoutMs?: number;
}

interface BrowserSessionRecord {
	sessionId: string;
	ownerId: string;
	runtime: BrowserSessionRuntime;
	dependencies: Partial<BrowserControlDependencies>;
	startedAt: number;
	updatedAt: number;
	lastSummary: BrowserExecutionSummary | null;
	closing: boolean;
}

interface StartBrowserSessionInput {
	ownerId: string;
	options: BrowserControlToolOptions;
	dependencies?: Partial<BrowserControlDependencies>;
	input: BrowserControlInput;
}

interface RunBrowserSessionInput {
	ownerId: string;
	sessionId: string;
	input: Pick<BrowserControlInput, "url" | "actions" | "timeoutMs">;
}

interface CloseBrowserSessionInput {
	ownerId: string;
	sessionId: string;
}

const DEFAULT_MAX_SESSIONS_PER_OWNER = 3;
const DEFAULT_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export class BrowserSessionManager {
	private readonly sessions = new Map<string, BrowserSessionRecord>();
	private readonly ownerIndex = new Map<string, Set<string>>();
	private readonly cleanupTimer: ReturnType<typeof setInterval>;
	private readonly maxSessionsPerOwner: number;
	private readonly idleTimeoutMs: number;

	constructor(options: BrowserSessionManagerOptions = {}) {
		this.maxSessionsPerOwner =
			options.maxSessionsPerOwner ?? DEFAULT_MAX_SESSIONS_PER_OWNER;
		this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;

		this.cleanupTimer = setInterval(() => {
			void this.cleanupExpiredSessions();
		}, 60_000);
		this.cleanupTimer.unref?.();
	}

	async dispose(): Promise<void> {
		clearInterval(this.cleanupTimer);
		const sessions = [...this.sessions.values()];
		this.sessions.clear();
		this.ownerIndex.clear();
		await Promise.allSettled(
			sessions.map((record) =>
				closeBrowserSessionRuntime(record.runtime, record.dependencies),
			),
		);
	}

	async startSession(input: StartBrowserSessionInput): Promise<{
		snapshot: BrowserSessionSnapshot;
		summary: BrowserExecutionSummary;
	}> {
		const ownerId = this.normalizeOwnerId(input.ownerId);
		const existing = this.ownerIndex.get(ownerId);
		if ((existing?.size || 0) >= this.maxSessionsPerOwner) {
			throw new Error(
				`Owner "${ownerId}" reached browser session limit (${this.maxSessionsPerOwner})`,
			);
		}

		const runtime = await openBrowserSessionRuntime(
			input.options,
			input.dependencies,
			input.input,
		);
		const now = Date.now();
		const sessionId = randomUUID();
		const record: BrowserSessionRecord = {
			sessionId,
			ownerId,
			runtime,
			dependencies: input.dependencies || {},
			startedAt: now,
			updatedAt: now,
			lastSummary: null,
			closing: false,
		};

		this.sessions.set(sessionId, record);
		if (!existing) {
			this.ownerIndex.set(ownerId, new Set([sessionId]));
		} else {
			existing.add(sessionId);
		}

		try {
			const summary = await executeBrowserSessionRuntime(runtime, input.input);
			record.lastSummary = summary;
			record.updatedAt = Date.now();
			return {
				snapshot: this.toSnapshot(record),
				summary,
			};
		} catch (error) {
			await this.closeAndDelete(record);
			throw error;
		}
	}

	async runSession(input: RunBrowserSessionInput): Promise<{
		snapshot: BrowserSessionSnapshot;
		summary: BrowserExecutionSummary;
	}> {
		const record = this.getOwnedRecord(input.ownerId, input.sessionId);
		const summary = await executeBrowserSessionRuntime(
			record.runtime,
			input.input,
		);
		record.lastSummary = summary;
		record.updatedAt = Date.now();
		return {
			snapshot: this.toSnapshot(record),
			summary,
		};
	}

	async closeSession(
		input: CloseBrowserSessionInput,
	): Promise<BrowserSessionSnapshot> {
		const record = this.getOwnedRecord(input.ownerId, input.sessionId);
		const snapshot = this.toSnapshot(record);
		await this.closeAndDelete(record);
		return snapshot;
	}

	listSessions(ownerId: string): BrowserSessionSnapshot[] {
		const normalizedOwnerId = this.normalizeOwnerId(ownerId);
		const sessionIds = this.ownerIndex.get(normalizedOwnerId);
		if (!sessionIds || sessionIds.size === 0) {
			return [];
		}

		return [...sessionIds]
			.map((sessionId) => this.sessions.get(sessionId))
			.filter((record): record is BrowserSessionRecord => Boolean(record))
			.sort((a, b) => b.updatedAt - a.updatedAt)
			.map((record) => this.toSnapshot(record));
	}

	private async cleanupExpiredSessions(): Promise<void> {
		const now = Date.now();
		const expired = [...this.sessions.values()].filter(
			(record) =>
				!record.closing && now - record.updatedAt > this.idleTimeoutMs,
		);
		await Promise.allSettled(
			expired.map((record) => this.closeAndDelete(record)),
		);
	}

	private async closeAndDelete(record: BrowserSessionRecord): Promise<void> {
		if (record.closing) {
			return;
		}
		record.closing = true;
		try {
			await closeBrowserSessionRuntime(record.runtime, record.dependencies);
		} finally {
			this.sessions.delete(record.sessionId);
			const ownerSessions = this.ownerIndex.get(record.ownerId);
			if (ownerSessions) {
				ownerSessions.delete(record.sessionId);
				if (ownerSessions.size === 0) {
					this.ownerIndex.delete(record.ownerId);
				}
			}
		}
	}

	private getOwnedRecord(
		ownerId: string,
		sessionId: string,
	): BrowserSessionRecord {
		const normalizedOwnerId = this.normalizeOwnerId(ownerId);
		const record = this.sessions.get(sessionId);
		if (!record) {
			throw new Error(`Browser session ${sessionId} was not found`);
		}
		if (record.ownerId !== normalizedOwnerId) {
			throw new Error(`Browser session ${sessionId} is not accessible`);
		}
		if (record.closing) {
			throw new Error(`Browser session ${sessionId} is closing`);
		}
		return record;
	}

	private toSnapshot(record: BrowserSessionRecord): BrowserSessionSnapshot {
		return {
			sessionId: record.sessionId,
			ownerId: record.ownerId,
			workspace: record.runtime.workspace,
			configWorkspace: record.runtime.configWorkspace,
			status: "running",
			startedAt: record.startedAt,
			updatedAt: record.updatedAt,
			transportRequested: record.runtime.transportRequested,
			transportUsed: record.runtime.browserTransport,
			mode: record.runtime.headless ? "headless" : "headed",
			persistentProfile: record.runtime.userDataDirSelection.persistentProfile,
			...(record.runtime.userDataDirSelection.profileId
				? { profileId: record.runtime.userDataDirSelection.profileId }
				: {}),
			...(record.runtime.userDataDirSelection.persistentProfile
				? { profilePath: record.runtime.userDataDirSelection.userDataDir }
				: {}),
			reusedExistingSession: record.runtime.reusedExistingCdpSession,
			...(record.lastSummary?.finalUrl
				? { finalUrl: record.lastSummary.finalUrl }
				: {}),
			...(record.lastSummary?.title ? { title: record.lastSummary.title } : {}),
		};
	}

	private normalizeOwnerId(ownerId: string): string {
		const trimmed = ownerId.trim();
		if (!trimmed) {
			throw new Error("Browser ownerId is required");
		}
		return trimmed;
	}
}

let sharedBrowserSessionManager: BrowserSessionManager | null = null;

export const getSharedBrowserSessionManager = (): BrowserSessionManager => {
	if (!sharedBrowserSessionManager) {
		sharedBrowserSessionManager = new BrowserSessionManager();
	}
	return sharedBrowserSessionManager;
};
