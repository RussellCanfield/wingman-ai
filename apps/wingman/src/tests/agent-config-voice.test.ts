import { describe, expect, it } from "vitest";
import { validateAgentConfig } from "../agent/config/agentConfig.js";

describe("Agent config voice settings", () => {
	it("accepts voice configuration in agent config", () => {
		const result = validateAgentConfig({
			name: "voice-agent",
			description: "Tests voice settings.",
			systemPrompt: "Respond clearly.",
			voice: {
				provider: "elevenlabs",
				elevenlabs: {
					voiceId: "voice-123",
					stability: 0.4,
				},
			},
		});

		expect(result.success).toBe(true);
	});
});
