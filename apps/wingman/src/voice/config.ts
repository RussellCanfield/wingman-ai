import {
	VoiceConfigSchema,
	type AgentVoiceConfig,
	type ElevenLabsOptions,
	type VoiceConfig,
	type VoicePolicy,
	type VoiceProvider,
	type WebSpeechOptions,
} from "@/types/voice.js";

export type ResolvedVoiceConfig = {
	provider: VoiceProvider;
	defaultPolicy: VoicePolicy;
	webSpeech: WebSpeechOptions;
	elevenlabs: ElevenLabsOptions;
};

export function resolveVoiceConfig(
	globalVoice?: VoiceConfig,
	agentVoice?: AgentVoiceConfig,
): ResolvedVoiceConfig {
	const fallback = VoiceConfigSchema.parse({});
	const base = globalVoice ?? fallback;

	return {
		provider: agentVoice?.provider ?? base.provider,
		defaultPolicy: base.defaultPolicy,
		webSpeech: {
			...(base.webSpeech || {}),
			...(agentVoice?.webSpeech || {}),
		},
		elevenlabs: {
			...(base.elevenlabs || {}),
			...(agentVoice?.elevenlabs || {}),
		},
	};
}
