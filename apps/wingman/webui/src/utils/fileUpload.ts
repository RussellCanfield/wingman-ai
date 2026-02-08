const SUPPORTED_TEXT_FILE_EXTENSIONS = new Set([
	"txt",
	"md",
	"csv",
	"json",
	"yaml",
	"yml",
	"xml",
	"log",
	"ts",
	"js",
	"py",
	"go",
	"rs",
	"java",
	"c",
	"cpp",
	"sql",
	"html",
	"css",
]);

export const FILE_INPUT_ACCEPT = [
	"image/*",
	"audio/*",
	".txt",
	".md",
	".csv",
	".json",
	".yaml",
	".yml",
	".xml",
	".log",
	".ts",
	".js",
	".py",
	".go",
	".rs",
	".java",
	".c",
	".cpp",
	".sql",
	".html",
	".css",
	".pdf",
].join(",");

export async function readUploadFileText(
	file: File,
	maxChars: number,
): Promise<{ textContent: string; truncated: boolean; usedPdfFallback: boolean }> {
	const isPdf = isPdfUploadFile(file);
	let raw = "";
	let usedPdfFallback = false;

	if (isPdf) {
		raw = await extractPdfText(file);
		if (!raw.trim()) {
			usedPdfFallback = true;
			raw = `PDF attached: ${file.name || "document.pdf"}\nNo extractable text was found in this PDF. Please provide a text export if you need full-content analysis.`;
		}
	} else {
		raw = await file.text();
	}

	const normalized = normalizeFileText(raw);
	const { text, truncated } = clipFileText(normalized, maxChars);
	return { textContent: text, truncated, usedPdfFallback };
}

export function isSupportedTextUploadFile(file: Pick<File, "name" | "type">): boolean {
	if (!file) return false;
	if (isPdfUploadFile(file)) return false;
	if (file.type?.startsWith("image/") || file.type?.startsWith("audio/")) return false;
	if (file.type?.startsWith("text/")) return true;
	if (
		file.type === "application/json" ||
		file.type === "application/xml" ||
		file.type === "text/xml" ||
		file.type === "application/yaml" ||
		file.type === "application/x-yaml" ||
		file.type === "text/yaml" ||
		file.type === "application/javascript" ||
		file.type === "text/javascript" ||
		file.type === "application/sql" ||
		file.type === "text/sql"
	) {
		return true;
	}
	return SUPPORTED_TEXT_FILE_EXTENSIONS.has(getFileExtension(file.name));
}

export function isPdfUploadFile(file: Pick<File, "name" | "type">): boolean {
	if (!file) return false;
	if (file.type === "application/pdf") return true;
	return getFileExtension(file.name) === "pdf";
}

function getFileExtension(name: string): string {
	const clean = (name || "").trim().toLowerCase();
	const dot = clean.lastIndexOf(".");
	if (dot <= 0 || dot === clean.length - 1) return "";
	return clean.slice(dot + 1);
}

function normalizeFileText(value: string): string {
	return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function clipFileText(
	text: string,
	maxChars: number,
): { text: string; truncated: boolean } {
	if (text.length <= maxChars) {
		return { text, truncated: false };
	}
	return {
		text: `${text.slice(0, maxChars)}\n\n[File content truncated for prompt size limits.]`,
		truncated: true,
	};
}

async function extractPdfText(file: File): Promise<string> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	const source = new TextDecoder("latin1").decode(bytes);
	const collected: string[] = [];

	// 1) Try extracting text from (possibly compressed) page/content streams.
	const streams = await extractTextFromPdfStreams(bytes, source);
	collected.push(...streams);

	// 2) Also scan whole source for uncompressed text operators.
	collected.push(...extractTextOperators(source));

	const normalized = collected
		.map((item) => normalizePdfText(item))
		.filter((item) => item.length > 2);
	if (normalized.length === 0) {
		return "";
	}

	// Preserve insertion order while dropping duplicates.
	const seen = new Set<string>();
	const unique: string[] = [];
	for (const item of normalized) {
		if (seen.has(item)) continue;
		seen.add(item);
		unique.push(item);
	}
	return unique.join("\n");
}

