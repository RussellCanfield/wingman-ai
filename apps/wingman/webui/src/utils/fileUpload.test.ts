import { describe, expect, it } from "vitest";
import {
	FILE_INPUT_ACCEPT,
	isPdfUploadFile,
	isSupportedTextUploadFile,
	readUploadFileText,
} from "./fileUpload";

describe("fileUpload utils", () => {
	it("includes pdf in file input accept list", () => {
		expect(FILE_INPUT_ACCEPT).toContain(".pdf");
		expect(FILE_INPUT_ACCEPT).toContain("image/*");
		expect(FILE_INPUT_ACCEPT).toContain("audio/*");
	});

	it("detects pdf files by mime type and extension", () => {
		expect(
			isPdfUploadFile({
				name: "report.bin",
				type: "application/pdf",
			} as File),
		).toBe(true);
		expect(
			isPdfUploadFile({
				name: "scan.PDF",
				type: "",
			} as File),
		).toBe(true);
		expect(
			isPdfUploadFile({
				name: "notes.txt",
				type: "text/plain",
			} as File),
		).toBe(false);
	});

	it("accepts supported text and code uploads while excluding media and pdf", () => {
		expect(
			isSupportedTextUploadFile({
				name: "notes.txt",
				type: "text/plain",
			} as File),
		).toBe(true);
		expect(
			isSupportedTextUploadFile({
				name: "script.ts",
				type: "",
			} as File),
		).toBe(true);
		expect(
			isSupportedTextUploadFile({
				name: "scan.pdf",
				type: "application/pdf",
			} as File),
		).toBe(false);
		expect(
			isSupportedTextUploadFile({
				name: "image.png",
				type: "image/png",
			} as File),
		).toBe(false);
	});

	it("reads and truncates text files", async () => {
		const file = new File(["1234567890"], "notes.txt", { type: "text/plain" });
		const result = await readUploadFileText(file, 5);
		expect(result.truncated).toBe(true);
		expect(result.usedPdfFallback).toBe(false);
		expect(result.textContent).toContain("[File content truncated for prompt size limits.]");
	});

	it("extracts literal text blocks from basic pdf content", async () => {
		const pdfSource = "%PDF-1.4\n1 0 obj\n(Hello PDF) Tj\nendobj\n%%EOF";
		const file = new File([pdfSource], "sample.pdf", {
			type: "application/pdf",
		});
		const result = await readUploadFileText(file, 1000);
		expect(result.usedPdfFallback).toBe(false);
		expect(result.textContent).toContain("Hello PDF");
	});

	it("extracts text from quote operators", async () => {
		const pdfSource = "%PDF-1.4\n1 0 obj\n(Quote Hello) '\n(Spacing Hello) \"\nendobj\n%%EOF";
		const file = new File([pdfSource], "quotes.pdf", {
			type: "application/pdf",
		});
		const result = await readUploadFileText(file, 1000);
		expect(result.usedPdfFallback).toBe(false);
		expect(result.textContent).toContain("Quote Hello");
		expect(result.textContent).toContain("Spacing Hello");
	});

	it("extracts text from flate-compressed streams when decompression is available", async () => {
		if (typeof CompressionStream === "undefined") {
			return;
		}
		const payload = new TextEncoder().encode("BT\n(Compressed Hello) Tj\nET\n");
		const compressed = await compressDeflate(payload);
		const prefix = new TextEncoder().encode(
			"%PDF-1.4\n1 0 obj\n<< /Length 999 /Filter /FlateDecode >>\nstream\n",
		);
		const suffix = new TextEncoder().encode("\nendstream\nendobj\n%%EOF");
		const bytes = new Uint8Array(prefix.length + compressed.length + suffix.length);
		bytes.set(prefix, 0);
		bytes.set(compressed, prefix.length);
		bytes.set(suffix, prefix.length + compressed.length);
		const file = new File([bytes], "compressed.pdf", {
			type: "application/pdf",
		});
		const result = await readUploadFileText(file, 1000);
		expect(result.usedPdfFallback).toBe(false);
		expect(result.textContent).toContain("Compressed Hello");
	});

	it("extracts text from ASCII85 + Flate filter chain when decompression is available", async () => {
		if (typeof CompressionStream === "undefined") {
			return;
		}
		const payload = new TextEncoder().encode("BT\n(Chain Hello) Tj\nET\n");
		const compressed = await compressDeflate(payload);
		const ascii85 = encodeAscii85(compressed);
		const pdf = `%PDF-1.4
1 0 obj
<< /Length ${ascii85.length + 4} /Filter [/ASCII85Decode /FlateDecode] >>
stream
<~${ascii85}~>
endstream
endobj
%%EOF`;
		const file = new File([pdf], "chain.pdf", { type: "application/pdf" });
		const result = await readUploadFileText(file, 1000);
		expect(result.usedPdfFallback).toBe(false);
		expect(result.textContent).toContain("Chain Hello");
	});

	it("falls back when pdf text cannot be extracted", async () => {
		const bytes = new Uint8Array([0, 255, 0, 255, 0, 255]);
		const file = new File([bytes], "scan.pdf", {
			type: "application/pdf",
		});
		const result = await readUploadFileText(file, 1000);
		expect(result.usedPdfFallback).toBe(true);
		expect(result.textContent).toContain("No extractable text was found in this PDF");
	});
});

async function compressDeflate(data: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([data]).stream().pipeThrough(
		new CompressionStream("deflate"),
	);
	const result = await new Response(stream).arrayBuffer();
	return new Uint8Array(result);
}

function encodeAscii85(data: Uint8Array): string {
	let out = "";
	for (let i = 0; i < data.length; i += 4) {
		const remain = Math.min(4, data.length - i);
		const chunk = [
			data[i] || 0,
			data[i + 1] || 0,
			data[i + 2] || 0,
			data[i + 3] || 0,
		];
		const value =
			(((chunk[0] << 24) >>> 0) |
				((chunk[1] << 16) >>> 0) |
				((chunk[2] << 8) >>> 0) |
				(chunk[3] >>> 0)) >>>
			0;
		if (value === 0 && remain === 4) {
			out += "z";
			continue;
		}
		const digits = new Array<number>(5).fill(0);
		let acc = value;
		for (let d = 4; d >= 0; d -= 1) {
			digits[d] = (acc % 85) + 33;
			acc = Math.floor(acc / 85);
		}
		const block = String.fromCharCode(...digits);
		out += remain < 4 ? block.slice(0, remain + 1) : block;
	}
	return out;
}
