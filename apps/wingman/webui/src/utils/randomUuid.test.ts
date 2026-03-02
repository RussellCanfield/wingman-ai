import { afterEach, describe, expect, it, vi } from "vitest";
import { installRandomUuidPolyfill, randomUuid } from "./randomUuid";

const UUID_V4_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("randomUuid", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("uses native crypto.randomUUID when available", () => {
		const nativeRandomUuid = vi.fn(() => "native-id");
		vi.stubGlobal("crypto", {
			randomUUID: nativeRandomUuid,
			getRandomValues: vi.fn(),
		});

		expect(randomUuid()).toBe("native-id");
		expect(nativeRandomUuid).toHaveBeenCalledTimes(1);
	});

	it("falls back to getRandomValues and emits a v4 uuid", () => {
		vi.stubGlobal("crypto", {
			getRandomValues: (bytes: Uint8Array) => {
				for (let index = 0; index < bytes.length; index += 1) {
					bytes[index] = index + 1;
				}
				return bytes;
			},
		});

		const id = randomUuid();
		expect(id).toMatch(UUID_V4_REGEX);
	});
});

describe("installRandomUuidPolyfill", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("adds crypto.randomUUID when it is missing", () => {
		const cryptoLike: {
			randomUUID?: () => string;
			getRandomValues: (array: Uint8Array) => Uint8Array;
		} = {
			getRandomValues: (bytes) => {
				for (let index = 0; index < bytes.length; index += 1) {
					bytes[index] = 255 - index;
				}
				return bytes;
			},
		};

		vi.stubGlobal("window", { crypto: cryptoLike });
		vi.stubGlobal("crypto", cryptoLike);

		installRandomUuidPolyfill();

		expect(typeof cryptoLike.randomUUID).toBe("function");
		expect(cryptoLike.randomUUID?.()).toMatch(UUID_V4_REGEX);
	});
});
