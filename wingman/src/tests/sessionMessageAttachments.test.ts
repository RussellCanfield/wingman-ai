import { describe, it, expect } from "vitest";
import { extractImageAttachments } from "../cli/core/sessionManager.js";

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
