import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MAX_TARGET_LENGTH = 256;
const MINUTE_LIMIT = 24 * 60 - 1;

export type SmsAlertMode = "off" | "important-only" | "all";

export type SmsQuietHours = {
	enabled: boolean;
	startMinute: number;
	endMinute: number;
	timezone?: string;
};

export type SmsPolicyRecord = {
	target: string;
	paused: boolean;
	pausedUntil: number | null;
	stopEnabled: boolean;
	alertMode: SmsAlertMode;
	quietHours: SmsQuietHours | null;
	createdAt: number;
	updatedAt: number;
};

export type SmsPolicyPatch = {
	paused?: boolean;
	pausedUntil?: number | null;
	stopEnabled?: boolean;
	alertMode?: SmsAlertMode;
	quietHours?: unknown;
};

export type SmsPolicyStore = {
	load: () => SmsPolicyRecord[];
	save: (records: SmsPolicyRecord[]) => void;
	list: () => SmsPolicyRecord[];
	get: (target: string) => SmsPolicyRecord | null;
	resolve: (target: string, nowMs?: number) => SmsPolicyRecord;
	upsert: (
		target: string,
		patch: SmsPolicyPatch,
		nowMs?: number,
	) => SmsPolicyRecord;
	reset: (target: string) => void;
	isPaused: (target: string, nowMs?: number) => boolean;
	isStopped: (target: string, nowMs?: number) => boolean;
};

function isAlertMode(value: unknown): value is SmsAlertMode {
	return value === "off" || value === "important-only" || value === "all";
}

function normalizeQuietHours(value: unknown): SmsQuietHours | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}
	const candidate = value as Partial<SmsQuietHours>;
	const startMinute =
		typeof candidate.startMinute === "number" ? candidate.startMinute : NaN;
	const endMinute =
		typeof candidate.endMinute === "number" ? candidate.endMinute : NaN;
	if (
		!Number.isInteger(startMinute) ||
		startMinute < 0 ||
		startMinute > MINUTE_LIMIT ||
		!Number.isInteger(endMinute) ||
		endMinute < 0 ||
		endMinute > MINUTE_LIMIT
	) {
		return null;
	}
	return {
		enabled: candidate.enabled !== false,
		startMinute,
		endMinute,
		timezone:
			typeof candidate.timezone === "string" && candidate.timezone.trim()
				? candidate.timezone.trim()
				: undefined,
	};
}

function normalizeTarget(raw: string): string | null {
	const trimmed = raw.trim();
	if (!trimmed || trimmed.length > MAX_TARGET_LENGTH) {
		return null;
	}
	return trimmed;
}

export function normalizeSmsPolicyTarget(raw: string): string | null {
	return normalizeTarget(raw);
}

function createDefaultPolicy(target: string, nowMs: number): SmsPolicyRecord {
	return {
		target,
		paused: false,
		pausedUntil: null,
		stopEnabled: false,
		alertMode: "important-only",
		quietHours: null,
		createdAt: nowMs,
		updatedAt: nowMs,
	};
}

function parsePolicyRecord(entry: unknown): SmsPolicyRecord | null {
	if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
		return null;
	}
	const typed = entry as Partial<SmsPolicyRecord>;
	const target =
		typeof typed.target === "string" ? normalizeTarget(typed.target) : null;
	if (!target) {
		return null;
	}

	const createdAt =
		typeof typed.createdAt === "number" && Number.isFinite(typed.createdAt)
			? typed.createdAt
			: Date.now();
	const updatedAt =
		typeof typed.updatedAt === "number" && Number.isFinite(typed.updatedAt)
			? typed.updatedAt
			: createdAt;
	const paused = typed.paused === true;
	const pausedUntil =
		typeof typed.pausedUntil === "number" && Number.isFinite(typed.pausedUntil)
			? Math.trunc(typed.pausedUntil)
			: null;

	return {
		target,
		paused,
		pausedUntil: paused ? pausedUntil : null,
		stopEnabled: typed.stopEnabled === true,
		alertMode: isAlertMode(typed.alertMode)
			? typed.alertMode
			: "important-only",
		quietHours: normalizeQuietHours(typed.quietHours),
		createdAt,
		updatedAt,
	};
}

function resolveExpiredPause(
	record: SmsPolicyRecord,
	nowMs: number,
): SmsPolicyRecord {
	if (
		!record.paused ||
		record.pausedUntil === null ||
		record.pausedUntil > nowMs
	) {
		return record;
	}
	return {
		...record,
		paused: false,
		pausedUntil: null,
		updatedAt: nowMs,
	};
}

