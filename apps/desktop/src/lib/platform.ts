export type PermissionStatus =
	| "granted"
	| "denied"
	| "restricted"
	| "not_determined"
	| "unsupported";

export type PermissionEntry = {
	id: string;
	label: string;
	status: PermissionStatus;
	canOpenSettings: boolean;
};

export type PermissionSnapshot = {
	items: PermissionEntry[];
	note: string;
};

export type PlatformProfile = {
	os: string;
	supportsTray: boolean;
	supportsOverlay: boolean;
	supportsGlobalHotkeys: boolean;
	supportsDeepLinks: boolean;
	supportsNotifications: boolean;
	defaultRecordHotkey: string;
	defaultOverlayHotkey: string;
	hotkeyOptions: string[];
};

export const DEFAULT_PROFILE: PlatformProfile = {
	os: "web",
	supportsTray: false,
	supportsOverlay: true,
	supportsGlobalHotkeys: false,
	supportsDeepLinks: false,
	supportsNotifications: false,
	defaultRecordHotkey: "caps_lock",
	defaultOverlayHotkey: "double_shift",
	hotkeyOptions: ["caps_lock", "double_shift"],
};

export const DEFAULT_PERMISSIONS: PermissionSnapshot = {
	items: [
		{
			id: "microphone",
			label: "Microphone",
			status: "not_determined",
			canOpenSettings: false,
		},
		{
			id: "speech",
			label: "Speech Recognition",
			status: "unsupported",
			canOpenSettings: false,
		},
	],
	note: "Running in web-only mode. Native adapter permissions are unavailable.",
};

export function normalizePlatformProfile(
	input: Partial<PlatformProfile> | undefined,
): PlatformProfile {
	if (!input) return DEFAULT_PROFILE;
	return {
		os: input.os || DEFAULT_PROFILE.os,
		supportsTray: input.supportsTray ?? DEFAULT_PROFILE.supportsTray,
		supportsOverlay: input.supportsOverlay ?? DEFAULT_PROFILE.supportsOverlay,
		supportsGlobalHotkeys:
			input.supportsGlobalHotkeys ?? DEFAULT_PROFILE.supportsGlobalHotkeys,
		supportsDeepLinks: input.supportsDeepLinks ?? DEFAULT_PROFILE.supportsDeepLinks,
		supportsNotifications:
			input.supportsNotifications ?? DEFAULT_PROFILE.supportsNotifications,
		defaultRecordHotkey:
			input.defaultRecordHotkey || DEFAULT_PROFILE.defaultRecordHotkey,
		defaultOverlayHotkey:
			input.defaultOverlayHotkey || DEFAULT_PROFILE.defaultOverlayHotkey,
		hotkeyOptions:
			input.hotkeyOptions?.filter(Boolean) || [...DEFAULT_PROFILE.hotkeyOptions],
	};
}

export function normalizePermissionSnapshot(
	input: Partial<PermissionSnapshot> | undefined,
): PermissionSnapshot {
	if (!input) return DEFAULT_PERMISSIONS;
	return {
		items: Array.isArray(input.items)
			? input.items.map((item) => ({
					id: item.id || "unknown",
					label: item.label || "Unknown",
					status: item.status || "unsupported",
					canOpenSettings: item.canOpenSettings ?? false,
				}))
			: [...DEFAULT_PERMISSIONS.items],
		note: input.note || DEFAULT_PERMISSIONS.note,
	};
}

export function statusLabel(status: PermissionStatus): string {
	switch (status) {
		case "granted":
			return "Granted";
		case "denied":
			return "Denied";
		case "restricted":
			return "Restricted";
		case "not_determined":
			return "Not determined";
		default:
			return "Unsupported";
	}
}
