import { describe, expect, it } from "vitest";
import {
	loadNodeNamePreference,
	saveNodeNamePreference,
} from "./nodeNamePrefs.js";

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

describe("nodeNamePrefs", () => {
	it("defaults to empty string", () => {
		const storage = new MemoryStorage();
		expect(loadNodeNamePreference(storage)).toBe("");
	});

	it("persists node name", () => {
		const storage = new MemoryStorage();
		saveNodeNamePreference("Office Node", storage);
		expect(loadNodeNamePreference(storage)).toBe("Office Node");
	});
});
