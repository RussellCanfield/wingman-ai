export type VoicePlaybackStatus = "idle" | "pending" | "loading" | "playing";

export function getVoicePlaybackLabel(status: VoicePlaybackStatus): string {
	switch (status) {
		case "pending":
			return "Pending";
		case "loading":
			return "Loading";
		case "playing":
			return "Stop";
		default:
			return "Play";
	}
}
