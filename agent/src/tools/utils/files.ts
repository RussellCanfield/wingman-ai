import path from "node:path";
import fs from "node:fs";
import { minimatch } from "minimatch";

/**
 * Gets gitignore patterns as an array of individual patterns.
 * This makes it easier to process and filter files.
 */
export async function getGitignorePatterns(
	workspace: string,
	exclusionFilter?: string,
): Promise<string[]> {
	if (!workspace) {
		return [];
	}

	const gitignorePath = path.join(workspace, ".gitignore");
	let patterns: string[] = [];

	try {
		if (!fs.existsSync(gitignorePath)) {
			// If .gitignore doesn't exist, return empty patterns
			return [];
		}

		const gitignoreContent = await fs.promises.readFile(gitignorePath, "utf8");
		const gitignoreLines = gitignoreContent.toString().split("\n");

		// Process gitignore patterns
		patterns = gitignoreLines
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith("#"));

		// Add additional exclusion filters if provided
		if (exclusionFilter) {
			const sanitizedFilters = exclusionFilter
				.split(",")
				.map((filter) => filter.trim())
				.filter(Boolean);

			patterns.push(...sanitizedFilters);
		}

		return patterns;
	} catch (err) {
		// If there was an error but we have an exclusion filter, proceed with that
		if (exclusionFilter) {
			return exclusionFilter
				.split(",")
				.map((filter) => filter.trim())
				.filter(Boolean);
		}
		return [];
	}
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

export interface DirectoryContent {
	type: "file" | "directory";
	name: string;
	path: string;
	depth: number;
}

export async function scanDirectory(
	dir: string,
	maxDepth: number,
	cwd?: string,
): Promise<DirectoryContent[]> {
	const contents: DirectoryContent[] = [];
	const workspaceDir = cwd ?? dir;
	const gitignorePatterns = await getGitignorePatterns(workspaceDir);

	const systemDirs = [
		".git",
		".vscode",
		".idea",
		".DS_Store",
		"node_modules",
		"dist",
		"build",
	];

	async function scan(currentPath: string, currentDepth: number) {
		if (currentDepth > maxDepth) return;

		const entries = await fs.promises.readdir(currentPath, {
			withFileTypes: true,
		});

		for (const entry of entries) {
			const fullPath = path.join(currentPath, entry.name);
			const relativePath = path.relative(dir, fullPath);

			// Skip system directories
			if (systemDirs.includes(entry.name)) continue;

			// Check if path matches gitignore patterns
			const shouldExclude = await isFileExcludedByGitignore(
				fullPath,
				workspaceDir,
			);
			if (shouldExclude) continue;

			if (entry.isDirectory()) {
				contents.push({
					type: "directory",
					name: entry.name,
					path: relativePath,
					depth: currentDepth,
				});

				await scan(fullPath, currentDepth + 1);
			} else {
				contents.push({
					type: "file",
					name: entry.name,
					path: relativePath,
					depth: currentDepth,
				});
			}
		}
	}

	await scan(dir, 0);
	return contents;
}
