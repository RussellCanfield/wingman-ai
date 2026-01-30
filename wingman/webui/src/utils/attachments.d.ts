type ClipboardItemLike = {
    kind: string;
    type: string;
    getAsFile?: () => File | null;
};
export declare function extractImageFiles(items?: ArrayLike<ClipboardItemLike> | null): File[];
export {};
