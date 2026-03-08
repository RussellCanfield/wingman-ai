import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Logger } from "@/logger.js";

export interface CliPackageMetadata {
	name: string;
	version: string;
}

export interface CliUpdateNotice {
	packageName: string;
	currentVersion: string;
	latestVersion: string;
	command: string;
}

export interface CliUpdateCheckOptions {
	workspace?: string;
	configDir?: string;
	fetchImpl?: typeof fetch;
	now?: Date;
	timeoutMs?: number;
	cacheTtlMs?: number;
	logger?: Pick<Logger, "debug">;
	packageMetadata?: CliPackageMetadata;
	packageJsonUrl?: URL;
}

interface CachedUpdateCheck {
	packageName: string;
	currentVersion: string;
	latestVersion: string;
	checkedAt: string;
}

interface ParsedVersion {
	core: [number, number, number];
	prerelease: string[];
}

const DEFAULT_TIMEOUT_MS = 1_500;
const DEFAULT_CACHE_TTL_MS = 12 * 60 * 60 * 1_000;

export async function loadCliPackageMetadata(
	packageJsonUrl = new URL("../../../package.json", import.meta.url),
): Promise<CliPackageMetadata | null> {
	try {
		const raw = await readFile(packageJsonUrl, "utf-8");
		const parsed = JSON.parse(raw) as {
			name?: unknown;
			version?: unknown;
		};
		if (typeof parsed.name !== "string" || typeof parsed.version !== "string") {
			return null;
		}

		const name = parsed.name.trim();
		const version = parsed.version.trim();
		if (!name || !version) {
			return null;
		}

		return { name, version };
	} catch {
		return null;
	}
}

export function compareCliVersions(left: string, right: string): number {
	const parsedLeft = parseVersion(left);
	const parsedRight = parseVersion(right);
	if (!parsedLeft || !parsedRight) {
		return 0;
	}

	for (let index = 0; index < parsedLeft.core.length; index++) {
		const diff = parsedLeft.core[index] - parsedRight.core[index];
		if (diff !== 0) {
			return diff;
		}
	}

	return comparePrerelease(parsedLeft.prerelease, parsedRight.prerelease);
}

export function resolveCliUpdateCheckCachePath(
	packageName: string,
	options: Pick<CliUpdateCheckOptions, "workspace" | "configDir"> = {},
): string {
	const workspace = options.workspace?.trim();
	const configDir = options.configDir?.trim() || ".wingman";

	if (workspace) {
		const configRoot = join(workspace, configDir);
		if (existsSync(configRoot)) {
			return join(configRoot, "cache", "update-check.json");
		}
	}

	return join(
		tmpdir(),
		"wingman-update-check",
		sanitizePackageName(packageName),
		"update-check.json",
	);
}

export async function checkForCliUpdate(
	options: CliUpdateCheckOptions = {},
): Promise<CliUpdateNotice | null> {
	const packageMetadata =
		options.packageMetadata ??
		(await loadCliPackageMetadata(options.packageJsonUrl));
	if (!packageMetadata) {
		return null;
	}

	const now = options.now ?? new Date();
	const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
	const cachePath = resolveCliUpdateCheckCachePath(
		packageMetadata.name,
		options,
	);
	const cached = await readCachedUpdateCheck(cachePath);

	if (cached && isCacheUsable(cached, packageMetadata, now, cacheTtlMs)) {
		return toUpdateNotice(
			packageMetadata.name,
			packageMetadata.version,
			cached.latestVersion,
		);
	}

	const latestVersion = await fetchLatestPackageVersion(
		packageMetadata.name,
		options.fetchImpl ?? globalThis.fetch,
		options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
		options.logger,
	);

	if (latestVersion) {
		const nextCacheEntry: CachedUpdateCheck = {
			packageName: packageMetadata.name,
			currentVersion: packageMetadata.version,
			latestVersion,
			checkedAt: now.toISOString(),
		};
		try {
			await writeCachedUpdateCheck(cachePath, nextCacheEntry);
		} catch (error) {
			options.logger?.debug?.(
				"Failed to persist CLI update-check cache",
				error instanceof Error ? error.message : String(error),
			);
		}

		return toUpdateNotice(
			packageMetadata.name,
			packageMetadata.version,
			latestVersion,
		);
	}

	if (
		cached &&
		cached.packageName === packageMetadata.name &&
		cached.currentVersion === packageMetadata.version
	) {
		return toUpdateNotice(
			packageMetadata.name,
			packageMetadata.version,
			cached.latestVersion,
		);
	}

	return null;
}

