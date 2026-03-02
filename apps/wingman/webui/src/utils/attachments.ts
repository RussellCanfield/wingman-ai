type ClipboardItemLike = {
	kind?: string;
	type?: string;
	getAsFile?: () => File | null;
};

type ClipboardNavigatorItemLike = {
	types?: string[];
	getType?: (type: string) => Promise<Blob>;
};

const IMAGE_EXTENSION_PATTERN =
	/\.(png|jpe?g|gif|webp|bmp|tiff?|heic|heif|avif)$/i;

const isImageClipboardType = (value: string): boolean => {
	const normalized = (value || "").trim().toLowerCase();
	if (!normalized) return false;
	if (normalized.startsWith("image/")) return true;
	if (
		normalized === "public.png" ||
		normalized === "public.jpeg" ||
		normalized === "public.jpg" ||
		normalized === "public.tiff" ||
		normalized === "public.gif" ||
		normalized === "public.webp" ||
		normalized === "public.bmp" ||
		normalized === "public.heic" ||
		normalized === "public.heif" ||
		normalized === "public.avif"
	) {
		return true;
	}
	return false;
};

const isImageFile = (file: File, itemType?: string): boolean => {
	const normalizedItemType = (itemType || "").trim().toLowerCase();
	if (isImageClipboardType(normalizedItemType)) return true;
	const normalizedFileType = (file.type || "").trim().toLowerCase();
	if (isImageClipboardType(normalizedFileType)) return true;
	if (IMAGE_EXTENSION_PATTERN.test(file.name || "")) return true;
	// Some clipboard payloads (notably screenshot tools) omit both mime and name.
	return (
		normalizedItemType.length === 0 &&
		normalizedFileType.length === 0 &&
		(file.name || "").trim().length === 0 &&
		file.size > 0
	);
};

const buildFileKey = (file: File): string => {
	return [file.name || "", file.size, file.lastModified, file.type || ""].join(
		"::",
	);
};

const addUniqueFile = (
	file: File,
	collected: File[],
	seen: Set<string>,
): void => {
	const key = buildFileKey(file);
	if (seen.has(key)) return;
	seen.add(key);
	collected.push(file);
};

const shouldReadClipboardItemFile = (item: ClipboardItemLike): boolean => {
	const kind = (item.kind || "").trim().toLowerCase();
	if (kind === "file") return true;
	// Some browser/platform clipboard bridges expose image types with a non-file kind.
	return isImageClipboardType(item.type || "");
};

const normalizeClipboardImageMimeType = (value: string): string => {
	const normalized = (value || "").trim().toLowerCase();
	if (normalized.startsWith("image/")) return normalized;
	if (normalized === "public.png") return "image/png";
	if (normalized === "public.jpeg" || normalized === "public.jpg")
		return "image/jpeg";
	if (normalized === "public.tiff") return "image/tiff";
	if (normalized === "public.gif") return "image/gif";
	if (normalized === "public.webp") return "image/webp";
	if (normalized === "public.bmp") return "image/bmp";
	if (normalized === "public.heic") return "image/heic";
	if (normalized === "public.heif") return "image/heif";
	if (normalized === "public.avif") return "image/avif";
	return "";
};

const resolveImageExtension = (mimeType: string): string => {
	const normalized = (mimeType || "").trim().toLowerCase();
	if (normalized === "image/png") return "png";
	if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg";
	if (normalized === "image/gif") return "gif";
	if (normalized === "image/webp") return "webp";
	if (normalized === "image/bmp") return "bmp";
	if (normalized === "image/tif" || normalized === "image/tiff") return "tiff";
	if (normalized === "image/heic") return "heic";
	if (normalized === "image/heif") return "heif";
	if (normalized === "image/avif") return "avif";
	return "img";
};

const getNavigatorClipboardRead = ():
	| (() => Promise<ClipboardNavigatorItemLike[]>)
	| null => {
	const clipboard = (globalThis as { navigator?: Navigator }).navigator
		?.clipboard as
		| (Clipboard & {
				read?: () => Promise<ClipboardNavigatorItemLike[]>;
		  })
		| undefined;
	if (!clipboard || typeof clipboard.read !== "function") {
		return null;
	}
	return clipboard.read.bind(clipboard);
};

export function hasImageClipboardType(
	types?: ArrayLike<string> | null,
): boolean {
	if (!types) return false;
	for (let i = 0; i < types.length; i += 1) {
		if (isImageClipboardType(types[i] || "")) return true;
	}
	return false;
}

export async function readImageFilesFromNavigatorClipboard(): Promise<File[]> {
	const read = getNavigatorClipboardRead();
	if (!read) return [];
	let items: ClipboardNavigatorItemLike[] = [];
	try {
		items = await read();
	} catch {
		return [];
	}
	if (!Array.isArray(items) || items.length === 0) {
		return [];
	}

	const now = Date.now();
	const files: File[] = [];
	const seenBlobKeys = new Set<string>();

	for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
		const item = items[itemIndex];
		const itemTypes = Array.isArray(item.types) ? item.types : [];
		if (typeof item.getType !== "function") continue;
		for (let typeIndex = 0; typeIndex < itemTypes.length; typeIndex += 1) {
			const type = itemTypes[typeIndex];
			if (!isImageClipboardType(type || "")) continue;
			try {
				const blob = await item.getType(type);
				if (!blob || blob.size === 0) continue;
				const mimeType =
					normalizeClipboardImageMimeType(blob.type || type || "") ||
					"application/octet-stream";
				const blobKey = `${mimeType}::${blob.size}`;
				if (seenBlobKeys.has(blobKey)) continue;
				seenBlobKeys.add(blobKey);
				const extension = resolveImageExtension(mimeType);
				const name = `clipboard-image-${now}-${itemIndex}-${typeIndex}.${extension}`;
				files.push(
					new File([blob], name, {
						type: mimeType,
						lastModified: now,
					}),
				);
			} catch {
				// Ignore unsupported clipboard types and continue scanning.
			}
		}
	}

	return files;
}

export function extractClipboardFiles(
	items?: ArrayLike<ClipboardItemLike> | null,
	files?: ArrayLike<File> | null,
): File[] {
	const collected: File[] = [];
	const seen = new Set<string>();

	if (items) {
		for (let i = 0; i < items.length; i += 1) {
			const item = items[i];
			if (!item || !shouldReadClipboardItemFile(item)) continue;
			const file = item.getAsFile?.();
			if (!file) continue;
			addUniqueFile(file, collected, seen);
		}
	}

	if (files) {
		for (let i = 0; i < files.length; i += 1) {
			const file = files[i];
			if (!file) continue;
			addUniqueFile(file, collected, seen);
		}
	}

	return collected;
}

export function extractImageFiles(
	items?: ArrayLike<ClipboardItemLike> | null,
	files?: ArrayLike<File> | null,
): File[] {
	const collected: File[] = [];
	const seen = new Set<string>();

	if (items) {
		for (let i = 0; i < items.length; i += 1) {
			const item = items[i];
			if (!item || !shouldReadClipboardItemFile(item)) continue;
			const file = item.getAsFile?.();
			if (!file || !isImageFile(file, item.type)) continue;
			addUniqueFile(file, collected, seen);
		}
	}

	if (files) {
		for (let i = 0; i < files.length; i += 1) {
			const file = files[i];
			if (!file || !isImageFile(file)) continue;
			addUniqueFile(file, collected, seen);
		}
	}
	return collected;
}
