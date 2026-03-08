import { posix } from "node:path";
import type {
	BackendProtocol,
	EditResult,
	FileInfo,
	GrepMatch,
	WriteResult,
} from "deepagents";

export const DEFAULT_HIDDEN_BACKEND_SEGMENTS = [
	"conversation_history",
] as const;

export const BLOCKED_BACKEND_PATH_MESSAGE =
	"Access to conversation history archives is unavailable to agent file tools. Use the current thread context or /memories/ instead.";

type FilteredBackendOptions = {
	hiddenPathSegments?: Iterable<string>;
	blockedPathMessage?: string;
};

const normalizeSegment = (value: string): string =>
	value
		.trim()
		.replace(/\\/g, "/")
		.replace(/^\/+|\/+$/g, "")
		.toLowerCase();

const normalizeVirtualPath = (value: string): string => {
	const normalized = value.replace(/\\/g, "/").trim();
	if (!normalized) {
		return "/";
	}
	if (normalized.startsWith("/")) {
		return posix.normalize(normalized);
	}
	return posix.normalize(`/${normalized.replace(/^\.?\//, "")}`);
};

const resolveHiddenSegments = (
	segments: Iterable<string>,
): ReadonlySet<string> => {
	const normalized = [...segments]
		.map(normalizeSegment)
		.filter((segment) => segment.length > 0);
	return new Set(normalized);
};

const getPathSegments = (value: string): string[] =>
	normalizeVirtualPath(value)
		.split("/")
		.map((segment) => segment.trim().toLowerCase())
		.filter(Boolean);

export const pathUsesHiddenSegment = (
	value: string,
	hiddenPathSegments: Iterable<string> = DEFAULT_HIDDEN_BACKEND_SEGMENTS,
): boolean => {
	const hiddenSegments = resolveHiddenSegments(hiddenPathSegments);
	if (hiddenSegments.size === 0) {
		return false;
	}
	return getPathSegments(value).some((segment) => hiddenSegments.has(segment));
};

const filterPathEntries = <T extends { path: string }>(
	entries: T[],
	hiddenSegments: ReadonlySet<string>,
): T[] =>
	entries.filter(
		(entry) =>
			!getPathSegments(entry.path).some((segment) =>
				hiddenSegments.has(segment),
			),
	);

const createBlockedResult = <T extends WriteResult | EditResult>(
	path: string,
	message: string,
): T =>
	({
		error: message,
		path,
		filesUpdate: null,
	}) as T;

class FilteredBackend implements BackendProtocol {
	private readonly hiddenSegments: ReadonlySet<string>;

	private readonly blockedPathMessage: string;

	constructor(
		private readonly delegate: BackendProtocol,
		options: FilteredBackendOptions = {},
	) {
		this.hiddenSegments = resolveHiddenSegments(
			options.hiddenPathSegments ?? DEFAULT_HIDDEN_BACKEND_SEGMENTS,
		);
		this.blockedPathMessage =
			options.blockedPathMessage ?? BLOCKED_BACKEND_PATH_MESSAGE;
	}

	private isHiddenPath(value: string): boolean {
		return (
			this.hiddenSegments.size > 0 &&
			getPathSegments(value).some((segment) => this.hiddenSegments.has(segment))
		);
	}

	async lsInfo(path: string): Promise<FileInfo[]> {
		if (this.isHiddenPath(path)) {
			return [];
		}
		const entries = await this.delegate.lsInfo(path);
		return filterPathEntries(entries, this.hiddenSegments);
	}

	async read(
		filePath: string,
		offset?: number,
		limit?: number,
	): Promise<string> {
		if (this.isHiddenPath(filePath)) {
			return this.blockedPathMessage;
		}
		return await this.delegate.read(filePath, offset, limit);
	}

	async readRaw(filePath: string) {
		if (this.isHiddenPath(filePath)) {
			throw new Error(this.blockedPathMessage);
		}
		return await this.delegate.readRaw(filePath);
	}

	async grepRaw(
		pattern: string,
		path?: string | null,
		glob?: string | null,
	): Promise<GrepMatch[] | string> {
		if (typeof path === "string" && this.isHiddenPath(path)) {
			return [];
		}
		const result = await this.delegate.grepRaw(pattern, path, glob);
		if (typeof result === "string") {
			return result;
		}
		return filterPathEntries(result, this.hiddenSegments);
	}

	async globInfo(pattern: string, path = "/"): Promise<FileInfo[]> {
		if (this.isHiddenPath(path)) {
			return [];
		}
		const entries = await this.delegate.globInfo(pattern, path);
		return filterPathEntries(entries, this.hiddenSegments);
	}

	async write(filePath: string, content: string): Promise<WriteResult> {
		if (this.isHiddenPath(filePath)) {
			return createBlockedResult<WriteResult>(
				filePath,
				this.blockedPathMessage,
			);
		}
		return await this.delegate.write(filePath, content);
	}

	async edit(
		filePath: string,
		oldString: string,
		newString: string,
		replaceAll?: boolean,
	): Promise<EditResult> {
		if (this.isHiddenPath(filePath)) {
			return createBlockedResult<EditResult>(filePath, this.blockedPathMessage);
		}
		return await this.delegate.edit(filePath, oldString, newString, replaceAll);
	}
}

export const createFilteredBackend = (
	delegate: BackendProtocol,
	options: FilteredBackendOptions = {},
): BackendProtocol => new FilteredBackend(delegate, options);
