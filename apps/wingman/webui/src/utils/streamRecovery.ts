export const DEFAULT_STREAM_RECOVERY_IDLE_TIMEOUT_MS = 12_000;
export const DEFAULT_STREAM_RECOVERY_HARD_TIMEOUT_MS = 120_000;

export function shouldRecoverStream(input: {
	activeRequestId: string | null;
	lastActivityAt: number;
	startedAt: number;
	hasRunningTools: boolean;
	now?: number;
	idleTimeoutMs?: number;
	hardTimeoutMs?: number;
}): boolean {
	const {
		activeRequestId,
		lastActivityAt,
		startedAt,
		hasRunningTools,
		now = Date.now(),
		idleTimeoutMs = DEFAULT_STREAM_RECOVERY_IDLE_TIMEOUT_MS,
		hardTimeoutMs = DEFAULT_STREAM_RECOVERY_HARD_TIMEOUT_MS,
	} = input;

	if (!activeRequestId) return false;
	if (!Number.isFinite(startedAt) || startedAt <= 0) return false;

	const elapsedSinceStart = now - startedAt;
	if (elapsedSinceStart >= hardTimeoutMs) return true;

	// Before first stream activity, rely on hard timeout only.
	if (!Number.isFinite(lastActivityAt) || lastActivityAt <= 0) return false;
	if (hasRunningTools) return false;

	return now - lastActivityAt >= idleTimeoutMs;
}
