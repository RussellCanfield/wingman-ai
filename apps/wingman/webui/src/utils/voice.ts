import type {
	AgentVoiceConfig,
	ElevenLabsOptions,
	VoiceConfig,
	VoiceProvider,
	WebSpeechOptions,
} from "../types";

export type ResolvedVoiceConfig = {
	provider: VoiceProvider;
	webSpeech: WebSpeechOptions;
	elevenlabs: ElevenLabsOptions;
};

export const resolveVoiceConfig = (
	globalConfig?: VoiceConfig,
	agentVoice?: AgentVoiceConfig,
): ResolvedVoiceConfig => {
	const provider = agentVoice?.provider || globalConfig?.provider || "web_speech";
	return {
		provider,
		webSpeech: {
			...(globalConfig?.webSpeech || {}),
			...(agentVoice?.webSpeech || {}),
		},
		elevenlabs: {
			...(globalConfig?.elevenlabs || {}),
			...(agentVoice?.elevenlabs || {}),
		},
	};
};

export const sanitizeForSpeech = (input: string): string => {
	let text = input || "";
	text = text.replace(/```[\s\S]*?```/g, " ");
	text = text.replace(/`([^`]+)`/g, "$1");
	text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
	text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
	text = text.replace(/^#+\s+/gm, "");
	text = text.replace(/^>\s?/gm, "");
	text = text.replace(/^\s*[-*+]\s+/gm, "");
	text = text.replace(/^\s*\d+\.\s+/gm, "");
	text = text.replace(/\s+/g, " ").trim();
	return text;
};

export const resolveSpeechVoice = (
	voiceName?: string,
	lang?: string,
): SpeechSynthesisVoice | undefined => {
	if (typeof window === "undefined" || !("speechSynthesis" in window)) {
		return undefined;
	}
	const voices = window.speechSynthesis.getVoices();
	if (!voices || voices.length === 0) {
		return undefined;
	}
	if (voiceName) {
		const needle = voiceName.toLowerCase();
		const byName = voices.find(
			(voice) =>
				voice.name.toLowerCase() === needle ||
				voice.voiceURI?.toLowerCase() === needle,
		);
		if (byName) return byName;
	}
	if (lang) {
		const normalizedLang = lang.toLowerCase();
		const byLang = voices.find((voice) =>
			voice.lang?.toLowerCase().startsWith(normalizedLang),
		);
		if (byLang) return byLang;
	}
	return voices[0];
};