function parseVersion(version: string): ParsedVersion | null {
	const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/.exec(
		version.trim(),
	);
	if (!match) {
		return null;
	}

	return {
		core: [
			Number.parseInt(match[1], 10),
			Number.parseInt(match[2], 10),
			Number.parseInt(match[3], 10),
		],
		prerelease: match[4] ? match[4].split(".") : [],
	};
}

function comparePrerelease(left: string[], right: string[]): number {
	if (left.length === 0 && right.length === 0) {
		return 0;
	}
	if (left.length === 0) {
		return 1;
	}
	if (right.length === 0) {
		return -1;
	}

	const maxLength = Math.max(left.length, right.length);
	for (let index = 0; index < maxLength; index++) {
		const leftIdentifier = left[index];
		const rightIdentifier = right[index];

		if (leftIdentifier === undefined) {
			return -1;
		}
		if (rightIdentifier === undefined) {
			return 1;
		}
		if (leftIdentifier === rightIdentifier) {
			continue;
		}

		const leftIsNumeric = isNumericIdentifier(leftIdentifier);
		const rightIsNumeric = isNumericIdentifier(rightIdentifier);

		if (leftIsNumeric && rightIsNumeric) {
			return (
				Number.parseInt(leftIdentifier, 10) -
				Number.parseInt(rightIdentifier, 10)
			);
		}
		if (leftIsNumeric) {
			return -1;
		}
		if (rightIsNumeric) {
			return 1;
		}

		return leftIdentifier < rightIdentifier ? -1 : 1;
	}

	return 0;
}

function isNumericIdentifier(value: string): boolean {
	return /^\d+$/.test(value);
}

function sanitizePackageName(packageName: string): string {
	return packageName.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function toUpdateNotice(
	packageName: string,
	currentVersion: string,
	latestVersion: string,
): CliUpdateNotice | null {
	if (compareCliVersions(latestVersion, currentVersion) <= 0) {
		return null;
	}

	return {
		packageName,
		currentVersion,
		latestVersion,
		command: `npm install -g ${packageName}@latest`,
	};
}

function isCacheUsable(
	cacheEntry: CachedUpdateCheck,
	packageMetadata: CliPackageMetadata,
	now: Date,
	cacheTtlMs: number,
): boolean {
	if (cacheEntry.packageName !== packageMetadata.name) {
		return false;
	}
	if (cacheEntry.currentVersion !== packageMetadata.version) {
		return false;
	}

	const checkedAtMs = Date.parse(cacheEntry.checkedAt);
	if (!Number.isFinite(checkedAtMs)) {
		return false;
	}

	return now.getTime() - checkedAtMs <= cacheTtlMs;
}

async function readCachedUpdateCheck(
	cachePath: string,
): Promise<CachedUpdateCheck | null> {
	try {
		const raw = await readFile(cachePath, "utf-8");
		const parsed = JSON.parse(raw) as Partial<CachedUpdateCheck>;

		if (
			typeof parsed.packageName !== "string" ||
			typeof parsed.currentVersion !== "string" ||
			typeof parsed.latestVersion !== "string" ||
			typeof parsed.checkedAt !== "string"
		) {
			return null;
		}

		return {
			packageName: parsed.packageName,
			currentVersion: parsed.currentVersion,
			latestVersion: parsed.latestVersion,
			checkedAt: parsed.checkedAt,
		};
	} catch {
		return null;
	}
}

async function writeCachedUpdateCheck(
	cachePath: string,
	cacheEntry: CachedUpdateCheck,
): Promise<void> {
	await mkdir(dirname(cachePath), { recursive: true });
	await writeFile(
		cachePath,
		`${JSON.stringify(cacheEntry, null, 2)}\n`,
		"utf-8",
	);
}

async function fetchLatestPackageVersion(
	packageName: string,
	fetchImpl: typeof fetch | undefined,
	timeoutMs: number,
	logger?: CliUpdateCheckOptions["logger"],
): Promise<string | null> {
	if (typeof fetchImpl !== "function") {
		return null;
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetchImpl(
			`https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`,
			{
				headers: {
					accept: "application/json",
				},
				signal: controller.signal,
			},
		);
		if (!response.ok) {
			return null;
		}

		const payload = (await response.json()) as {
			version?: unknown;
		};
		if (typeof payload.version !== "string") {
			return null;
		}

		const latestVersion = payload.version.trim();
		return latestVersion || null;
	} catch (error) {
		logger?.debug?.(
			"CLI update check skipped",
			error instanceof Error ? error.message : String(error),
		);
		return null;
	} finally {
		clearTimeout(timeout);
	}
}
