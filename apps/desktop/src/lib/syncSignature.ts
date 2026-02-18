import type { GatewaySettings } from "./gatewayConfig.js";
import type { PermissionSnapshot, PlatformProfile } from "./platform.js";

type NativeSignatureState = {
	connected?: boolean;
	recording?: boolean;
	overlayVisible?: boolean;
	transcript?: string;
	speechStatus?: string;
	gateway?: Partial<GatewaySettings>;
};

type SignatureInput = {
	profile: PlatformProfile;
	permissions: PermissionSnapshot;
	nativeState: NativeSignatureState;
};

export function buildSyncSignature(input: SignatureInput): string {
	return JSON.stringify({
		os: input.profile.os,
		features: {
			tray: input.profile.supportsTray,
			overlay: input.profile.supportsOverlay,
			hotkeys: input.profile.supportsGlobalHotkeys,
			deepLinks: input.profile.supportsDeepLinks,
			notifications: input.profile.supportsNotifications,
		},
		hotkeys: {
			record: input.profile.defaultRecordHotkey,
			overlay: input.profile.defaultOverlayHotkey,
			options: input.profile.hotkeyOptions,
		},
		permissions: input.permissions,
		native: input.nativeState,
	});
}
