export type TodoStatus = "pending" | "in_progress" | "completed";

export type TodoItem = {
	content: string;
	status: TodoStatus;
};

export type TodoSnapshot = {
	todos: TodoItem[];
	totalCount: number;
	completedCount: number;
	pendingCount: number;
	inProgressCount: number;
	hasActiveTodos: boolean;
	allCompleted: boolean;
	sourceEventId?: string;
	updatedAt?: number;
};

export type TodoToolEventLike = {
	id?: string;
	name?: string;
	args?: unknown;
	output?: unknown;
	timestamp?: number;
};

export type TodoMessageLike = {
	toolEvents?: TodoToolEventLike[];
};

const TODO_STATUS_VALUES = new Set<TodoStatus>([
	"pending",
	"in_progress",
	"completed",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
}

function normalizeTodoStatus(value: unknown): TodoStatus | undefined {
	if (typeof value !== "string") return undefined;
	return TODO_STATUS_VALUES.has(value as TodoStatus)
		? (value as TodoStatus)
		: undefined;
}

function normalizeTodoItem(value: unknown): TodoItem | undefined {
	const record = asRecord(value);
	if (!record) return undefined;
	const content =
		typeof record.content === "string" ? record.content.trim() : "";
	const status = normalizeTodoStatus(record.status);
	if (!content || !status) return undefined;
	return { content, status };
}

function normalizeTodoArray(value: unknown): TodoItem[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const todos = value
		.map((item) => normalizeTodoItem(item))
		.filter(Boolean) as TodoItem[];
	return todos.length === value.length ? todos : undefined;
}

function parseTodoArrayFromString(value: string): TodoItem[] | undefined {
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	const prefixes = ["Updated todo list to", "Updated todo list:"];
	const jsonCandidate = prefixes.reduce((candidate, prefix) => {
		return candidate.startsWith(prefix)
			? candidate.slice(prefix.length).trim()
			: candidate;
	}, trimmed);
	if (!jsonCandidate.startsWith("[") && !jsonCandidate.startsWith("{")) {
		return undefined;
	}
	try {
		return extractTodoArray(JSON.parse(jsonCandidate));
	} catch {
		return undefined;
	}
}

function extractTodoArray(value: unknown, depth = 0): TodoItem[] | undefined {
	if (depth > 6) return undefined;
	const directTodos = normalizeTodoArray(value);
	if (directTodos !== undefined) return directTodos;
	if (typeof value === "string") {
		return parseTodoArrayFromString(value);
	}
	const record = asRecord(value);
	if (!record) return undefined;
	const nestedCandidates = [
		record.todos,
		record.update,
		record.kwargs,
		record.data,
		record.output,
		record.content,
	];
	for (const candidate of nestedCandidates) {
		const nestedTodos = extractTodoArray(candidate, depth + 1);
		if (nestedTodos !== undefined) return nestedTodos;
	}
	return undefined;
}

function buildTodoSnapshot(
	todos: TodoItem[],
	event: TodoToolEventLike,
): TodoSnapshot {
	let completedCount = 0;
	let pendingCount = 0;
	let inProgressCount = 0;
	for (const todo of todos) {
		if (todo.status === "completed") {
			completedCount += 1;
		} else if (todo.status === "in_progress") {
			inProgressCount += 1;
		} else {
			pendingCount += 1;
		}
	}
	return {
		todos,
		totalCount: todos.length,
		completedCount,
		pendingCount,
		inProgressCount,
		hasActiveTodos: inProgressCount > 0,
		allCompleted: todos.length > 0 && completedCount === todos.length,
		sourceEventId: event.id,
		updatedAt: event.timestamp,
	};
}

function findLatestTodoSnapshotInToolEvents(
	toolEvents: TodoToolEventLike[] | undefined,
): TodoSnapshot | null | undefined {
	if (!toolEvents || toolEvents.length === 0) return undefined;
	for (let index = toolEvents.length - 1; index >= 0; index -= 1) {
		const event = toolEvents[index];
		if (event?.name !== "write_todos") continue;
		const todos = extractTodoArray(event.args) ?? extractTodoArray(event.output);
		if (todos === undefined) continue;
		return todos.length > 0 ? buildTodoSnapshot(todos, event) : null;
	}
	return undefined;
}

export function extractLatestTodoSnapshotFromMessages(
	messages: TodoMessageLike[] | undefined,
	fallbackToolEvents?: TodoToolEventLike[],
): TodoSnapshot | null {
	if (messages) {
		for (let index = messages.length - 1; index >= 0; index -= 1) {
			const snapshot = findLatestTodoSnapshotInToolEvents(
				messages[index]?.toolEvents,
			);
			if (snapshot !== undefined) {
				return snapshot;
			}
		}
	}

	const fallbackSnapshot = findLatestTodoSnapshotInToolEvents(fallbackToolEvents);
	return fallbackSnapshot ?? null;
}
