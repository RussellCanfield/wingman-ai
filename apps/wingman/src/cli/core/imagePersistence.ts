import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface PersistableAttachment {
	kind: "image" | "audio" | "file";
	dataUrl: string;
	mimeType?: string;
	name?: string;
	size?: number;
	path?: string;
}

export interface PersistableMessage {
	role: "user" | "assistant";
	attachments?: PersistableAttachment[];
}

type ParsedDataUrl = {
	mimeType: string;
	data: string;
};

const DATA_URL_BASE64_PATTERN = /^data:([^;,]+);base64,(.+)$/i;

export function persistAssistantImagesToDisk(input: {
	dbPath: string;
	sessionId: string;
	messages: PersistableMessage[];
}): void {
	if (!input.messages.length) return;

	const mediaRoot = join(
		dirname(input.dbPath),
		"media",
		sanitizePathSegment(input.sessionId),
	);

	for (const message of input.messages) {
		if (message.role !== "assistant") continue;
		if (!Array.isArray(message.attachments) || message.attachments.length === 0) {
			continue;
		}

		for (const attachment of message.attachments) {
			if (!attachment || attachment.kind !== "image") continue;
			if (attachment.path) continue;

			const parsed = parseBase64DataUrl(attachment.dataUrl);
			if (!parsed) continue;
			if (!parsed.mimeType.toLowerCase().startsWith("image/")) continue;

			let bytes: Buffer;
			try {
				bytes = Buffer.from(parsed.data, "base64");
			} catch {
				continue;
			}
			if (bytes.length === 0) continue;

			const extension = resolveImageExtension(parsed.mimeType);
			const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 20);
			const filename = `${hash}.${extension}`;
			const outputPath = join(mediaRoot, filename);

			if (!existsSync(outputPath)) {
				mkdirSync(mediaRoot, { recursive: true });
				writeFileSync(outputPath, bytes);
			}

			attachment.path = outputPath;
			if (!attachment.mimeType) {
				attachment.mimeType = parsed.mimeType;
			}
			if (typeof attachment.size !== "number" || attachment.size <= 0) {
				attachment.size = bytes.length;
			}
			if (!attachment.name) {
				attachment.name = `image-${hash.slice(0, 8)}.${extension}`;
			}
		}
	}
}

export function parseBase64DataUrl(dataUrl: string): ParsedDataUrl | null {
	if (typeof dataUrl !== "string") return null;
	const match = dataUrl.match(DATA_URL_BASE64_PATTERN);
	if (!match) return null;
	return {
		mimeType: match[1].trim().toLowerCase(),
		data: match[2].trim(),
	};
}

export function resolveImageExtension(mimeType: string): string {
	const normalized = (mimeType || "").trim().toLowerCase();
	switch (normalized) {
		case "image/jpeg":
			return "jpg";
		case "image/png":
			return "png";
		case "image/webp":
			return "webp";
		case "image/gif":
			return "gif";
		case "image/svg+xml":
			return "svg";
		case "image/bmp":
			return "bmp";
		case "image/tiff":
			return "tiff";
		case "image/heic":
			return "heic";
		case "image/heif":
			return "heif";
		case "image/avif":
			return "avif";
		default: {
			const subtype = normalized.split("/")[1] || "";
			const sanitized = subtype.replace(/[^a-z0-9]/g, "");
			return sanitized || "img";
		}
	}
}

function sanitizePathSegment(value: string): string {
	const normalized = (value || "").trim();
	if (!normalized) return "default-session";
	const sanitized = normalized.replace(/[^a-zA-Z0-9._-]/g, "_");
	return sanitized.slice(0, 120) || "default-session";
}
