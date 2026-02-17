const NODE_NAME_PREFS_KEY = "wingman.desktop.node-name";

export function loadNodeNamePreference(storage: Storage = localStorage): string {
	try {
		const raw = storage.getItem(NODE_NAME_PREFS_KEY);
		return typeof raw === "string" ? raw : "";
	} catch {
		return "";
	}
}

export function saveNodeNamePreference(
	nodeName: string,
	storage: Storage = localStorage,
): void {
	storage.setItem(NODE_NAME_PREFS_KEY, nodeName);
}
