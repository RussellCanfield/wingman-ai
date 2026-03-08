import type { ChatAttachment } from "./gatewayModels.js";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_PDF_BYTES = 8 * 1024 * 1024;
export const MAX_FILE_TEXT_CHARS = 40_000;
export const MAX_ATTACHMENTS = 6;

export function createAttachmentId(): string {
	return `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function extractImageFiles(
	items: DataTransferItemList | DataTransferItem[] | null | undefined,
): File[] {
	if (!items) return [];
	const out: File[] = [];
	for (const item of Array.from(items)) {
		if (item.kind !== "file") continue;
		if (!item.type.startsWith("image/")) continue;
		const file = item.getAsFile();
		if (file) out.push(file);
	}
	return out;
}

export function isAudioAttachment(attachment: ChatAttachment): boolean {
	if (attachment.kind === "audio") return true;
	if (attachment.mimeType?.startsWith("audio/")) return true;
	if (attachment.dataUrl.startsWith("data:audio/")) return true;
	return false;
}

export function isVideoAttachment(attachment: ChatAttachment): boolean {
	if (attachment.mimeType?.startsWith("video/")) return true;
	if (attachment.dataUrl.startsWith("data:video/")) return true;
	return false;
}

export function isPdfAttachment(attachment: ChatAttachment): boolean {
	if (attachment.mimeType === "application/pdf") return true;
	if (attachment.dataUrl.startsWith("data:application/pdf")) return true;
	const name = (attachment.name || "").trim().toLowerCase();
	return name.endsWith(".pdf");
}

export function isFileAttachment(attachment: ChatAttachment): boolean {
	if (attachment.kind === "file") return true;
	return typeof attachment.textContent === "string";
}

export function buildAttachmentPreviewText(attachments: ChatAttachment[]): string {
	if (!attachments || attachments.length === 0) return "";

	let hasFile = false;
	let hasAudio = false;
	let hasImage = false;
	let hasVideo = false;
	for (const attachment of attachments) {
		if (isVideoAttachment(attachment)) {
			hasVideo = true;
			continue;
		}
		if (isFileAttachment(attachment)) {
			hasFile = true;
			continue;
		}
		if (isAudioAttachment(attachment)) {
			hasAudio = true;
		} else {
			hasImage = true;
		}
	}

	const count = attachments.length;
	if (hasFile && (hasAudio || hasImage || hasVideo)) {
		return count > 1 ? "File and media attachments" : "File and media attachment";
	}
	if (hasFile) return count > 1 ? "File attachments" : "File attachment";
	if ((hasAudio || hasVideo) && hasImage) {
		return count > 1 ? "Media attachments" : "Media attachment";
	}
	if (hasAudio && hasVideo) return count > 1 ? "Media attachments" : "Media attachment";
	if (hasAudio) return count > 1 ? "Audio attachments" : "Audio attachment";
	if (hasVideo) return count > 1 ? "Video attachments" : "Video attachment";
	return count > 1 ? "Image attachments" : "Image attachment";
}

export function formatAttachmentMeta(attachment: ChatAttachment): string {
	const parts: string[] = [];
	if (attachment.mimeType) parts.push(attachment.mimeType);
	if (typeof attachment.size === "number") {
		parts.push(formatBytes(attachment.size));
	}
	return parts.join(" • ");
}

export function clipFilePreview(text: string, maxChars = 280): string {
	const normalized = text.trim();
	if (normalized.length <= maxChars) return normalized;
	return `${normalized.slice(0, maxChars)}...`;
}

export async function readFileAsDataUrl(file: File): Promise<string> {
	const buffer = await file.arrayBuffer();
	const bytes = new Uint8Array(buffer);
	let binary = "";
	const chunkSize = 0x8000;
	for (let index = 0; index < bytes.length; index += chunkSize) {
		const slice = bytes.subarray(index, index + chunkSize);
		binary += String.fromCharCode(...slice);
	}
	const base64 = btoa(binary);
	const mimeType = file.type || "application/octet-stream";
	return `data:${mimeType};base64,${base64}`;
}

function formatBytes(value: number): string {
	if (!Number.isFinite(value) || value < 0) return "";
	if (value < 1024) return `${value} B`;
	const units = ["KB", "MB", "GB"];
	let size = value / 1024;
	let unitIndex = 0;
	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex += 1;
	}
	return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unitIndex]}`;
}
