import { describe, expect, test } from "vitest";
import {
	FILE_INPUT_ACCEPT,
	isPdfUploadFile,
	isSupportedTextUploadFile,
	readUploadFileText,
} from "./fileUpload.js";

describe("fileUpload", () => {
	test("includes image/audio/pdf in accepted upload types", () => {
		expect(FILE_INPUT_ACCEPT).toContain("image/*");
		expect(FILE_INPUT_ACCEPT).toContain("audio/*");
		expect(FILE_INPUT_ACCEPT).toContain(".pdf");
	});

	test("detects text and pdf files", () => {
		expect(isSupportedTextUploadFile({ name: "notes.md", type: "text/markdown" } as File)).toBe(
			true,
		);
		expect(
			isSupportedTextUploadFile({ name: "script.ts", type: "" } as File),
		).toBe(true);
		expect(isPdfUploadFile({ name: "scan.PDF", type: "" } as File)).toBe(true);
		expect(isSupportedTextUploadFile({ name: "scan.pdf", type: "application/pdf" } as File)).toBe(
			false,
		);
	});

	test("reads and truncates text files", async () => {
		const file = new File(["1234567890"], "notes.txt", { type: "text/plain" });
		const result = await readUploadFileText(file, 5);
		expect(result.truncated).toBe(true);
		expect(result.usedPdfFallback).toBe(false);
		expect(result.textContent).toContain("[File content truncated for prompt size limits.]");
	});

	test("extracts basic literal text from pdf", async () => {
		const pdfSource = "%PDF-1.4\n1 0 obj\n(Hello PDF) Tj\nendobj\n%%EOF";
		const file = new File([pdfSource], "sample.pdf", { type: "application/pdf" });
		const result = await readUploadFileText(file, 1000);
		expect(result.usedPdfFallback).toBe(false);
		expect(result.textContent).toContain("Hello PDF");
	});

	test("uses fallback when pdf text is not extractable", async () => {
		const bytes = new Uint8Array([0, 255, 0, 255]);
		const file = new File([bytes], "scan.pdf", { type: "application/pdf" });
		const result = await readUploadFileText(file, 1000);
		expect(result.usedPdfFallback).toBe(true);
		expect(result.textContent).toContain("No extractable text was found in this PDF");
	});
});
