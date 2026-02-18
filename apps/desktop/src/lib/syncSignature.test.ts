import { describe, expect, test } from "vitest";
import { buildSyncSignature } from "./syncSignature.js";

describe("buildSyncSignature", () => {
	test("returns stable output for equal payloads", () => {
		const payload = {
			profile: {
				os: "macos",
				supportsTray: true,
				supportsOverlay: true,
				supportsGlobalHotkeys: true,
				supportsDeepLinks: true,
				supportsNotifications: true,
				defaultRecordHotkey: "caps_lock",
				defaultOverlayHotkey: "double_shift",
				hotkeyOptions: ["caps_lock", "double_shift"],
			},
			permissions: {
				items: [
					{
						id: "microphone",
						label: "Microphone",
						status: "granted" as const,
						canOpenSettings: true,
					},
				],
				note: "ok",
			},
			nativeState: {
				recording: true,
				transcript: "hello",
			},
		};

		expect(buildSyncSignature(payload)).toBe(buildSyncSignature(payload));
	});

	test("changes when transcript changes", () => {
		const a = buildSyncSignature({
			profile: {
				os: "macos",
				supportsTray: true,
				supportsOverlay: true,
				supportsGlobalHotkeys: true,
				supportsDeepLinks: true,
				supportsNotifications: true,
				defaultRecordHotkey: "caps_lock",
				defaultOverlayHotkey: "double_shift",
				hotkeyOptions: ["caps_lock", "double_shift"],
			},
			permissions: { items: [], note: "ok" },
			nativeState: { transcript: "first" },
		});
		const b = buildSyncSignature({
			profile: {
				os: "macos",
				supportsTray: true,
				supportsOverlay: true,
				supportsGlobalHotkeys: true,
				supportsDeepLinks: true,
				supportsNotifications: true,
				defaultRecordHotkey: "caps_lock",
				defaultOverlayHotkey: "double_shift",
				hotkeyOptions: ["caps_lock", "double_shift"],
			},
			permissions: { items: [], note: "ok" },
			nativeState: { transcript: "second" },
		});

		expect(a).not.toBe(b);
	});
});
