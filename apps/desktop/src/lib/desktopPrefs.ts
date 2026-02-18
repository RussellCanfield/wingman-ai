import { normalizeSmsAllowlist } from "./smsBridgePreferences.js";

export type DesktopPreferences = {
	autoConnectOnLaunch: boolean;
	notifyOnAgentFinish: boolean;
	enableNodeMode: boolean;
	smsBridgeEnabled: boolean;
	smsBridgeAllowlist: string[];
};

const DESKTOP_PREFS_KEY = "wingman.desktop.preferences";

export function normalizeDesktopPreferences(
	value: Partial<DesktopPreferences> | undefined,
): DesktopPreferences {
	return {
		autoConnectOnLaunch: value?.autoConnectOnLaunch ?? true,
		notifyOnAgentFinish: value?.notifyOnAgentFinish ?? true,
		enableNodeMode: value?.enableNodeMode ?? false,
		smsBridgeEnabled: value?.smsBridgeEnabled ?? false,
		smsBridgeAllowlist: normalizeSmsAllowlist(value?.smsBridgeAllowlist),
	};
}

export function loadDesktopPreferences(storage: Storage = localStorage): DesktopPreferences {
	try {
		const raw = storage.getItem(DESKTOP_PREFS_KEY);
		const parsed = raw ? (JSON.parse(raw) as Partial<DesktopPreferences>) : undefined;
		return normalizeDesktopPreferences(parsed);
	} catch {
		return normalizeDesktopPreferences(undefined);
	}
}

export function saveDesktopPreferences(
	preferences: DesktopPreferences,
	storage: Storage = localStorage,
): void {
	storage.setItem(DESKTOP_PREFS_KEY, JSON.stringify(preferences));
}
