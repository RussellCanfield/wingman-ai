import * as fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import { join } from "node:path";
import {
	findMissingBins,
	type BinAvailabilityChecker,
	isBinAvailable,
} from "./bin-requirements.js";
import { parseSkillFrontmatter } from "./metadata.js";

export interface InactiveSkill {
	name: string;
	namespace: "wingman" | "openclaw";
	requiredBins: string[];
	missingBins: string[];
}

export interface SkillActivationResult {
	activeSkillNames: string[];
	inactiveSkills: InactiveSkill[];
}

export const resolveSkillActivation = async (
	skillsRoot: string,
	checkBin: BinAvailabilityChecker = isBinAvailable,
): Promise<SkillActivationResult> => {
	const activeSkillNames: string[] = [];
	const inactiveSkills: InactiveSkill[] = [];

	let entries: Dirent<string>[] = [];
	try {
		entries = await fs.readdir(skillsRoot, {
			withFileTypes: true,
			encoding: "utf8",
		});
	} catch {
		return { activeSkillNames, inactiveSkills };
	}

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;

		const skillName = entry.name;
		const skillMdPath = join(skillsRoot, skillName, "SKILL.md");
		let content: string;
		try {
			content = await fs.readFile(skillMdPath, "utf-8");
		} catch {
			continue;
		}

		try {
			const parsed = parseSkillFrontmatter(content);
			const runtime = parsed.runtimeMetadata;
			const requiredBins = runtime?.requires.bins || [];
			if (!runtime || requiredBins.length === 0) {
				activeSkillNames.push(skillName);
				continue;
			}

			const missingBins = findMissingBins(requiredBins, checkBin);
			if (missingBins.length === 0) {
				activeSkillNames.push(skillName);
				continue;
			}

			inactiveSkills.push({
				name: skillName,
				namespace: runtime.namespace,
				requiredBins,
				missingBins,
			});
		} catch {
			// Keep behavior permissive when parsing fails so skills aren't unexpectedly hidden.
			activeSkillNames.push(skillName);
		}
	}

	return {
		activeSkillNames,
		inactiveSkills,
	};
};
