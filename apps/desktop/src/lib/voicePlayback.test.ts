import { describe, expect, test } from "vitest";
import { getVoicePlaybackLabel } from "./voicePlayback.js";

describe("getVoicePlaybackLabel", () => {
	test("maps each state to a label", () => {
		expect(getVoicePlaybackLabel("idle")).toBe("Play");
		expect(getVoicePlaybackLabel("pending")).toBe("Pending");
		expect(getVoicePlaybackLabel("loading")).toBe("Loading");
		expect(getVoicePlaybackLabel("playing")).toBe("Stop");
	});
});
