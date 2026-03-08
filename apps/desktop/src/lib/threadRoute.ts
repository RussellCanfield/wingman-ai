const THREAD_QUERY_KEY = "thread";

export function isDesktopChatPath(pathname: string): boolean {
	return pathname === "/" || pathname === "/chat";
}

export function getThreadIdFromSearch(search: string): string | null {
	const value = new URLSearchParams(search).get(THREAD_QUERY_KEY)?.trim();
	return value ? value : null;
}

export function buildDesktopChatRoute(threadId?: string | null): string {
	const normalized = threadId?.trim();
	if (!normalized) return "/";
	const search = new URLSearchParams({ [THREAD_QUERY_KEY]: normalized });
	return `/?${search.toString()}`;
}

export function getDisplayedThreadId(input: {
	pathname: string;
	search: string;
}): string | null {
	if (!isDesktopChatPath(input.pathname)) return null;
	return getThreadIdFromSearch(input.search);
}

export function resolveRouteThreadSelection(input: {
	pathname: string;
	search: string;
	activeThreadId: string;
	threadIds: string[];
	sessionsLoading: boolean;
}): string | null | undefined {
	if (!isDesktopChatPath(input.pathname)) return undefined;

	const routeThreadId = getThreadIdFromSearch(input.search);
	if (!routeThreadId) return undefined;

	if (input.threadIds.includes(routeThreadId)) {
		return routeThreadId === input.activeThreadId ? undefined : routeThreadId;
	}

	if (input.sessionsLoading) return undefined;
	return input.activeThreadId ? null : undefined;
}
