import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveSkillActivation } from "@/skills/activation.js";

const tempDirs: string[] = [];

const createSkill = (
	root: string,
	skillName: string,
	frontmatter: string,
): void => {
	const skillDir = join(root, skillName);
	mkdirSync(skillDir, { recursive: true });
	writeFileSync(skillDir + "/SKILL.md", `${frontmatter}\n\n# ${skillName}\n`);
};

afterEach(() => {
	for (const dir of tempDirs) {
		rmSync(dir, { recursive: true, force: true });
	}
	tempDirs.length = 0;
});

describe("resolveSkillActivation", () => {
	it("deactivates skills with missing required bins", async () => {
		const root = mkdtempSync(join(tmpdir(), "wingman-skill-activation-"));
		tempDirs.push(root);

		createSkill(
			root,
			"gog",
			`---
name: gog
description: Google tooling
metadata:
  wingman:
    requires:
      bins: ["gog"]
---`,
		);
		createSkill(
			root,
			"weather",
			`---
name: weather
description: Weather tooling
---`,
		);

		const result = await resolveSkillActivation(
			root,
			(binName) => binName !== "gog",
		);

		expect(result.activeSkillNames).toContain("weather");
		expect(result.activeSkillNames).not.toContain("gog");
		expect(result.inactiveSkills).toEqual([
			{
				name: "gog",
				namespace: "wingman",
				requiredBins: ["gog"],
				missingBins: ["gog"],
			},
		]);
	});

	it("ignores unsupported namespaces and keeps skills active", async () => {
		const root = mkdtempSync(join(tmpdir(), "wingman-skill-activation-"));
		tempDirs.push(root);

		createSkill(
			root,
			"legacy",
			`---
name: legacy
description: Legacy metadata
metadata:
  clawdbot:
    requires:
      bins: ["gog"]
---`,
		);

		const result = await resolveSkillActivation(root, () => false);

		expect(result.activeSkillNames).toContain("legacy");
		expect(result.inactiveSkills).toHaveLength(0);
	});

	it("keeps skill active when frontmatter parsing fails", async () => {
		const root = mkdtempSync(join(tmpdir(), "wingman-skill-activation-"));
		tempDirs.push(root);

		const skillDir = join(root, "broken");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(join(skillDir, "SKILL.md"), "---\nname: broken\nnot-valid\n---");

		const result = await resolveSkillActivation(root, () => true);

		expect(result.activeSkillNames).toContain("broken");
		expect(result.inactiveSkills).toHaveLength(0);
	});
});
