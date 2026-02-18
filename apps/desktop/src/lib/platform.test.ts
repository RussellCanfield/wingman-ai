import { describe, expect, test } from "vitest";
import {
	DEFAULT_PERMISSIONS,
	DEFAULT_PROFILE,
	normalizePermissionSnapshot,
	normalizePlatformProfile,
	statusLabel,
} from "./platform.js";

describe("platform profile", () => {
	test("uses defaults when adapter payload is missing", () => {
		const profile = normalizePlatformProfile(undefined);
		expect(profile).toEqual(DEFAULT_PROFILE);
	});

	test("honors adapter hotkey defaults", () => {
		const profile = normalizePlatformProfile({
			os: "macos",
			defaultRecordHotkey: "caps_lock",
			defaultOverlayHotkey: "double_shift",
			hotkeyOptions: ["caps_lock", "double_shift", "double_command"],
		});

		expect(profile.os).toBe("macos");
		expect(profile.hotkeyOptions).toContain("double_command");
	});
});

describe("permission snapshot", () => {
	test("normalizes partial payload safely", () => {
		const snapshot = normalizePermissionSnapshot({
			items: [
				{
					id: "microphone",
					label: "Mic",
					status: "granted",
					canOpenSettings: false,
				},
			],
		});

		expect(snapshot.items[0].canOpenSettings).toBe(false);
	});

	test("falls back to defaults when payload is missing", () => {
		const snapshot = normalizePermissionSnapshot(undefined);
		expect(snapshot).toEqual(DEFAULT_PERMISSIONS);
	});

	test("formats permission status labels", () => {
		expect(statusLabel("not_determined")).toBe("Not determined");
	});
});
