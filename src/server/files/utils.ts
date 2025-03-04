import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import { TextDocument } from "vscode-languageserver-textdocument";
import type { Location } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { loggingProvider } from "../loggingProvider";
import { glob } from "tinyglobby";

export const getWorkspaceFolderForDocument = (
	documentUri: string,
	workspaceFolders: string[],
): string | null => {
	const documentPath = URI.parse(documentUri).fsPath;
	for (const folder of workspaceFolders) {
		if (documentPath.startsWith(folder)) {
			return folder;
		}
	}
	return null;
};

export function filePathToUri(filePath: string): string {
	const resolvedPath = path.isAbsolute(filePath)
		? filePath
		: path.resolve(filePath);
	return pathToFileURL(resolvedPath).href;
}

export async function getTextDocumentFromUri(
	uri: string,
): Promise<TextDocument | undefined> {
	const filePath = fileURLToPath(uri);
	try {
		await fs.access(filePath);
		const content = await fs.readFile(filePath, "utf8");
		return TextDocument.create(uri, "plaintext", 1, content);
	} catch (error) {
		console.error(`File does not exist: ${filePath}`);
	}

	return undefined;
}

export async function getTextDocumentFromPath(
	filePath: string,
): Promise<TextDocument | undefined> {
	try {
		await fs.access(filePath);
		const content = await fs.readFile(filePath, "utf8");
		return TextDocument.create(
			filePathToUri(filePath),
			"plaintext",
			1,
			content,
		);
	} catch (error) {
		console.error(`File does not exist: ${filePath}`);
	}

	return undefined;
}

export function filterSystemLibraries(definitions: Location[]) {
	// Extended unwanted paths regex to include a generic Go's module cache path
	const unwantedPathsRegex =
		/node_modules|\.nuget|Assembly\/Microsoft|rustlib|rustc|rustup|rust-toolchain|rustup-toolchain|go\/pkg\/mod|\/go\/\d+(\.\d+)*\/|lib\/python\d+(\.\d+)*\/|site-packages|dist-packages/;

	return definitions.filter((def) => {
		const filePath = def.uri;
		// Use the regular expression to test for unwanted paths, including a generic Go library path
		return !unwantedPathsRegex.test(filePath);
	});
}

export function convertIdToFilePath(
	id: string,
	rangeStartLine: string,
	rangeStartCharacter: string,
	directory: string,
) {
	const startRange = `${rangeStartLine}-${rangeStartCharacter}`;
	return fileURLToPath(id).replace(directory, "").replace(`-${startRange}`, "");
}

export function convertIdToFileUri(
	id: string,
	rangeStartLine: string,
	rangeStartCharacter: string,
) {
	const startRange = `${rangeStartLine}-${rangeStartCharacter}`;
	return id.replace(`-${startRange}`, "");
}

let cachedGitignorePatterns: string[] | null = null;

export function clearFilterCache() {
	cachedGitignorePatterns = null;
}

export async function checkFileMatch(
	filePath: string,
	includePatterns: string,
	excludePatterns?: string,
): Promise<boolean> {
	// Check inclusion
	const included = await glob(includePatterns, { onlyFiles: true });

	// Check exclusion if patterns are provided
	const excluded = excludePatterns
		? await glob(excludePatterns, { onlyFiles: true })
		: [];

	// File is matched if it appears in included and not in excluded list
	return included.includes(filePath) && !excluded.includes(filePath);
}

export async function getGitignorePatterns(
	workspace: string,
	exclusionFilter?: string,
): Promise<string> {
	if (cachedGitignorePatterns) {
		return `{${cachedGitignorePatterns.join(",")}}`;
	}

	if (!workspace) {
		return "";
	}

	const gitignorePath = path.join(workspace, ".gitignore");

	try {
		const gitignoreContent = await fs.readFile(gitignorePath);
		const gitignoreLines = gitignoreContent.toString().split("\n");

		// Process gitignore patterns
		cachedGitignorePatterns = gitignoreLines
			.filter((line) => line && !line.startsWith("#"))
			.map((pattern) => {
				const trimmed = pattern.trim();
				if (!trimmed) return null;

				// Remove any existing braces or nested groups
				const sanitizedPattern = trimmed
					.replace(/[{}]/g, "")
					.replace(/\s*,\s*/g, ",");

				if (sanitizedPattern.startsWith("!")) {
					return `!**/${sanitizedPattern.slice(1).trim()}`;
				}

				// Ensure pattern starts with **/ if it doesn't already
				const globPattern = sanitizedPattern.startsWith("**/")
					? sanitizedPattern
					: `**/${sanitizedPattern}`;

				return globPattern;
			})
			.filter(Boolean) as string[];

		// Combine and sanitize additional exclusion filters
		if (exclusionFilter) {
			const sanitizedFilters = exclusionFilter
				.split(",")
				.map((filter) => filter.replace(/[{}]/g, "").trim())
				.filter(Boolean);

			cachedGitignorePatterns.push(...sanitizedFilters);
		}

		// Wrap in single outer group
		return `{${cachedGitignorePatterns.join(",")}}`;
	} catch (err) {
		if (err instanceof Error) {
			loggingProvider.logError(`Error reading .gitignore file: ${err.message}`);
		}
		return "";
	}
}
