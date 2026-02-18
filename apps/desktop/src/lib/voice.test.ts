import { describe, expect, test } from "vitest";
import { resolveVoiceConfig, sanitizeForSpeech } from "./voice.js";

describe("resolveVoiceConfig", () => {
	test("merges global and agent voice options", () => {
		const resolved = resolveVoiceConfig(
			{
				provider: "elevenlabs",
				webSpeech: { lang: "en-US", rate: 1.05 },
				elevenlabs: { modelId: "eleven-v3", stability: 0.4 },
			},
			{
				webSpeech: { voiceName: "Ava" },
				elevenlabs: { voiceId: "voice-1" },
			},
		);

		expect(resolved.provider).toBe("elevenlabs");
		expect(resolved.webSpeech.lang).toBe("en-US");
		expect(resolved.webSpeech.voiceName).toBe("Ava");
		expect(resolved.elevenlabs.modelId).toBe("eleven-v3");
		expect(resolved.elevenlabs.voiceId).toBe("voice-1");
	});

	test("defaults provider to web_speech", () => {
		const resolved = resolveVoiceConfig(undefined, undefined);
		expect(resolved.provider).toBe("web_speech");
	});
});

describe("sanitizeForSpeech", () => {
	test("strips markdown noise", () => {
		const cleaned = sanitizeForSpeech(`
# Header
> quote
- item one
1. item two
\`inline\`
[docs](https://example.com)
![img](https://example.com/image.png)
\`\`\`ts
const hidden = true
\`\`\`
`);
		expect(cleaned).toBe("Header quote item one item two inline docs img");
	});
});
