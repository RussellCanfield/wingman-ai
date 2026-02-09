export type WorkspaceLoadingFlags = {
	checkingConnection: boolean;
	sessionsLoading: boolean;
	agentsLoading: boolean;
	providersLoading: boolean;
	voiceConfigLoading: boolean;
};

export function collectWorkspaceLoadingTasks(
	flags: WorkspaceLoadingFlags,
): string[] {
	const tasks: string[] = [];
	if (flags.checkingConnection) tasks.push("connection");
	if (flags.sessionsLoading) tasks.push("sessions");
	if (flags.agentsLoading) tasks.push("agents");
	if (flags.providersLoading) tasks.push("providers");
	if (flags.voiceConfigLoading) tasks.push("voice");
	return tasks;
}

export function formatSlowLoadEvent(
	label: string,
	durationMs: number,
	thresholdMs = 1200,
): string | null {
	if (!Number.isFinite(durationMs) || durationMs < thresholdMs) {
		return null;
	}
	const normalized = label.trim() || "request";
	return `Slow load: ${normalized} (${Math.round(durationMs)}ms)`;
}
