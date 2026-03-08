import { describe, expect, it } from "vitest";
import {
	findToolTextArg,
	formatToolDisplayName,
	normalizeToolPayloadValue,
} from "./toolDisplay.js";

describe("toolDisplay", () => {
	it("formats tool names into readable labels", () => {
		expect(formatToolDisplayName("functions.read_file")).toBe("Read File");
		expect(formatToolDisplayName("command_execute")).toBe("Run Command");
		expect(formatToolDisplayName("generate_audio_or_music")).toBe(
			"Generate Audio Or Music",
		);
	});

	it("finds nested fields inside stringified json tool args", () => {
		expect(
			findToolTextArg(
				{
					input:
						'{"file_path":"/memories/hotlist.json","offset":0,"limit":200}',
				},
				["file_path"],
			),
		).toBe("/memories/hotlist.json");
	});

	it("normalizes stringified json payloads before rendering", () => {
		expect(
			normalizeToolPayloadValue({
				input: '{"file_path":"/memories/hotlist.json","offset":0,"limit":200}',
			}),
		).toEqual({
			input: {
				file_path: "/memories/hotlist.json",
				limit: 200,
				offset: 0,
			},
		});
	});
});
