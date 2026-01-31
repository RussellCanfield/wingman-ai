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
			{ type: "input_audio", input_audio: { data: "abc", format: "wav" } },
		]);
	});
});
