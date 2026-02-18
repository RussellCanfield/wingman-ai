import { describe, expect, test } from "vitest";
import {
	buildAttachmentPreviewText,
	clipFilePreview,
	formatAttachmentMeta,
	isAudioAttachment,
	isFileAttachment,
	isPdfAttachment,
	readFileAsDataUrl,
} from "./chatAttachments.js";

describe("chatAttachments", () => {
	test("builds attachment preview labels", () => {
		expect(
			buildAttachmentPreviewText([
				{ id: "1", kind: "image", dataUrl: "data:image/png;base64,aa" },
			]),
		).toBe("Image attachment");
		expect(
			buildAttachmentPreviewText([
				{ id: "1", kind: "audio", dataUrl: "data:audio/webm;base64,aa" },
				{ id: "2", kind: "file", dataUrl: "", textContent: "abc" },
			]),
		).toBe("File and media attachments");
	});

	test("detects audio and file attachments", () => {
		expect(
			isAudioAttachment({
				id: "a",
				kind: "image",
				dataUrl: "data:audio/mp3;base64,aa",
			}),
		).toBe(true);
		expect(
			isFileAttachment({
				id: "f",
				kind: "image",
				dataUrl: "",
				textContent: "from file",
			}),
		).toBe(true);
	});

	test("detects pdf attachments", () => {
		expect(
			isPdfAttachment({
				id: "p1",
				kind: "file",
				dataUrl: "",
				mimeType: "application/pdf",
			}),
		).toBe(true);
		expect(
			isPdfAttachment({
				id: "p2",
				kind: "file",
				dataUrl: "data:application/pdf;base64,aa",
			}),
		).toBe(true);
		expect(
			isPdfAttachment({
				id: "p3",
				kind: "file",
				dataUrl: "",
				name: "scan.PDF",
			}),
		).toBe(true);
	});

	test("formats attachment metadata", () => {
		const meta = formatAttachmentMeta({
			id: "1",
			kind: "file",
			dataUrl: "",
			mimeType: "text/plain",
			size: 1536,
		});
		expect(meta).toContain("text/plain");
		expect(meta).toContain("1.5 KB");
	});

	test("clips file preview text", () => {
		const clipped = clipFilePreview("a".repeat(300), 32);
		expect(clipped.length).toBeLessThanOrEqual(35);
		expect(clipped.endsWith("...")).toBe(true);
	});

	test("creates data url from file", async () => {
		const file = new File(["hello"], "hello.txt", { type: "text/plain" });
		const dataUrl = await readFileAsDataUrl(file);
		expect(dataUrl.startsWith("data:text/plain")).toBe(true);
		expect(dataUrl.includes(";base64,")).toBe(true);
	});
});
