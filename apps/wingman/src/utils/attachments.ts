type ClipboardItemLike = {
	kind: string;
	type: string;
	getAsFile?: () => File | null;
};

export function extractImageFiles(items?: ArrayLike<ClipboardItemLike> | null): File[] {
	const files: File[] = [];
	if (!items) return files;
	for (let i = 0; i < items.length; i += 1) {
		const item = items[i];
		if (!item || item.kind !== "file" || !item.type.startsWith("image/")) {
			continue;
		}
		const file = item.getAsFile?.();
		if (file) {
			files.push(file);
		}
	}
	return files;
}
