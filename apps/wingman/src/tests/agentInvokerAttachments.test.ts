import { describe, it, expect } from "vitest";
import { buildUserContent } from "../cli/core/agentInvoker.js";

describe("buildUserContent", () => {
	it("returns text when no attachments are provided", () => {
		expect(buildUserContent("Hello", undefined)).toBe("Hello");
	});

	it("builds mixed text and image parts", () => {
		const result = buildUserContent("Chart please", [
			{ dataUrl: "data:image/png;base64,abc" },
		]);
		expect(Array.isArray(result)).toBe(true);
		expect(result).toEqual([
			{ type: "text", text: "Chart please" },
			{ type: "image_url", image_url: { url: "data:image/png;base64,abc" } },
		]);
	});

	it("builds image-only parts when text is empty", () => {
		const result = buildUserContent("", [
			{ dataUrl: "data:image/png;base64,xyz" },
		]);
		expect(Array.isArray(result)).toBe(true);
		expect(result).toEqual([
			{ type: "image_url", image_url: { url: "data:image/png;base64,xyz" } },
		]);
	});

	it("builds audio parts when audio attachments are provided", () => {
		const result = buildUserContent("", [
			{ kind: "audio", dataUrl: "data:audio/wav;base64,abc", mimeType: "audio/wav" },
		]);
		expect(Array.isArray(result)).toBe(true);
		expect(result).toEqual([
			{ type: "audio", source_type: "base64", data: "abc", mime_type: "audio/wav" },
		]);
	});

	it("builds text parts for extracted file attachments", () => {
		const result = buildUserContent("Review this", [
			{
				kind: "file",
				dataUrl: "",
				name: "notes.md",
				mimeType: "text/markdown",
				textContent: "# Notes\n- keep media uploads working",
			},
		]);
		expect(Array.isArray(result)).toBe(true);
		expect(result).toEqual([
			{ type: "text", text: "Review this" },
			{
				type: "text",
				text: "[Attached file: notes.md (text/markdown)]\n# Notes\n- keep media uploads working",
			},
		]);
	});

	it("falls back when file attachment has no extracted text", () => {
		const result = buildUserContent("", [
			{
				kind: "file",
				dataUrl: "",
				name: "scan.pdf",
				mimeType: "application/pdf",
				textContent: "   ",
			},
		]);
		expect(Array.isArray(result)).toBe(true);
		expect(result).toEqual([
			{
				type: "text",
				text: "[Attached file: scan.pdf (application/pdf)]\n[No extractable text content provided.]",
			},
		]);
	});

	it("uses native pdf file blocks when the model supports pdf inputs", () => {
		const result = buildUserContent(
			"Summarize this",
			[
				{
					kind: "file",
					dataUrl: "data:application/pdf;base64,JVBERi0xLjQK",
					name: "report.pdf",
					mimeType: "application/pdf",
					textContent: "fallback text",
				},
			],
			{
				profile: {
					pdfInputs: true,
				},
			},
		);
		expect(Array.isArray(result)).toBe(true);
		expect(result).toEqual([
			{ type: "text", text: "Summarize this" },
			{
				type: "file",
				source_type: "base64",
				mime_type: "application/pdf",
				data: "JVBERi0xLjQK",
				metadata: {
					filename: "report.pdf",
					name: "report.pdf",
					title: "report.pdf",
				},
			},
		]);
	});

	it("falls back to extracted text when native pdf data is missing", () => {
		const result = buildUserContent(
			"",
			[
				{
					kind: "file",
					dataUrl: "",
					name: "report.pdf",
					mimeType: "application/pdf",
					textContent: "Parsed fallback content.",
				},
			],
			{
				profile: {
					pdfInputs: true,
				},
			},
		);
		expect(Array.isArray(result)).toBe(true);
		expect(result).toEqual([
			{
				type: "text",
				text: "[Attached file: report.pdf (application/pdf)]\nParsed fallback content.",
			},
		]);
	});
});
