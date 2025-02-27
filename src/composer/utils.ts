import type { ChatMessage } from "@langchain/core/messages";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getGitignorePatterns } from "../server/files/utils";
import { minimatch } from "minimatch";

export function formatMessages(messages: ChatMessage[]) {
	return messages
		.map((msg) => {
			const role = msg.role === "user" ? "User" : "Assistant";
			return `${role}: ${msg.content}`;
		})
		.join("\n\n");
}

export async function loadWingmanRules(workspace: string) {
	try {
		const wingmanRules = await fs.readFile(
			path.join(workspace, ".wingmanrules"),
			"utf-8",
		);
		return wingmanRules;
	} catch (e) {
		console.error("Failed to load wingman rules", e);
	}
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
	const excludePatterns = await getGitignorePatterns(cwd ?? dir);

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

		const entries = await fs.readdir(currentPath, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(currentPath, entry.name);
			const relativePath = path.relative(dir, fullPath);

			if (systemDirs.includes(entry.name)) continue;

			// Check if path matches exclude patterns using minimatch
			if (excludePatterns) {
				const isExcluded = minimatch(relativePath, excludePatterns, {
					dot: true,
					matchBase: true,
				});
				if (isExcluded) continue;
			}

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
