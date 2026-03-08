export type ToolImagePreview = {
	src: string;
	label?: string;
};

export type ToolAudioPreview = {
	src: string;
	label?: string;
};

export type ToolVideoPreview = {
	src: string;
	label?: string;
};

export function extractToolImagePreviews(
	value: unknown,
	maxItems = 4,
): ToolImagePreview[] {
	if (!value || typeof value !== "object") return [];
	const record = value as Record<string, unknown>;
	const containers: unknown[] = [];

	if (
		record.structuredContent &&
		typeof record.structuredContent === "object"
	) {
		containers.push(record.structuredContent);
	}
	if (Array.isArray(record.artifact)) {
		containers.push({ content: record.artifact });
	}
	containers.push(record);

	const previews: ToolImagePreview[] = [];
	const seen = new Set<string>();

	for (const container of containers) {
		const sourceRecord =
			container && typeof container === "object"
				? (container as Record<string, unknown>)
				: null;
		if (!sourceRecord) continue;
		const media = Array.isArray(sourceRecord.media) ? sourceRecord.media : [];
		for (const item of media) {
			const mediaRecord =
				item && typeof item === "object"
					? (item as Record<string, unknown>)
					: null;
			if (!mediaRecord) continue;
			const kind =
				typeof mediaRecord.kind === "string"
					? mediaRecord.kind.trim().toLowerCase()
					: "";
			const modality =
				typeof mediaRecord.modality === "string"
					? mediaRecord.modality.trim().toLowerCase()
					: "";
			const mimeType =
				typeof mediaRecord.mimeType === "string"
					? mediaRecord.mimeType.trim().toLowerCase()
					: "";
			if (
				kind !== "image" &&
				modality !== "image" &&
				!mimeType.startsWith("image/")
			) {
				continue;
			}
			const src = resolveToolImageSrc(mediaRecord);
			if (!src || seen.has(src)) continue;
			seen.add(src);
			previews.push({
				src,
				label:
					typeof mediaRecord.name === "string" ? mediaRecord.name : undefined,
			});
			if (previews.length >= maxItems) return previews;
		}
		const images = Array.isArray(sourceRecord.images)
			? sourceRecord.images
			: [];
		for (const image of images) {
			const imageRecord =
				image && typeof image === "object"
					? (image as Record<string, unknown>)
					: null;
			if (!imageRecord) continue;
			const src = resolveToolImageSrc(imageRecord);
			if (!src || seen.has(src)) continue;
			seen.add(src);
			previews.push({
				src,
				label:
					typeof imageRecord.name === "string" ? imageRecord.name : undefined,
			});
			if (previews.length >= maxItems) return previews;
		}

		const content = Array.isArray(sourceRecord.content)
			? sourceRecord.content
			: [];
		for (const part of content) {
			const partRecord =
				part && typeof part === "object"
					? (part as Record<string, unknown>)
					: null;
			if (!partRecord) continue;
			if (partRecord.type === "image") {
				const sourceType =
					typeof partRecord.source_type === "string"
						? partRecord.source_type
						: typeof partRecord.sourceType === "string"
							? partRecord.sourceType
							: "";
				const url =
					typeof partRecord.url === "string" ? partRecord.url.trim() : "";
				const normalizedUrl = normalizeToolMediaSrc(url);
				if (sourceType === "url" && normalizedUrl) {
					if (seen.has(normalizedUrl)) continue;
					seen.add(normalizedUrl);
					previews.push({ src: normalizedUrl });
					if (previews.length >= maxItems) return previews;
					continue;
				}
				const data =
					typeof partRecord.data === "string" ? partRecord.data.trim() : "";
				const mimeType =
					typeof partRecord.mimeType === "string"
						? partRecord.mimeType.trim().toLowerCase()
						: "image/png";
				if (!data) continue;
				const src = `data:${mimeType};base64,${data}`;
				if (seen.has(src)) continue;
				seen.add(src);
				previews.push({ src });
				if (previews.length >= maxItems) return previews;
				continue;
			}
			if (partRecord.type === "resource_link") {
				const mimeType =
					typeof partRecord.mimeType === "string"
						? partRecord.mimeType.trim().toLowerCase()
						: "";
				if (mimeType && !mimeType.startsWith("image/")) continue;
				const uri = normalizeToolMediaSrc(
					typeof partRecord.uri === "string" ? partRecord.uri.trim() : "",
				);
				if (!uri || seen.has(uri)) continue;
				seen.add(uri);
				previews.push({
					src: uri,
					label:
						typeof partRecord.name === "string" ? partRecord.name : undefined,
				});
				if (previews.length >= maxItems) return previews;
			}
		}
	}

	return previews;
}

