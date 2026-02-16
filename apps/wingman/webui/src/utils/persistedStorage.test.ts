import { describe, expect, it } from "vitest";
import { readStoredBoolean, readStoredString } from "./persistedStorage";

const createMemoryStorage = () => {
	const map = new Map<string, string>();
	return {
		getItem: (key: string): string | null => map.get(key) ?? null,
		setItem: (key: string, value: string) => {
			map.set(key, value);
		},
		removeItem: (key: string) => {
			map.delete(key);
		},
		clear: () => {
			map.clear();
		},
	};
};

describe("persistedStorage helpers", () => {
	const originalWindow = (globalThis as { window?: unknown }).window;

	const installMockWindow = () => {
		Object.defineProperty(globalThis, "window", {
			value: {
				localStorage: createMemoryStorage(),
			},
			configurable: true,
			writable: true,
		});
	};

	const restoreWindow = () => {
		if (originalWindow === undefined) {
			delete (globalThis as { window?: unknown }).window;
			return;
		}
		Object.defineProperty(globalThis, "window", {
			value: originalWindow,
			configurable: true,
			writable: true,
		});
	};

	it("reads stored strings and falls back to empty string", () => {
		installMockWindow();
		try {
			window.localStorage.removeItem("persisted-test-token");
			expect(readStoredString("persisted-test-token")).toBe("");

			window.localStorage.setItem("persisted-test-token", "abc123");
			expect(readStoredString("persisted-test-token")).toBe("abc123");
		} finally {
			restoreWindow();
		}
	});

	it("reads stored booleans and respects default for missing keys", () => {
		installMockWindow();
		try {
			window.localStorage.removeItem("persisted-test-auto-connect");
			expect(readStoredBoolean("persisted-test-auto-connect", true)).toBe(true);
			expect(readStoredBoolean("persisted-test-auto-connect", false)).toBe(
				false,
			);

			window.localStorage.setItem("persisted-test-auto-connect", "true");
			expect(readStoredBoolean("persisted-test-auto-connect", false)).toBe(
				true,
			);

			window.localStorage.setItem("persisted-test-auto-connect", "false");
			expect(readStoredBoolean("persisted-test-auto-connect", true)).toBe(
				false,
			);
		} finally {
			restoreWindow();
		}
	});
});
