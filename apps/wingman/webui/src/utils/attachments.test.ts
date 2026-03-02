import { afterEach, describe, expect, it, vi } from "vitest";
import {
	extractClipboardFiles,
	extractImageFiles,
	hasImageClipboardType,
	readImageFilesFromNavigatorClipboard,
} from "./attachments";

type ClipboardItemLike = {
	kind?: string;
	type?: string;
	getAsFile?: () => File | null;
};

const makeItem = (input: {
	kind?: string;
	type?: string;
	file?: File | null;
}): ClipboardItemLike => {
	return {
		kind: input.kind ?? "file",
		type: input.type ?? "",
		getAsFile: () => input.file ?? null,
	};
};

const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
	globalThis,
	"navigator",
);

afterEach(() => {
	if (originalNavigatorDescriptor) {
		Object.defineProperty(globalThis, "navigator", originalNavigatorDescriptor);
		return;
	}
	Reflect.deleteProperty(globalThis, "navigator");
});

describe("extractImageFiles", () => {
	it("extracts image files from clipboard items", () => {
		const image = new File(["img"], "shot.png", { type: "image/png" });
		const result = extractImageFiles([
			makeItem({ type: "image/png", file: image }),
		]);
		expect(result).toEqual([image]);
	});

	it("falls back to file mime type when clipboard item type is blank", () => {
		const image = new File(["img"], "shot.png", { type: "image/png" });
		const result = extractImageFiles([makeItem({ type: "", file: image })]);
		expect(result).toEqual([image]);
	});

	it("accepts public image UTI clipboard types", () => {
		const image = new File(["img"], "", { type: "" });
		const result = extractImageFiles([
			makeItem({ type: "public.tiff", file: image }),
		]);
		expect(result).toEqual([image]);
	});

	it("accepts unnamed clipboard binaries as image candidates", () => {
		const image = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "", {
			type: "",
		});
		const result = extractImageFiles([makeItem({ type: "", file: image })]);
		expect(result).toEqual([image]);
	});

	it("extracts from DataTransfer files when clipboard items are unavailable", () => {
		const image = new File(["img"], "shot.png", { type: "image/png" });
		const result = extractImageFiles(undefined, [image]);
		expect(result).toEqual([image]);
	});

	it("ignores non-image content", () => {
		const textFile = new File(["hello"], "note.txt", { type: "text/plain" });
		const result = extractImageFiles(
			[makeItem({ type: "text/plain", file: textFile })],
			[textFile],
		);
		expect(result).toHaveLength(0);
	});

	it("deduplicates identical files reported in both items and files", () => {
		const image = new File(["img"], "shot.png", { type: "image/png" });
		const result = extractImageFiles(
			[makeItem({ type: "image/png", file: image })],
			[image],
		);
		expect(result).toHaveLength(1);
		expect(result[0]).toBe(image);
	});
});

describe("extractClipboardFiles", () => {
	it("extracts files directly from clipboard DataTransfer files", () => {
		const image = new File(["img"], "shot.png", { type: "image/png" });
		const result = extractClipboardFiles(undefined, [image]);
		expect(result).toEqual([image]);
	});

	it("accepts image-typed clipboard items even when kind is not file", () => {
		const image = new File(["img"], "clipboard", { type: "" });
		const result = extractClipboardFiles([
			makeItem({ kind: "string", type: "public.tiff", file: image }),
		]);
		expect(result).toEqual([image]);
	});

	it("deduplicates identical files from items and file lists", () => {
		const image = new File(["img"], "shot.png", { type: "image/png" });
		const result = extractClipboardFiles(
			[makeItem({ type: "image/png", file: image })],
			[image],
		);
		expect(result).toHaveLength(1);
		expect(result[0]).toBe(image);
	});
});

describe("clipboard helpers", () => {
	it("detects image clipboard types", () => {
		expect(hasImageClipboardType(["text/plain", "public.tiff"])).toBe(true);
		expect(hasImageClipboardType(["text/plain"])).toBe(false);
	});

	it("reads image blobs via navigator clipboard fallback", async () => {
		const read = vi.fn(async () => [
			{
				types: ["public.tiff"],
				getType: async (type: string) =>
					type === "public.tiff"
						? new Blob([new Uint8Array([0x49, 0x49, 0x2a, 0x00])], { type: "" })
						: new Blob(),
			},
		]);
		Object.defineProperty(globalThis, "navigator", {
			value: { clipboard: { read } },
			configurable: true,
		});
		const files = await readImageFilesFromNavigatorClipboard();
		expect(files).toHaveLength(1);
		expect(files[0].type).toBe("image/tiff");
		expect(files[0].name).toMatch(/\.tiff$/);
	});

	it("returns empty fallback files when clipboard read is unavailable", async () => {
		Object.defineProperty(globalThis, "navigator", {
			value: { clipboard: {} },
			configurable: true,
		});
		const files = await readImageFilesFromNavigatorClipboard();
		expect(files).toEqual([]);
	});
});
