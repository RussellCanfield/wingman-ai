import { z } from "zod";

export const VoiceProviderSchema = z.enum(["web_speech", "elevenlabs"]);
export type VoiceProvider = z.infer<typeof VoiceProviderSchema>;

export const VoicePolicySchema = z.enum(["off", "manual", "auto"]);
export type VoicePolicy = z.infer<typeof VoicePolicySchema>;

export const WebSpeechOptionsSchema = z.object({
	voiceName: z.string().optional(),
	lang: z.string().optional(),
	rate: z.number().min(0.1).max(4).optional(),
	pitch: z.number().min(0).max(2).optional(),
	volume: z.number().min(0).max(1).optional(),
});

export type WebSpeechOptions = z.infer<typeof WebSpeechOptionsSchema>;

export const ElevenLabsOptionsSchema = z.object({
	voiceId: z.string().optional(),
	modelId: z.string().optional(),
	stability: z.number().min(0).max(1).optional(),
	similarityBoost: z.number().min(0).max(1).optional(),
	style: z.number().min(0).max(1).optional(),
	speakerBoost: z.boolean().optional(),
	speed: z.number().min(0.25).max(4).optional(),
	outputFormat: z.string().optional(),
	optimizeStreamingLatency: z.number().min(0).max(4).optional(),
});

export type ElevenLabsOptions = z.infer<typeof ElevenLabsOptionsSchema>;

export const VoiceConfigSchema = z
	.object({
		provider: VoiceProviderSchema.default("web_speech"),
		defaultPolicy: VoicePolicySchema.default("off"),
		webSpeech: WebSpeechOptionsSchema.optional().default({}),
		elevenlabs: ElevenLabsOptionsSchema.optional().default({}),
	})
	.default({
		provider: "web_speech",
		defaultPolicy: "off",
		webSpeech: {},
		elevenlabs: {},
	});

export type VoiceConfig = z.infer<typeof VoiceConfigSchema>;

export const AgentVoiceConfigSchema = z.object({
	provider: VoiceProviderSchema.optional(),
	webSpeech: WebSpeechOptionsSchema.optional(),
	elevenlabs: ElevenLabsOptionsSchema.optional(),
});

export type AgentVoiceConfig = z.infer<typeof AgentVoiceConfigSchema>;

export const VoiceConfigUpdateSchema = z.object({
	provider: VoiceProviderSchema.optional(),
	defaultPolicy: VoicePolicySchema.optional(),
	webSpeech: WebSpeechOptionsSchema.optional(),
	elevenlabs: ElevenLabsOptionsSchema.optional(),
});

export type VoiceConfigUpdate = z.infer<typeof VoiceConfigUpdateSchema>;
