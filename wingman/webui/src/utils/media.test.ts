import { describe, expect, it } from "vitest";
import { getAudioAvailability } from "./media";

describe("getAudioAvailability", () => {
	it("returns playable for data audio urls", () => {
		const result = getAudioAvailability({
			id: "1",
			kind: "audio",
			dataUrl: "data:audio/wav;base64,abc",
		});
		expect(result.playable).toBe(true);
	});

	it("returns playable for blob urls", () => {
		const result = getAudioAvailability({
			id: "2",
			kind: "audio",
			dataUrl: "blob:https://example.com/123",
		});
		expect(result.playable).toBe(false);
	});

	it("returns playable for http urls", () => {
		const result = getAudioAvailability({
			id: "3",
			kind: "audio",
			dataUrl: "https://cdn.example/audio.mp3",
		});
		expect(result.playable).toBe(true);
	});

	it("returns unavailable when url is missing", () => {
		const result = getAudioAvailability({
			id: "4",
			kind: "audio",
			dataUrl: "",
		});
		expect(result.playable).toBe(false);
		expect(result.reason).toBeDefined();
	});

	it("returns unavailable when url is unsupported", () => {
		const result = getAudioAvailability({
			id: "5",
			kind: "audio",
			dataUrl: "file:///tmp/audio.wav",
		});
		expect(result.playable).toBe(false);
	});

	it("returns unavailable when data url has no payload", () => {
		const result = getAudioAvailability({
			id: "6",
			kind: "audio",
			dataUrl: "data:audio/wav;base64,",
		});
		expect(result.playable).toBe(false);
	});
});
