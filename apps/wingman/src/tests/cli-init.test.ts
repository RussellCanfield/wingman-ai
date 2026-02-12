import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { executeInitCommand } from "../cli/commands/init";

describe("CLI init", () => {
	let workspace: string;

	beforeEach(() => {
		workspace = mkdtempSync(join(tmpdir(), "wingman-init-"));
	});

	afterEach(() => {
		if (existsSync(workspace)) {
			rmSync(workspace, { recursive: true, force: true });
		}
	});

	it("creates config and agent with defaults", async () => {
		await executeInitCommand(
			{
				subcommand: "",
				args: [],
				verbosity: "silent",
				outputMode: "json",
				options: { yes: true, "skip-provider": true },
				agent: "wingman",
			},
			{ workspace },
		);

		const configPath = join(workspace, ".wingman", "wingman.config.json");
		expect(existsSync(configPath)).toBe(true);
		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		expect(config.defaultAgent).toBe("wingman");
		expect(config.gateway.fsRoots).toContain(".");

		const agentPath = join(
			workspace,
			".wingman",
			"agents",
			"wingman",
			"agent.json",
		);
		expect(existsSync(agentPath)).toBe(true);
		const agent = JSON.parse(readFileSync(agentPath, "utf-8"));
		expect(agent.name).toBe("wingman");

		const codingAgentPath = join(
			workspace,
			".wingman",
			"agents",
			"coding",
			"agent.md",
		);
		expect(existsSync(codingAgentPath)).toBe(true);
		const codingPrompt = readFileSync(codingAgentPath, "utf-8");
		expect(codingPrompt).toContain("write_todos");
		expect(codingPrompt).toContain("read_todos");
		expect(codingPrompt).not.toContain("update_plan");
		expect(codingPrompt).not.toContain("subAgents:");
		expect(codingPrompt).toContain("Do not delegate coding work to subagents");

		const codingV2AgentPath = join(
			workspace,
			".wingman",
			"agents",
			"coding-v2",
			"agent.md",
		);
		expect(existsSync(codingV2AgentPath)).toBe(true);
		const codingV2Prompt = readFileSync(codingV2AgentPath, "utf-8");
		expect(codingV2Prompt).toContain("name: coding-v2");
		expect(codingV2Prompt).toContain("subAgents:");
		expect(codingV2Prompt).toContain("name: coding-worker");
		expect(codingV2Prompt).toContain("promptFile: ./implementor.md");
		expect(codingV2Prompt).toContain("`task` tool");
		expect(codingV2Prompt).toContain("write_todos");
		expect(codingV2Prompt).toContain("read_todos");

		const codingV2ImplementorPath = join(
			workspace,
			".wingman",
			"agents",
			"coding-v2",
			"implementor.md",
		);
		const codingV2PlannerPath = join(
			workspace,
			".wingman",
			"agents",
			"coding-v2",
			"planner.md",
		);
		const codingV2ReviewerPath = join(
			workspace,
			".wingman",
			"agents",
			"coding-v2",
			"reviewer.md",
		);
		const codingV2ResearcherPath = join(
			workspace,
			".wingman",
			"agents",
			"coding-v2",
			"researcher.md",
		);
		expect(existsSync(codingV2ImplementorPath)).toBe(true);
		expect(existsSync(codingV2PlannerPath)).toBe(false);
		expect(existsSync(codingV2ReviewerPath)).toBe(false);
		expect(existsSync(codingV2ResearcherPath)).toBe(false);

		const gameDevAgentPath = join(
			workspace,
			".wingman",
			"agents",
			"game-dev",
			"agent.md",
		);
		expect(existsSync(gameDevAgentPath)).toBe(true);
		const gameDevPrompt = readFileSync(gameDevAgentPath, "utf-8");
		expect(gameDevPrompt).toContain("name: game-dev");
		expect(gameDevPrompt).toContain("subAgents:");
		expect(gameDevPrompt).toContain("name: art-generation");
		expect(gameDevPrompt).toContain("promptFile: ./art-generation.md");
		expect(gameDevPrompt).toContain("name: asset-refinement");
		expect(gameDevPrompt).toContain("promptFile: ./asset-refinement.md");
		expect(gameDevPrompt).toContain("name: planning-idea");
		expect(gameDevPrompt).toContain("promptFile: ./planning-idea.md");
		expect(gameDevPrompt).toContain("name: ui-specialist");
		expect(gameDevPrompt).toContain("promptFile: ./ui-specialist.md");
		expect(gameDevPrompt).toContain("write_todos");
		expect(gameDevPrompt).toContain("read_todos");
		expect(gameDevPrompt).toContain("UV-aware texture planning");
		expect(gameDevPrompt).toContain("MeshStandardMaterial");
		expect(gameDevPrompt).toContain("uv`/`uv2");

		const gameDevArtGenerationPath = join(
			workspace,
			".wingman",
			"agents",
			"game-dev",
			"art-generation.md",
		);
		const gameDevAssetRefinementPath = join(
			workspace,
			".wingman",
			"agents",
			"game-dev",
			"asset-refinement.md",
		);
		const gameDevPlanningIdeaPath = join(
			workspace,
			".wingman",
			"agents",
			"game-dev",
			"planning-idea.md",
		);
		const gameDevUiSpecialistPath = join(
			workspace,
			".wingman",
			"agents",
			"game-dev",
			"ui-specialist.md",
		);
		expect(existsSync(gameDevArtGenerationPath)).toBe(true);
		expect(existsSync(gameDevAssetRefinementPath)).toBe(true);
		expect(existsSync(gameDevPlanningIdeaPath)).toBe(true);
		expect(existsSync(gameDevUiSpecialistPath)).toBe(true);
		const gameDevArtGenerationPrompt = readFileSync(
			gameDevArtGenerationPath,
			"utf-8",
		);
		expect(gameDevArtGenerationPrompt).toContain("UV set(s) or UDIM tiles");
		expect(gameDevArtGenerationPrompt).toContain("texel density targets");
		expect(gameDevArtGenerationPrompt).toContain(
			"Texture-to-geometry mapping notes",
		);
		expect(gameDevArtGenerationPrompt).toContain("material slot");
		expect(gameDevArtGenerationPrompt).toContain("need `uv`, and `aoMap`");
		expect(gameDevArtGenerationPrompt).toContain("flipY = false");
		expect(gameDevArtGenerationPrompt).toContain("RepeatWrapping");
	});

	it("merges existing config when --merge is set", async () => {
		const configDir = join(workspace, ".wingman");
		mkdirSync(configDir, { recursive: true });
		const configPath = join(configDir, "wingman.config.json");

		writeFileSync(
			configPath,
			JSON.stringify(
				{
					logLevel: "debug",
					gateway: { fsRoots: ["./existing"] },
				},
				null,
				2,
			),
		);

		await executeInitCommand(
			{
				subcommand: "",
				args: [],
				verbosity: "silent",
				outputMode: "json",
				options: { merge: true, "skip-provider": true },
				agent: "wingman",
			},
			{ workspace },
		);

		const updated = JSON.parse(readFileSync(configPath, "utf-8"));
		expect(updated.logLevel).toBe("debug");
		expect(updated.defaultAgent).toBe("wingman");
		expect(updated.gateway.fsRoots).toEqual(
			expect.arrayContaining(["./existing", "."]),
		);
	});
});
