import { describe, expect, it } from "vitest";
import type { ChatAttachment } from "../types";
import { mergeUniqueAttachments } from "./attachmentDedupe";

const imageAttachment = (id: string, dataUrl: string): ChatAttachment => ({
	id,
	kind: "image",
	dataUrl,
	name: "Screenshot.png",
	mimeType: "image/png",
	size: 1280,
});

describe("mergeUniqueAttachments", () => {
	it("appends unique attachments", () => {
		const existing = [imageAttachment("a1", "data:image/png;base64,one")];
		const incoming = [imageAttachment("a2", "data:image/png;base64,two")];

		const merged = mergeUniqueAttachments(existing, incoming);

		expect(merged).toHaveLength(2);
		expect(merged.map((attachment) => attachment.id)).toEqual(["a1", "a2"]);
	});

	it("deduplicates identical attachments with different ids", () => {
		const existing = [imageAttachment("a1", "data:image/png;base64,shot")];
		const incoming = [imageAttachment("a2", "data:image/png;base64,shot")];

		const merged = mergeUniqueAttachments(existing, incoming);

		expect(merged).toHaveLength(1);
		expect(merged[0]?.id).toBe("a1");
	});

	it("deduplicates duplicate attachments within the same incoming batch", () => {
		const incoming = [
			imageAttachment("a1", "data:image/png;base64,shot"),
			imageAttachment("a2", "data:image/png;base64,shot"),
		];

		const merged = mergeUniqueAttachments([], incoming);

		expect(merged).toHaveLength(1);
		expect(merged[0]?.id).toBe("a1");
	});
});
