export function resolveTalkStopTranscript(
	wasRecording: boolean,
	transcriptBeforeToggle: string,
): string | null {
	if (!wasRecording) return null;
	const normalized = transcriptBeforeToggle.trim();
	return normalized ? normalized : null;
}

