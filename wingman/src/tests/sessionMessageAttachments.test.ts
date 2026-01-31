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
});
