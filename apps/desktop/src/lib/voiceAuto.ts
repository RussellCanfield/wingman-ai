type VoiceAutoInput = {
	text: string;
	enabled: boolean;
	spokenMessages: Set<string>;
	requestId: string;
};

export function shouldAutoSpeak(input: VoiceAutoInput): boolean {
	if (!input.enabled) return false;
	if (!input.text.trim()) return false;
	return !input.spokenMessages.has(input.requestId);
}
