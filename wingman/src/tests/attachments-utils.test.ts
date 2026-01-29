import { describe, it, expect } from "vitest";
import { extractImageFiles } from "../../webui/src/utils/attachments.js";

describe("extractImageFiles", () => {
	it("returns only image files from clipboard items", () => {
		const image = new File(["data"], "chart.png", { type: "image/png" });
		const text = new File(["notes"], "notes.txt", { type: "text/plain" });
		const items = [
			{ kind: "file", type: "image/png", getAsFile: () => image },
			{ kind: "file", type: "text/plain", getAsFile: () => text },
			{ kind: "string", type: "text/plain", getAsFile: () => null },
		];

		const result = extractImageFiles(items);
		expect(result).toEqual([image]);
	});

	it("handles missing items", () => {
		expect(extractImageFiles(null)).toEqual([]);
	});
});
