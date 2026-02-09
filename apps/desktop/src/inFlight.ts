export function runWithInFlightGuard<T>(
	inFlightRef: { current: Promise<T> | null },
	task: () => Promise<T>,
): Promise<T> {
	if (inFlightRef.current) {
		return inFlightRef.current;
	}

	const pending = task().finally(() => {
		if (inFlightRef.current === pending) {
			inFlightRef.current = null;
		}
	});
	inFlightRef.current = pending;
	return pending;
}
