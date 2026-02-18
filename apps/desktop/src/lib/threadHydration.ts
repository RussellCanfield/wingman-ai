import type { SessionThread } from "./gatewayModels.js";

export function findThreadNeedingHydration(
	threads: SessionThread[],
	activeThreadId: string,
): SessionThread | undefined {
	if (!activeThreadId) return undefined;
	const activeThread = threads.find((thread) => thread.id === activeThreadId);
	if (!activeThread || activeThread.messagesLoaded) return undefined;
	return activeThread;
}

