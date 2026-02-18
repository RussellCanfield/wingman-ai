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

function clipFileText(text: string, maxChars: number): { text: string; truncated: boolean } {
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

	const directLiteral = /\(((?:\\.|[^\\()])*)\)\s*T[Jj]/g;
	for (const match of source.matchAll(directLiteral)) {
		collected.push(decodePdfLiteral(match[1]));
	}

	const directHex = /<([0-9A-Fa-f\s]+)>\s*T[Jj]/g;
	for (const match of source.matchAll(directHex)) {
		collected.push(decodePdfHex(match[1]));
	}

	const quoteLiteral = /\(((?:\\.|[^\\()])*)\)\s*'/g;
	for (const match of source.matchAll(quoteLiteral)) {
		collected.push(decodePdfLiteral(match[1]));
	}

	const quoteHex = /<([0-9A-Fa-f\s]+)>\s*'/g;
	for (const match of source.matchAll(quoteHex)) {
		collected.push(decodePdfHex(match[1]));
	}

	const normalized = collected
		.map((item) => normalizePdfText(item))
		.filter((item) => item.length > 2);
	if (normalized.length === 0) {
		return "";
	}

	const unique: string[] = [];
	const seen = new Set<string>();
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