export function extractToolAudioPreviews(
	value: unknown,
	maxItems = 4,
): ToolAudioPreview[] {
	if (!value || typeof value !== "object") return [];
	const record = value as Record<string, unknown>;
	const containers: unknown[] = [];

	if (
		record.structuredContent &&
		typeof record.structuredContent === "object"
	) {
		containers.push(record.structuredContent);
	}
	if (Array.isArray(record.artifact)) {
		containers.push({ content: record.artifact });
	}
	containers.push(record);

	const previews: ToolAudioPreview[] = [];
	const seen = new Set<string>();

	for (const container of containers) {
		const sourceRecord =
			container && typeof container === "object"
				? (container as Record<string, unknown>)
				: null;
		if (!sourceRecord) continue;

		const media = Array.isArray(sourceRecord.media) ? sourceRecord.media : [];
		for (const item of media) {
			const mediaRecord =
				item && typeof item === "object"
					? (item as Record<string, unknown>)
					: null;
			if (!mediaRecord) continue;
			const modality =
				typeof mediaRecord.modality === "string"
					? mediaRecord.modality.trim().toLowerCase()
					: "";
			const mimeType =
				typeof mediaRecord.mimeType === "string"
					? mediaRecord.mimeType.trim().toLowerCase()
					: "";
			if (modality !== "audio" && !mimeType.startsWith("audio/")) continue;
			const src = resolveToolAudioSrc(mediaRecord);
			if (!src || seen.has(src)) continue;
			seen.add(src);
			previews.push({
				src,
				label:
					typeof mediaRecord.name === "string" ? mediaRecord.name : undefined,
			});
			if (previews.length >= maxItems) return previews;
		}

		const content = Array.isArray(sourceRecord.content)
			? sourceRecord.content
			: [];
		for (const part of content) {
			const partRecord =
				part && typeof part === "object"
					? (part as Record<string, unknown>)
					: null;
			if (!partRecord) continue;

			if (partRecord.type === "audio") {
				const sourceType =
					typeof partRecord.source_type === "string"
						? partRecord.source_type
						: typeof partRecord.sourceType === "string"
							? partRecord.sourceType
							: "";
				const url =
					typeof partRecord.url === "string" ? partRecord.url.trim() : "";
				const normalizedUrl = normalizeToolMediaSrc(url);
				if (sourceType === "url" && normalizedUrl) {
					if (seen.has(normalizedUrl)) continue;
					seen.add(normalizedUrl);
					previews.push({ src: normalizedUrl });
					if (previews.length >= maxItems) return previews;
					continue;
				}
				const data =
					typeof partRecord.data === "string" ? partRecord.data.trim() : "";
				const mimeType =
					typeof partRecord.mimeType === "string"
						? partRecord.mimeType.trim().toLowerCase()
						: "audio/mpeg";
				if (!data) continue;
				const src = `data:${mimeType};base64,${data}`;
				if (seen.has(src)) continue;
				seen.add(src);
				previews.push({ src });
				if (previews.length >= maxItems) return previews;
				continue;
			}

			if (partRecord.type === "resource_link") {
				const mimeType =
					typeof partRecord.mimeType === "string"
						? partRecord.mimeType.trim().toLowerCase()
						: "";
				if (!mimeType.startsWith("audio/")) continue;
				const uri = normalizeToolMediaSrc(
					typeof partRecord.uri === "string" ? partRecord.uri.trim() : "",
				);
				if (!uri || seen.has(uri)) continue;
				seen.add(uri);
				previews.push({
					src: uri,
					label:
						typeof partRecord.name === "string" ? partRecord.name : undefined,
				});
				if (previews.length >= maxItems) return previews;
			}
		}
	}

	return previews;
}

