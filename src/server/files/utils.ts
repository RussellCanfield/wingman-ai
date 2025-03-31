import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import { TextDocument } from "vscode-languageserver-textdocument";
import type { Location } from "vscode-languageserver";
import { URI } from "vscode-uri";
import { loggingProvider } from "../loggingProvider";
import { glob } from "tinyglobby";
import { minimatch } from "minimatch";

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

/**
 * Checks if a file matches include patterns and doesn't match exclude patterns
 * Updated to use individual patterns for better accuracy
 */
export async function checkFileMatch(
	filePath: string,
	includePatterns: string,
	excludePatterns?: string,
	workspace?: string,
): Promise<boolean> {
	// Check if file matches include patterns
	const isIncluded = minimatch(filePath, includePatterns, {
		dot: true,
		matchBase: true,
	});

	if (!isIncluded) {
		return false; // File doesn't match inclusion pattern
	}

	// If no exclude patterns and file is included, return true
	if (!excludePatterns) {
		return true;
	}

	// Check if the file matches any exclusion pattern
	const isExcluded = minimatch(filePath, excludePatterns, {
		dot: true,
		matchBase: true,
	});

	// If workspace is provided, also check gitignore patterns
	if (workspace) {
		const isExcludedByGitignore = await isFileExcludedByGitignore(
			filePath,
			workspace,
		);
		return isIncluded && !isExcluded && !isExcludedByGitignore;
	}

	// Return true if file is included and not excluded
	return isIncluded && !isExcluded;
}

/**
 * Gets gitignore patterns as an array of individual patterns
 * This makes it easier to process and filter files
 */
export async function getGitignorePatterns(
	workspace: string,
	exclusionFilter?: string,
): Promise<string[]> {
	if (cachedGitignorePatterns) {
		return cachedGitignorePatterns;
	}

	if (!workspace) {
		return [];
	}

	const gitignorePath = path.join(workspace, ".gitignore");

	try {
		const gitignoreContent = await fs.readFile(gitignorePath, "utf8");
		const gitignoreLines = gitignoreContent.toString().split("\n");

		// Process gitignore patterns
		cachedGitignorePatterns = gitignoreLines
			.filter((line) => line && !line.startsWith("#"))
			.map((pattern) => {
				const trimmed = pattern.trim();
				if (!trimmed) return null;

				// Return the pattern as is, without additional modifications
				return trimmed;
			})
			.filter(Boolean) as string[];

		// Add additional exclusion filters if provided
		if (exclusionFilter) {
			const sanitizedFilters = exclusionFilter
				.split(",")
				.map((filter) => filter.trim())
				.filter(Boolean);

			cachedGitignorePatterns.push(...sanitizedFilters);
		}

		loggingProvider.logInfo(
			`Loaded ${cachedGitignorePatterns.length} gitignore patterns from ${gitignorePath}`,
		);
		return cachedGitignorePatterns;
	} catch (err) {
		if (err instanceof Error) {
			loggingProvider.logError(`Error reading .gitignore file: ${err.message}`);
		}
		return [];
	}
}

/**
 * Helper function to check if a file matches any of the gitignore patterns
 * This allows for more accurate pattern matching than trying to use a single combined pattern
 */
export async function isFileExcludedByGitignore(
	filePath: string,
	workspace: string,
): Promise<boolean> {
	const patterns = await getGitignorePatterns(workspace);
	if (patterns.length === 0) return false;

	// Get the relative path for proper matching
	const relativePath = path.relative(workspace, filePath);

	// Match against each pattern individually
	for (const pattern of patterns) {
		// Handle negated patterns (those starting with !)
		if (pattern.startsWith("!")) {
			const negatedPattern = pattern.substring(1);
			if (matchPattern(relativePath, negatedPattern)) {
				// Negated patterns override previous matches
				return false;
			}
		} else if (matchPattern(relativePath, pattern)) {
			return true;
		}
	}

	return false;
}

/**
 * Enhanced pattern matching helper for gitignore rules
 * Handles directory-specific patterns and path segments correctly
 */
function matchPattern(filePath: string, pattern: string): boolean {
	// Normalize path separators
	const normalizedPath = filePath.replace(/\\/g, "/");
	let normalizedPattern = pattern.replace(/\\/g, "/");

	// Handle trailing slashes in patterns
	const isDirectoryPattern = normalizedPattern.endsWith("/");
	if (isDirectoryPattern) {
		normalizedPattern = normalizedPattern.slice(0, -1);
	}

	// First try exact matching (for both directory and non-directory patterns)
	const exactMatchOptions = {
		dot: true,
		nocase: false,
		matchBase: false,
		noglobstar: false,
	};

	// For patterns like "node_modules", we need to match both files and paths that contain node_modules
	// If it's a directory pattern (node_modules/), the pattern should only match directories
	if (!isDirectoryPattern) {
		// For non-directory patterns:
		// 1. Check if the full path matches the pattern
		const fullPathMatch = minimatch(
			normalizedPath,
			normalizedPattern,
			exactMatchOptions,
		);
		if (fullPathMatch) return true;

		// 2. Check if any path segment matches the pattern
		const pathSegments = normalizedPath.split("/");
		return pathSegments.some((segment) => segment === normalizedPattern);
	}
	// For directory patterns:
	// 1. Check if full path matches (should be a directory)
	if (minimatch(normalizedPath, normalizedPattern, exactMatchOptions)) {
		return true;
	}

	// 2. Check if any directory in the path matches the pattern
	// This handles cases like "node_modules/" matching "path/to/node_modules/something"
	const pathSegments = normalizedPath.split("/");
	for (let i = 0; i < pathSegments.length - 1; i++) {
		// Check if this segment matches the directory pattern
		if (pathSegments[i] === normalizedPattern) {
			return true;
		}

		// Check for multi-segment patterns
		if (normalizedPattern.includes("/")) {
			const patternSegments = normalizedPattern.split("/");
			if (i + patternSegments.length <= pathSegments.length) {
				const segmentMatch = patternSegments.every(
					(segment, j) => segment === pathSegments[i + j],
				);
				if (segmentMatch) return true;
			}
		}
	}

	// Fall back to standard minimatch with matchBase (to handle globs like "*.log")
	return minimatch(normalizedPath, normalizedPattern, {
		dot: true,
		matchBase: true,
		nocase: false,
		noglobstar: false,
		preserveMultipleSlashes: true,
	});
}
