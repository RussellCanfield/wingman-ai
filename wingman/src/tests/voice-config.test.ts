import { describe, it, expect } from "vitest";
import { resolveVoiceConfig } from "../voice/config.js";
import { VoiceConfigSchema } from "../types/voice.js";

describe("Voice config resolver", () => {
	it("merges agent overrides onto global defaults", () => {
		const global = VoiceConfigSchema.parse({
			provider: "elevenlabs",
			elevenlabs: {
				voiceId: "global-voice",
				stability: 0.45,
			},
			webSpeech: {
				rate: 1.2,
			},
		});

		const resolved = resolveVoiceConfig(global, {
			provider: "elevenlabs",
			elevenlabs: {
				voiceId: "agent-voice",
				style: 0.3,
			},
		});

		expect(resolved.provider).toBe("elevenlabs");
		expect(resolved.elevenlabs.voiceId).toBe("agent-voice");
		expect(resolved.elevenlabs.stability).toBe(0.45);
		expect(resolved.elevenlabs.style).toBe(0.3);
		expect(resolved.webSpeech.rate).toBe(1.2);
	});
});
