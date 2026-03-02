type ClipboardItemLike = {
	kind?: string;
	type?: string;
	getAsFile?: () => File | null;
};
export declare function hasImageClipboardType(
	types?: ArrayLike<string> | null,
): boolean;
export declare function readImageFilesFromNavigatorClipboard(): Promise<File[]>;
export declare function extractClipboardFiles(
	items?: ArrayLike<ClipboardItemLike> | null,
	files?: ArrayLike<File> | null,
): File[];
export declare function extractImageFiles(
	items?: ArrayLike<ClipboardItemLike> | null,
	files?: ArrayLike<File> | null,
): File[];
