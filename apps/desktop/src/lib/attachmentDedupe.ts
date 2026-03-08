import type { ChatAttachment } from "./gatewayModels.js";

function buildAttachmentSignature(attachment: ChatAttachment): string {
	return [
		attachment.kind,
		attachment.dataUrl,
		attachment.textContent || "",
		attachment.name || "",
		attachment.mimeType || "",
		typeof attachment.size === "number" ? String(attachment.size) : "",
	].join("::");
}

export function mergeUniqueAttachments(
	existing: ChatAttachment[],
	incoming: ChatAttachment[],
): ChatAttachment[] {
	if (incoming.length === 0) return existing;
	const merged = [...existing];
	const seen = new Set(
		merged.map((attachment) => buildAttachmentSignature(attachment)),
	);
	for (const attachment of incoming) {
		const signature = buildAttachmentSignature(attachment);
		if (seen.has(signature)) continue;
		seen.add(signature);
		merged.push(attachment);
	}
	return merged;
}
