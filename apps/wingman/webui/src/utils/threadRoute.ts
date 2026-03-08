const THREAD_QUERY_PARAM = "thread";

export function isHomeChatRoute(pathname: string): boolean {
	return pathname === "/";
}

export function getSelectedThreadIdFromLocation(
	pathname: string,
	search: string,
): string {
	if (!isHomeChatRoute(pathname)) {
		return "";
	}
	return new URLSearchParams(search).get(THREAD_QUERY_PARAM)?.trim() || "";
}

export function buildHomeChatLocation(threadId?: string): string {
	const normalizedThreadId = threadId?.trim();
	if (!normalizedThreadId) {
		return "/";
	}
	const params = new URLSearchParams();
	params.set(THREAD_QUERY_PARAM, normalizedThreadId);
	return `/?${params.toString()}`;
}
