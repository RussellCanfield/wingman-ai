export const readStoredString = (key: string): string => {
	if (typeof window === "undefined") {
		return "";
	}
	try {
		return window.localStorage.getItem(key) || "";
	} catch {
		return "";
	}
};

export const readStoredBoolean = (
	key: string,
	defaultValue: boolean,
): boolean => {
	if (typeof window === "undefined") {
		return defaultValue;
	}
	try {
		const raw = window.localStorage.getItem(key);
		if (raw === null) {
			return defaultValue;
		}
		return raw === "true";
	} catch {
		return defaultValue;
	}
};
