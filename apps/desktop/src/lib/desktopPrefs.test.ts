import { describe, expect, test } from "vitest";
import {
	loadDesktopPreferences,
	normalizeDesktopPreferences,
	saveDesktopPreferences,
} from "./desktopPrefs.js";

function createMemoryStorage(seed?: Record<string, string>): Storage {
	const values = new Map<string, string>(Object.entries(seed || {}));
	return {
		get length() {
			return values.size;
		},
		clear() {
			values.clear();
		},
		getItem(key: string) {
			return values.has(key) ? values.get(key)! : null;
		},
		key(index: number) {
			return [...values.keys()][index] || null;
		},
		removeItem(key: string) {
			values.delete(key);
		},
		setItem(key: string, value: string) {
			values.set(key, value);
		},
	} as Storage;
}

describe("desktopPrefs", () => {
	test("defaults desktop preferences", () => {
		const prefs = normalizeDesktopPreferences(undefined);
		expect(prefs.autoConnectOnLaunch).toBe(true);
		expect(prefs.notifyOnAgentFinish).toBe(true);
		expect(prefs.smsBridgeEnabled).toBe(false);
		expect(prefs.smsBridgeAllowlist).toEqual([]);
	});

	test("loads persisted auto-connect preference", () => {
		const storage = createMemoryStorage({
			"wingman.desktop.preferences": JSON.stringify({
				autoConnectOnLaunch: false,
				notifyOnAgentFinish: false,
				smsBridgeEnabled: true,
				smsBridgeAllowlist: ["+15555550000", " +15555550000 ", "JANE@EXAMPLE.COM"],
			}),
		});
		const prefs = loadDesktopPreferences(storage);
		expect(prefs.autoConnectOnLaunch).toBe(false);
		expect(prefs.notifyOnAgentFinish).toBe(false);
		expect(prefs.smsBridgeEnabled).toBe(true);
		expect(prefs.smsBridgeAllowlist).toEqual(["+15555550000", "jane@example.com"]);
	});

	test("saves auto-connect preference", () => {
		const storage = createMemoryStorage();
		saveDesktopPreferences(
			{
				autoConnectOnLaunch: false,
				notifyOnAgentFinish: true,
				enableNodeMode: false,
				smsBridgeEnabled: true,
				smsBridgeAllowlist: ["+15555550000"],
			},
			storage,
		);
		expect(storage.getItem("wingman.desktop.preferences")).toBe(
			JSON.stringify({
				autoConnectOnLaunch: false,
				notifyOnAgentFinish: true,
				enableNodeMode: false,
				smsBridgeEnabled: true,
				smsBridgeAllowlist: ["+15555550000"],
			}),
		);
	});
});
