import type { ChatAttachment } from "../types";

type AudioAvailability = {
	playable: boolean;
	reason?: string;
};

export function getAudioAvailability(attachment: ChatAttachment): AudioAvailability {
	if (!attachment || typeof attachment.dataUrl !== "string") {
		return { playable: false, reason: "Audio source missing." };
	}
	const url = attachment.dataUrl.trim();
	if (!url) {
		return { playable: false, reason: "Audio source missing." };
	}
	if (attachment.size === 0) {
		return { playable: false, reason: "Audio data is empty." };
	}
	const lower = url.toLowerCase();
	if (lower.startsWith("blob:")) {
		return {
			playable: false,
			reason: "Audio was generated for a live session and is no longer available.",
		};
	}
	if (lower.startsWith("data:audio/")) {
		const [, payload] = url.split(",", 2);
		if (!payload || payload.trim().length === 0) {
			return { playable: false, reason: "Audio data was not stored." };
		}
		return { playable: true };
	}
	if (lower.startsWith("http://") || lower.startsWith("https://")) {
		return { playable: true };
	}
	return { playable: false, reason: "Audio source is not available." };
}
