import * as fs from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const uniqueSkillNames = (skills: string[]): string[] => {
	const seen = new Set<string>();
	const unique: string[] = [];
	for (const skill of skills) {
		const normalized = skill.trim();
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		unique.push(normalized);
	}
	return unique;
};

export const createSkillOverlayDirectory = async (
	skillsRoot: string,
	activeSkillNames: string[],
): Promise<string> => {
	const overlayRoot = await fs.mkdtemp(
		join(tmpdir(), "wingman-skill-overlay-"),
	);

	for (const skillName of uniqueSkillNames(activeSkillNames)) {
		const source = join(skillsRoot, skillName);
		const destination = join(overlayRoot, skillName);
		try {
			await fs.symlink(
				source,
				destination,
				process.platform === "win32" ? "junction" : "dir",
			);
		} catch {
			await fs.cp(source, destination, { recursive: true, force: true });
		}
	}

	return overlayRoot;
};

export const removeSkillOverlayDirectory = async (
	overlayPath: string,
): Promise<void> => {
	await fs.rm(overlayPath, { recursive: true, force: true });
};
