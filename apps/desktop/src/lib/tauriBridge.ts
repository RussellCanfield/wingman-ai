type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

type TauriInternals = {
	invoke: TauriInvoke;
};

declare global {
	interface Window {
		__TAURI_INTERNALS__?: TauriInternals;
	}
}

export function isTauriRuntime(): boolean {
	return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__?.invoke);
}

export async function invokeTauri<T>(
	command: string,
	args?: Record<string, unknown>,
): Promise<T | undefined> {
	const invoke = window.__TAURI_INTERNALS__?.invoke;
	if (!invoke) return undefined;
	return invoke<T>(command, args);
}
