const TOOL_DISPLAY_NAMES: Record<string, string> = {
	command_execute: "Run Command",
	edit_file: "Edit File",
	file_search: "Search Files",
	glob: "Find Files",
	glob_search: "Find Files",
	grep: "Search Files",
	grep_search: "Search Files",
	internet_search: "Web Search",
	list_dir: "List Files",
	ls: "List Files",
	read_file: "Read File",
	run_command: "Run Command",
	search_web: "Web Search",
	task: "Delegate Task",
	web_search: "Web Search",
	write_file: "Write File",
};

export function normalizeToolName(name: string | null | undefined): string {
	if (typeof name !== "string") {
		return "";
	}
	const trimmed = name.trim().toLowerCase();
	if (!trimmed) {
		return "";
	}
	return trimmed.split(/[./:]/).filter(Boolean).pop() ?? trimmed;
}

export function formatToolDisplayName(name: string | null | undefined): string {
	const normalized = normalizeToolName(name);
	if (!normalized) {
		return "Tool";
	}
	const knownLabel = TOOL_DISPLAY_NAMES[normalized];
	if (knownLabel) {
		return knownLabel;
	}
	const humanized = normalized
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[._-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	if (!humanized) {
		return "Tool";
	}
	return humanized.replace(/\b\w/g, (character) => character.toUpperCase());
}

export function normalizeToolPayloadValue(
	value: unknown,
	maxDepth = 5,
): unknown {
	return normalizeToolPayloadValueInternal(
		value,
		0,
		maxDepth,
		new Set<unknown>(),
		new Set<string>(),
	);
}

export function findToolTextArg(value: unknown, keys: string[]): string | null {
	const match = findToolValue(value, keys);
	if (typeof match === "string" && match.trim()) {
		return match.trim();
	}
	if (typeof match === "number" && Number.isFinite(match)) {
		return String(match);
	}
	return null;
}

export function findToolBooleanArg(
	value: unknown,
	keys: string[],
): boolean | null {
	const match = findToolValue(value, keys);
	if (typeof match === "boolean") {
		return match;
	}
	if (typeof match === "string") {
		const normalized = match.trim().toLowerCase();
		if (normalized === "true") return true;
		if (normalized === "false") return false;
	}
	return null;
}

function findToolValue(value: unknown, keys: string[]): unknown {
	const visitedObjects = new Set<unknown>();
	const visitedStrings = new Set<string>();
	const normalizedKeys = new Set(keys.map((key) => key.trim().toLowerCase()));

	const search = (candidate: unknown): unknown => {
		if (candidate === null || candidate === undefined) {
			return null;
		}
		if (typeof candidate === "string") {
			const trimmed = candidate.trim();
			if (!trimmed || visitedStrings.has(trimmed)) {
				return null;
			}
			const parsed = parseMaybeJsonString(trimmed);
			if (parsed === trimmed) {
				return null;
			}
			visitedStrings.add(trimmed);
			return search(parsed);
		}
		if (Array.isArray(candidate)) {
			for (const item of candidate) {
				const nested = search(item);
				if (nested !== null && nested !== undefined) {
					return nested;
				}
			}
			return null;
		}
		if (typeof candidate !== "object") {
			return null;
		}
		if (visitedObjects.has(candidate)) {
			return null;
		}
		visitedObjects.add(candidate);
		const record = candidate as Record<string, unknown>;
		for (const [key, valueForKey] of Object.entries(record)) {
			if (!normalizedKeys.has(key.trim().toLowerCase())) {
				continue;
			}
			if (typeof valueForKey === "string" && valueForKey.trim()) {
				return valueForKey.trim();
			}
			if (
				typeof valueForKey === "boolean" ||
				(typeof valueForKey === "number" && Number.isFinite(valueForKey))
			) {
				return valueForKey;
			}
			const nested = search(valueForKey);
			if (nested !== null && nested !== undefined) {
				return nested;
			}
		}
		for (const nestedValue of Object.values(record)) {
			const nested = search(nestedValue);
			if (nested !== null && nested !== undefined) {
				return nested;
			}
		}
		return null;
	};

	return search(value);
}

function normalizeToolPayloadValueInternal(
	value: unknown,
	depth: number,
	maxDepth: number,
	seenObjects: Set<unknown>,
	seenStrings: Set<string>,
): unknown {
	if (value === null || value === undefined || depth >= maxDepth) {
		return value;
	}
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed || seenStrings.has(trimmed)) {
			return value;
		}
		const parsed = parseMaybeJsonString(trimmed);
		if (parsed === trimmed) {
			return value;
		}
		seenStrings.add(trimmed);
		return normalizeToolPayloadValueInternal(
			parsed,
			depth + 1,
			maxDepth,
			seenObjects,
			seenStrings,
		);
	}
	if (Array.isArray(value)) {
		return value.map((item) =>
			normalizeToolPayloadValueInternal(
				item,
				depth + 1,
				maxDepth,
				seenObjects,
				seenStrings,
			),
		);
	}
	if (typeof value !== "object") {
		return value;
	}
	if (seenObjects.has(value)) {
		return value;
	}
	seenObjects.add(value);
	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>).map(
			([key, entryValue]) => [
				key,
				normalizeToolPayloadValueInternal(
					entryValue,
					depth + 1,
					maxDepth,
					seenObjects,
					seenStrings,
				),
			],
		),
	);
}

function parseMaybeJsonString(value: string): unknown {
	if (!/^[{[]/.test(value)) {
		return value;
	}
	try {
		return JSON.parse(value);
	} catch {
		return value;
	}
}
