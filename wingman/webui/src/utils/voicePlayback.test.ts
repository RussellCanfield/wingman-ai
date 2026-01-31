import { describe, expect, it } from "vitest";
import { getVoicePlaybackLabel } from "./voicePlayback";

describe("getVoicePlaybackLabel", () => {
	it("returns Play for idle", () => {
		expect(getVoicePlaybackLabel("idle")).toBe("Play");
	});

	it("returns Pending for pending", () => {
		expect(getVoicePlaybackLabel("pending")).toBe("Pending");
	});

	it("returns Loading for loading", () => {
		expect(getVoicePlaybackLabel("loading")).toBe("Loading");
	});

	it("returns Stop for playing", () => {
		expect(getVoicePlaybackLabel("playing")).toBe("Stop");
	});
});
