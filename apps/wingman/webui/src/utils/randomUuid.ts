const byteToHex = (value: number): string =>
	value.toString(16).padStart(2, "0");

const createFallbackRandomUuid = (): string => {
	const bytes = new Uint8Array(16);
	if (typeof globalThis.crypto?.getRandomValues === "function") {
		globalThis.crypto.getRandomValues(bytes);
	} else {
		for (let i = 0; i < bytes.length; i += 1) {
			bytes[i] = Math.floor(Math.random() * 256);
		}
	}

	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	const hex = Array.from(bytes, byteToHex).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
		16,
		20,
	)}-${hex.slice(20)}`;
};

export const randomUuid = (): string => {
	if (typeof globalThis.crypto?.randomUUID === "function") {
		return globalThis.crypto.randomUUID();
	}
	return createFallbackRandomUuid();
};

export const installRandomUuidPolyfill = (): void => {
	if (typeof window === "undefined") return;
	const cryptoObject = window.crypto as Crypto & {
		randomUUID?: () => string;
	};
	if (!cryptoObject || typeof cryptoObject.randomUUID === "function") return;

	try {
		cryptoObject.randomUUID = () => createFallbackRandomUuid();
	} catch {
		// Some runtimes may block mutating Crypto methods; local randomUuid() fallback still works.
	}
};
