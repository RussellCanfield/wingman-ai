import { describe, expect, it } from "vitest";
import {
	loadDesktopPreferences,
	normalizeDesktopPreferences,
	saveDesktopPreferences,
} from "./lib/desktopPrefs.js";

class MemoryStorage implements Storage {
	private values = new Map<string, string>();

	get length(): number {
		return this.values.size;
	}

	clear(): void {
		this.values.clear();
	}

	getItem(key: string): string | null {
		if (!this.values.has(key)) return null;
		return this.values.get(key) ?? null;
	}

	key(index: number): string | null {
		return Array.from(this.values.keys())[index] || null;
	}

	removeItem(key: string): void {
		this.values.delete(key);
	}

	setItem(key: string, value: string): void {
		this.values.set(key, value);
	}
}

describe("desktopPrefs", () => {
	it("defaults node mode to disabled", () => {
		const defaults = normalizeDesktopPreferences(undefined);
		expect(defaults.enableNodeMode).toBe(false);
	});

	it("persists node mode preference", () => {
		const storage = new MemoryStorage();
		saveDesktopPreferences(
			normalizeDesktopPreferences({
				autoConnectOnLaunch: true,
				notifyOnAgentFinish: true,
				enableNodeMode: true,
			}),
			storage,
		);
		const loaded = loadDesktopPreferences(storage);
		expect(loaded.enableNodeMode).toBe(true);
	});
});
