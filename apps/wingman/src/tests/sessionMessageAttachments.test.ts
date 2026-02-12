import { describe, it, expect } from "vitest";
import { extractAttachments, extractImageAttachments } from "../cli/core/sessionManager.js";

describe("extractImageAttachments", () => {
	it("extracts image_url blocks", () => {
		const blocks = [
			{ type: "image_url", image_url: { url: "data:image/png;base64,abc" } },
		];
		expect(extractImageAttachments(blocks)).toEqual([
			{ kind: "image", dataUrl: "data:image/png;base64,abc" },
		]);
	});

	it("extracts input_image blocks", () => {
		const blocks = [
			{ type: "input_image", image_url: "data:image/jpeg;base64,xyz" },
		];
		expect(extractImageAttachments(blocks)).toEqual([
			{ kind: "image", dataUrl: "data:image/jpeg;base64,xyz" },
		]);
	});

	it("extracts base64 image blocks", () => {
		const blocks = [
			{
				type: "image",
				source: { media_type: "image/png", data: "zzz" },
			},
		];
		expect(extractImageAttachments(blocks)).toEqual([
			{ kind: "image", dataUrl: "data:image/png;base64,zzz" },
		]);
	});

	it("extracts MCP image blocks with inline base64 payload", () => {
		const blocks = [
			{
				type: "image",
				mimeType: "image/png",
				data: "abc123",
			},
		];
		expect(extractImageAttachments(blocks)).toEqual([
			{ kind: "image", dataUrl: "data:image/png;base64,abc123" },
		]);
	});

	it("extracts resource_link image blocks", () => {
		const blocks = [
			{
				type: "resource_link",
				uri: "/api/fs/file?path=%2Ftmp%2Fgenerated.png",
				mimeType: "image/png",
			},
		];
		expect(extractImageAttachments(blocks)).toEqual([
			{
				kind: "image",
				dataUrl: "/api/fs/file?path=%2Ftmp%2Fgenerated.png",
			},
		]);
	});
});

describe("extractAttachments", () => {
	it("extracts input_audio blocks", () => {
		const blocks = [
			{ type: "input_audio", input_audio: { data: "abc", format: "wav" } },
		];
		expect(extractAttachments(blocks)).toEqual([
			{ kind: "audio", dataUrl: "data:audio/wav;base64,abc" },
		]);
	});

	it("extracts audio_url blocks", () => {
		const blocks = [
			{ type: "audio_url", audio_url: { url: "https://cdn.example/audio.mp3" } },
		];
		expect(extractAttachments(blocks)).toEqual([
			{ kind: "audio", dataUrl: "https://cdn.example/audio.mp3" },
		]);
	});

	it("extracts base64 audio blocks", () => {
		const blocks = [
			{ type: "audio", source_type: "base64", data: "abc", mime_type: "audio/wav" },
		];
		expect(extractAttachments(blocks)).toEqual([
			{ kind: "audio", dataUrl: "data:audio/wav;base64,abc" },
		]);
	});

	it("extracts standardized base64 file blocks", () => {
		const blocks = [
			{
				type: "file",
				source_type: "base64",
				data: "JVBERi0xLjQK",
				mime_type: "application/pdf",
				metadata: { filename: "report.pdf" },
			},
		];
		expect(extractAttachments(blocks)).toEqual([
			{
				kind: "file",
				dataUrl: "data:application/pdf;base64,JVBERi0xLjQK",
				name: "report.pdf",
				mimeType: "application/pdf",
			},
		]);
	});

	it("extracts input_file blocks", () => {
		const blocks = [
			{
				type: "input_file",
				file_data: "data:application/pdf;base64,JVBERi0xLjQK",
				filename: "invoice.pdf",
			},
		];
		expect(extractAttachments(blocks)).toEqual([
			{
				kind: "file",
				dataUrl: "data:application/pdf;base64,JVBERi0xLjQK",
				name: "invoice.pdf",
				mimeType: "application/pdf",
			},
		]);
	});

	it("extracts anthropic document blocks", () => {
		const blocks = [
			{
				type: "document",
				title: "scan.pdf",
				source: {
					type: "base64",
					media_type: "application/pdf",
					data: "JVBERi0xLjQK",
				},
			},
		];
		expect(extractAttachments(blocks)).toEqual([
			{
				kind: "file",
				dataUrl: "data:application/pdf;base64,JVBERi0xLjQK",
				name: "scan.pdf",
				mimeType: "application/pdf",
			},
		]);
	});
});