function decodePdfLiteral(value: string): string {
	return value
		.replace(/\\([nrtbf()\\])/g, (_, char: string) => {
			switch (char) {
				case "n":
					return "\n";
				case "r":
					return "\r";
				case "t":
					return "\t";
				case "b":
					return "\b";
				case "f":
					return "\f";
				default:
					return char;
			}
		})
		.replace(/\\([0-7]{1,3})/g, (_, octal: string) =>
			String.fromCharCode(Number.parseInt(octal, 8)),
		);
}

function decodePdfHex(value: string): string {
	const clean = value.replace(/\s+/g, "");
	if (!clean) return "";
	const padded = clean.length % 2 === 0 ? clean : `${clean}0`;
	const bytes = new Uint8Array(padded.length / 2);
	for (let i = 0; i < padded.length; i += 2) {
		bytes[i / 2] = Number.parseInt(padded.slice(i, i + 2), 16);
	}
	// UTF-16BE with BOM
	if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
		const words: number[] = [];
		for (let i = 2; i + 1 < bytes.length; i += 2) {
			words.push((bytes[i] << 8) | bytes[i + 1]);
		}
		return String.fromCharCode(...words);
	}
	return new TextDecoder("latin1").decode(bytes);
}

function normalizePdfText(value: string): string {
	return value
		.replace(/\r\n/g, "\n")
		.replace(/\r/g, "\n")
		.replace(/\s+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function extractTextOperators(content: string): string[] {
	const runs: string[] = [];

	const directLiteral = /\(((?:\\.|[^\\()])*)\)\s*T[Jj]/g;
	for (const match of content.matchAll(directLiteral)) {
		runs.push(decodePdfLiteral(match[1]));
	}

	const directHex = /<([0-9A-Fa-f\s]+)>\s*T[Jj]/g;
	for (const match of content.matchAll(directHex)) {
		runs.push(decodePdfHex(match[1]));
	}

	// Single quote operator: show text on next line.
	const quoteLiteral = /\(((?:\\.|[^\\()])*)\)\s*'/g;
	for (const match of content.matchAll(quoteLiteral)) {
		runs.push(decodePdfLiteral(match[1]));
	}
	const quoteHex = /<([0-9A-Fa-f\s]+)>\s*'/g;
	for (const match of content.matchAll(quoteHex)) {
		runs.push(decodePdfHex(match[1]));
	}

	// Double quote operator: set spacing then show text.
	const dblQuoteToken = /(\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>)\s*"/g;
	for (const token of content.matchAll(dblQuoteToken)) {
		const raw = token[1];
		if (!raw) continue;
		if (raw.startsWith("(") && raw.endsWith(")")) {
			runs.push(decodePdfLiteral(raw.slice(1, -1)));
		} else if (raw.startsWith("<") && raw.endsWith(">")) {
			runs.push(decodePdfHex(raw.slice(1, -1)));
		}
	}

	const arrayTj = /\[(.*?)\]\s*TJ/gs;
	for (const block of content.matchAll(arrayTj)) {
		const inner = block[1];
		const tokens = /(\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>)/g;
		const parts: string[] = [];
		for (const token of inner.matchAll(tokens)) {
			const raw = token[1];
			if (!raw) continue;
			if (raw.startsWith("(") && raw.endsWith(")")) {
				parts.push(decodePdfLiteral(raw.slice(1, -1)));
			} else if (raw.startsWith("<") && raw.endsWith(">")) {
				parts.push(decodePdfHex(raw.slice(1, -1)));
			}
		}
		if (parts.length > 0) {
			runs.push(parts.join(""));
		}
	}

	return runs;
}

async function extractTextFromPdfStreams(
	bytes: Uint8Array,
	source: string,
): Promise<string[]> {
	const runs: string[] = [];
	for (const stream of findPdfStreams(source)) {
		const rawData = bytes.slice(stream.dataStart, stream.dataEnd);
		const decodedData = await decodePdfStreamBytes(rawData, stream.dictionary);
		if (!decodedData || decodedData.length === 0) continue;
		const content = new TextDecoder("latin1").decode(decodedData);
		runs.push(...extractTextOperators(content));
	}
	return runs;
}

function skipPdfStreamNewline(source: string, index: number): number {
	let cursor = index;
	if (source[cursor] === "\r") cursor += 1;
	if (source[cursor] === "\n") cursor += 1;
	return cursor;
}

async function decodePdfStreamBytes(
	raw: Uint8Array,
	dictionaryText: string,
): Promise<Uint8Array | null> {
	const filters = parsePdfFilters(dictionaryText || "");
	if (filters.length === 0) {
		return raw;
	}
	let current = raw;
	for (const filter of filters) {
		const normalized = filter.toLowerCase();
		if (normalized === "flatedecode" || normalized === "fl") {
			const inflated = await tryInflate(current);
			if (!inflated) return null;
			current = inflated;
			continue;
		}
		if (normalized === "ascii85decode" || normalized === "a85") {
			const decoded = decodeAscii85(current);
			if (!decoded) return null;
			current = decoded;
			continue;
		}
		// Unsupported filter in chain.
		return null;
	}
	return current;
}

async function tryInflate(data: Uint8Array): Promise<Uint8Array | null> {
	if (typeof DecompressionStream === "undefined") {
		return null;
	}
	for (const format of ["deflate", "deflate-raw"] as const) {
		try {
			const stream = new Blob([data]).stream().pipeThrough(
				new DecompressionStream(format),
			);
			const result = await new Response(stream).arrayBuffer();
			return new Uint8Array(result);
		} catch {
			// Try next format.
		}
	}
	return null;
}

function parsePdfFilters(dictionary: string): string[] {
	const dict = dictionary || "";
	const arrayMatch = dict.match(/\/Filter\s*\[([^\]]+)\]/);
	if (arrayMatch?.[1]) {
		const names = Array.from(arrayMatch[1].matchAll(/\/([A-Za-z0-9]+)/g)).map(
			(item) => item[1],
		);
		return names;
	}
	const singleMatch = dict.match(/\/Filter\s*\/([A-Za-z0-9]+)/);
	if (singleMatch?.[1]) {
		return [singleMatch[1]];
	}
	return [];
}

function findPdfStreams(source: string): Array<{
	dictionary: string;
	dataStart: number;
	dataEnd: number;
}> {
	const streams: Array<{ dictionary: string; dataStart: number; dataEnd: number }> = [];
	let cursor = 0;
	while (cursor < source.length) {
		const streamToken = source.indexOf("stream", cursor);
		if (streamToken === -1) break;

		const dataStart = skipPdfStreamNewline(source, streamToken + "stream".length);
		const endToken = source.indexOf("endstream", dataStart);
		if (endToken === -1) break;

		const dictSearchStart = Math.max(0, streamToken - 8_192);
		const dictStart = source.lastIndexOf("<<", streamToken);
		const dictEnd = source.lastIndexOf(">>", streamToken);
		if (
			dictStart !== -1 &&
			dictEnd !== -1 &&
			dictStart >= dictSearchStart &&
			dictStart < dictEnd &&
			dictEnd < streamToken
		) {
			streams.push({
				dictionary: source.slice(dictStart, dictEnd + 2),
				dataStart,
				dataEnd: endToken,
			});
		}

		cursor = endToken + "endstream".length;
	}
	return streams;
}

function decodeAscii85(input: Uint8Array): Uint8Array | null {
	const text = new TextDecoder("latin1").decode(input);
	let body = text;
	const start = body.indexOf("<~");
	const end = body.lastIndexOf("~>");
	if (start !== -1 && end !== -1 && end > start) {
		body = body.slice(start + 2, end);
	}
	body = body.replace(/\s+/g, "");
	if (!body) return new Uint8Array(0);

	const out: number[] = [];
	let group: number[] = [];
	for (let i = 0; i < body.length; i += 1) {
		const ch = body[i];
		if (ch === "z" && group.length === 0) {
			out.push(0, 0, 0, 0);
			continue;
		}
		const code = body.charCodeAt(i);
		if (code < 33 || code > 117) {
			continue;
		}
		group.push(code - 33);
		if (group.length === 5) {
			let value = 0;
			for (const n of group) value = value * 85 + n;
			out.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
			group = [];
		}
	}

	if (group.length > 0) {
		const pad = 5 - group.length;
		for (let i = 0; i < pad; i += 1) group.push(84);
		let value = 0;
		for (const n of group) value = value * 85 + n;
		const tail = [
			(value >>> 24) & 0xff,
			(value >>> 16) & 0xff,
			(value >>> 8) & 0xff,
			value & 0xff,
		];
		out.push(...tail.slice(0, 4 - pad));
	}

	return new Uint8Array(out);
}