export function extractToolVideoPreviews(
	value: unknown,
	maxItems = 4,
): ToolVideoPreview[] {
	if (!value || typeof value !== "object") return [];
	const record = value as Record<string, unknown>;
	const containers: unknown[] = [];

	if (
		record.structuredContent &&
		typeof record.structuredContent === "object"
	) {
		containers.push(record.structuredContent);
	}
	if (Array.isArray(record.artifact)) {
		containers.push({ content: record.artifact });
	}
	containers.push(record);

	const previews: ToolVideoPreview[] = [];
	const seen = new Set<string>();

	for (const container of containers) {
		const sourceRecord =
			container && typeof container === "object"
				? (container as Record<string, unknown>)
				: null;
		if (!sourceRecord) continue;

		const media = Array.isArray(sourceRecord.media) ? sourceRecord.media : [];
		for (const item of media) {
			const mediaRecord =
				item && typeof item === "object"
					? (item as Record<string, unknown>)
					: null;
			if (!mediaRecord) continue;
			const modality =
				typeof mediaRecord.modality === "string"
					? mediaRecord.modality.trim().toLowerCase()
					: "";
			const mimeType =
				typeof mediaRecord.mimeType === "string"
					? mediaRecord.mimeType.trim().toLowerCase()
					: "";
			if (modality !== "video" && !mimeType.startsWith("video/")) continue;
			const src = resolveToolVideoSrc(mediaRecord);
			if (!src || seen.has(src)) continue;
			seen.add(src);
			previews.push({
				src,
				label:
					typeof mediaRecord.name === "string" ? mediaRecord.name : undefined,
			});
			if (previews.length >= maxItems) return previews;
		}

		const content = Array.isArray(sourceRecord.content)
			? sourceRecord.content
			: [];
		for (const part of content) {
			const partRecord =
				part && typeof part === "object"
					? (part as Record<string, unknown>)
					: null;
			if (!partRecord) continue;

			if (partRecord.type === "video") {
				const src = resolveToolVideoSrc(partRecord);
				if (!src || seen.has(src)) continue;
				seen.add(src);
				previews.push({
					src,
					label:
						typeof partRecord.name === "string" ? partRecord.name : undefined,
				});
				if (previews.length >= maxItems) return previews;
				continue;
			}

			if (partRecord.type === "resource_link") {
				const mimeType =
					typeof partRecord.mimeType === "string"
						? partRecord.mimeType.trim().toLowerCase()
						: "";
				if (!mimeType.startsWith("video/")) continue;
				const uri = normalizeToolMediaSrc(
					typeof partRecord.uri === "string" ? partRecord.uri.trim() : "",
				);
				if (!uri || seen.has(uri)) continue;
				seen.add(uri);
				previews.push({
					src: uri,
					label:
						typeof partRecord.name === "string" ? partRecord.name : undefined,
				});
				if (previews.length >= maxItems) return previews;
			}
		}
	}

	return previews;
}

export function hasToolMediaPreview(value: unknown): boolean {
	return (
		extractToolImagePreviews(value, 1).length > 0 ||
		extractToolAudioPreviews(value, 1).length > 0 ||
		extractToolVideoPreviews(value, 1).length > 0
	);
}

function resolveToolImageSrc(
	imageRecord: Record<string, unknown>,
): string | null {
	for (const key of [
		"url",
		"uri",
		"webUrl",
		"dataUrl",
		"src",
		"absolutePath",
		"path",
	]) {
		const candidate = imageRecord[key];
		if (typeof candidate !== "string" || !candidate.trim()) continue;
		const src = normalizeToolMediaSrc(candidate);
		if (src) return src;
	}
	return null;
}

function resolveToolAudioSrc(
	audioRecord: Record<string, unknown>,
): string | null {
	for (const key of [
		"url",
		"uri",
		"webUrl",
		"dataUrl",
		"src",
		"remoteUrl",
		"absolutePath",
		"path",
	]) {
		const candidate = audioRecord[key];
		if (typeof candidate !== "string" || !candidate.trim()) continue;
		const src = normalizeToolMediaSrc(candidate);
		if (src) return src;
	}
	return null;
}

function resolveToolVideoSrc(
	videoRecord: Record<string, unknown>,
): string | null {
	for (const key of [
		"url",
		"uri",
		"webUrl",
		"dataUrl",
		"src",
		"remoteUrl",
		"absolutePath",
		"path",
	]) {
		const candidate = videoRecord[key];
		if (typeof candidate !== "string" || !candidate.trim()) continue;
		const src = normalizeToolMediaSrc(candidate);
		if (src) return src;
	}
	return null;
}

function normalizeToolMediaSrc(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (
		trimmed.startsWith("http://") ||
		trimmed.startsWith("https://") ||
		trimmed.startsWith("data:") ||
		trimmed.startsWith("blob:") ||
		trimmed.startsWith("/api/fs/file?")
	) {
		return trimmed;
	}

	const filesystemPath = extractLocalFilesystemPath(trimmed);
	if (filesystemPath) {
		return `/api/fs/file?path=${encodeURIComponent(filesystemPath)}`;
	}

	return trimmed;
}

function extractLocalFilesystemPath(value: string): string | null {
	if (value.startsWith("file://")) {
		try {
			const parsed = new URL(value);
			let pathname = decodeURIComponent(parsed.pathname || "");
			if (!pathname) return null;
			if (/^\/[A-Za-z]:[\\/]/.test(pathname)) {
				pathname = pathname.slice(1);
			}
			if (parsed.host && !/^[A-Za-z]:[\\/]/.test(pathname)) {
				return `//${parsed.host}${pathname}`;
			}
			return pathname;
		} catch {
			return null;
		}
	}
	if (/^[A-Za-z]:[\\/]/.test(value)) {
		return value;
	}
	if (
		value.startsWith("/") &&
		!value.startsWith("//") &&
		!value.startsWith("/api/")
	) {
		return value;
	}
	return null;
}