export const createSmsPolicyStore = (
	resolveConfigDirPath: () => string,
): SmsPolicyStore => {
	const resolvePath = () => {
		const configDir = resolveConfigDirPath();
		mkdirSync(configDir, { recursive: true });
		return join(configDir, "sms-policies.json");
	};

	const readRecords = (): SmsPolicyRecord[] => {
		const path = resolvePath();
		if (!existsSync(path)) {
			return [];
		}
		try {
			const raw = readFileSync(path, "utf-8");
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) {
				return [];
			}
			const records: SmsPolicyRecord[] = [];
			for (const entry of parsed) {
				const record = parsePolicyRecord(entry);
				if (record) {
					records.push(record);
				}
			}
			return records;
		} catch {
			return [];
		}
	};

	const writeRecords = (records: SmsPolicyRecord[]) => {
		const path = resolvePath();
		writeFileSync(path, JSON.stringify(records, null, 2));
	};

	const replaceRecord = (
		records: SmsPolicyRecord[],
		nextRecord: SmsPolicyRecord,
	): SmsPolicyRecord[] => {
		const index = records.findIndex(
			(record) => record.target === nextRecord.target,
		);
		if (index >= 0) {
			records[index] = nextRecord;
		} else {
			records.unshift(nextRecord);
		}
		return records;
	};

	const resolveRecord = (
		target: string,
		nowMs = Date.now(),
	): SmsPolicyRecord => {
		const normalizedTarget = normalizeTarget(target);
		if (!normalizedTarget) {
			return createDefaultPolicy("unknown", nowMs);
		}
		const records = readRecords();
		const existing = records.find(
			(record) => record.target === normalizedTarget,
		);
		if (!existing) {
			return createDefaultPolicy(normalizedTarget, nowMs);
		}
		const resolved = resolveExpiredPause(existing, nowMs);
		if (resolved !== existing) {
			writeRecords(replaceRecord(records, resolved));
		}
		return resolved;
	};

	return {
		load: () => readRecords(),
		save: (records) => writeRecords(records),
		list: () => readRecords(),
		get: (target) => {
			const normalizedTarget = normalizeTarget(target);
			if (!normalizedTarget) return null;
			return (
				readRecords().find((record) => record.target === normalizedTarget) ||
				null
			);
		},
		resolve: (target, nowMs = Date.now()) => resolveRecord(target, nowMs),
		upsert: (target, patch, nowMs = Date.now()) => {
			const normalizedTarget = normalizeTarget(target);
			if (!normalizedTarget) {
				throw new Error("Invalid SMS policy target");
			}
			const records = readRecords();
			const existing = records.find(
				(record) => record.target === normalizedTarget,
			);
			const base = existing || createDefaultPolicy(normalizedTarget, nowMs);
			const next: SmsPolicyRecord = {
				...base,
				updatedAt: nowMs,
			};

			if (typeof patch.paused === "boolean") {
				next.paused = patch.paused;
			}
			if (Object.hasOwn(patch, "pausedUntil")) {
				const value = patch.pausedUntil;
				if (typeof value === "number" && Number.isFinite(value)) {
					next.pausedUntil = Math.trunc(value);
				} else {
					next.pausedUntil = null;
				}
			}
			if (typeof patch.stopEnabled === "boolean") {
				next.stopEnabled = patch.stopEnabled;
			}
			if (isAlertMode(patch.alertMode)) {
				next.alertMode = patch.alertMode;
			}
			if (Object.hasOwn(patch, "quietHours")) {
				next.quietHours = patch.quietHours
					? normalizeQuietHours(patch.quietHours)
					: null;
			}
			if (!next.paused) {
				next.pausedUntil = null;
			}

			const resolved = resolveExpiredPause(next, nowMs);
			writeRecords(replaceRecord(records, resolved));
			return resolved;
		},
		reset: (target) => {
			const normalizedTarget = normalizeTarget(target);
			if (!normalizedTarget) return;
			const records = readRecords();
			const filtered = records.filter(
				(record) => record.target !== normalizedTarget,
			);
			if (filtered.length === records.length) {
				return;
			}
			writeRecords(filtered);
		},
		isPaused: (target, nowMs = Date.now()) => {
			return resolveRecord(target, nowMs).paused;
		},
		isStopped: (target, nowMs = Date.now()) => {
			return resolveRecord(target, nowMs).stopEnabled;
		},
	};
};
