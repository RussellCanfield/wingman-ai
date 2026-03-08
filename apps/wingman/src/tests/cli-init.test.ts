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

	it("creates config and bundled agents with an explicit default agent", async () => {
		await executeInitCommand(
			{
				subcommand: "",
				args: [],
				verbosity: "silent",
				outputMode: "json",
				options: { yes: true, only: "config,agents" },
				agent: "main",
			},
			{ workspace },
		);

		const configPath = join(workspace, ".wingman", "wingman.config.json");
		expect(existsSync(configPath)).toBe(true);
		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		expect(config.defaultAgent).toBe("main");
		expect(config.gateway.fsRoots).toContain(".");
		expect(config.browser?.defaultProfile).toBe("default");
		expect(config.browser?.profiles?.default).toBe(
			".wingman/browser-profiles/default",
		);
		expect(config.browser?.extensions?.wingman).toBe(
			".wingman/browser-extensions/wingman",
		);
		expect(config.browser?.defaultExtensions).toContain("wingman");
		expect(
			existsSync(join(workspace, ".wingman", "browser-profiles", "default")),
		).toBe(true);
		expect(
			existsSync(
				join(
					workspace,
					".wingman",
					"browser-extensions",
					"wingman",
					"manifest.json",
				),
			),
		).toBe(true);

		const mainAgentPath = join(
			workspace,
			".wingman",
			"agents",
			"main",
			"agent.md",
		);
		expect(existsSync(mainAgentPath)).toBe(true);
		const mainAgent = readFileSync(mainAgentPath, "utf-8");
		expect(mainAgent).toContain("name: main");
		expect(mainAgent).toContain("- browser_control");
		expect(
			existsSync(
				join(workspace, ".wingman", "agents", "main", "agent.json"),
			),
		).toBe(false);

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
		expect(gameDevPrompt).toContain("name: art-director");
		expect(gameDevPrompt).toContain("promptFile: ./art-director.md");
		expect(gameDevPrompt).toContain("name: scene-engineer");
		expect(gameDevPrompt).toContain("promptFile: ./scene-engineer.md");
		expect(gameDevPrompt).toContain("name: game-designer");
		expect(gameDevPrompt).toContain("promptFile: ./game-designer.md");
		expect(gameDevPrompt).toContain("write_todos");
		expect(gameDevPrompt).toContain("read_todos");
		expect(gameDevPrompt).toContain("Delegation routing");
		expect(gameDevPrompt).toContain("MeshStandardMaterial");
		expect(gameDevPrompt).toContain("three-mesh-bvh");
		expect((gameDevPrompt.match(/- browser_control/g) || []).length).toBe(4);
		expect(gameDevPrompt).toContain("Playwright persistent-context");

		const gameDevArtDirectorPath = join(
			workspace,
			".wingman",
			"agents",
			"game-dev",
			"art-director.md",
		);
		const gameDevSceneEngineerPath = join(
			workspace,
			".wingman",
			"agents",
			"game-dev",
			"scene-engineer.md",
		);
		const gameDevDesignerPath = join(
			workspace,
			".wingman",
			"agents",
			"game-dev",
			"game-designer.md",
		);
		expect(existsSync(gameDevArtDirectorPath)).toBe(true);
		expect(existsSync(gameDevSceneEngineerPath)).toBe(true);
		expect(existsSync(gameDevDesignerPath)).toBe(true);
		const gameDevArtDirectorPrompt = readFileSync(
			gameDevArtDirectorPath,
			"utf-8",
		);
		expect(gameDevArtDirectorPrompt).toContain("You are `art-director`");
		expect(gameDevArtDirectorPrompt).toContain(
			"Texture-to-geometry mapping: mesh, material slot, UV set",
		);
		expect(gameDevArtDirectorPrompt).toContain("flipY = false");
		expect(gameDevArtDirectorPrompt).toContain("RepeatWrapping");
		const gameDevSceneEngineerPrompt = readFileSync(
			gameDevSceneEngineerPath,
			"utf-8",
		);
		expect(gameDevSceneEngineerPrompt).toContain("You are `scene-engineer`");
		expect(gameDevSceneEngineerPrompt).toContain(
			"Rapier is the default physics engine",
		);
		expect(gameDevSceneEngineerPrompt).toContain(
			"Prefer `postprocessing` over Three.js built-in `EffectComposer`",
		);
		expect(gameDevSceneEngineerPrompt).toContain(
			"Use `browser_control` to validate live WebGL builds in-browser",
		);
		const gameDevDesignerPrompt = readFileSync(gameDevDesignerPath, "utf-8");
		expect(gameDevDesignerPrompt).toContain("You are `game-designer`");
		expect(gameDevDesignerPrompt).toContain(
			"Always present 2-3 mechanic variants with tradeoffs",
		);
		expect(gameDevDesignerPrompt).toContain("UI Conventions");
		expect(gameDevDesignerPrompt).toContain(
			"Use `browser_control` to validate menu flows",
		);

		const mainAgentTemplatePath = join(
			workspace,
			".wingman",
			"agents",
			"main",
			"agent.md",
		);
		expect(existsSync(mainAgentTemplatePath)).toBe(true);
		const mainAgentTemplatePrompt = readFileSync(
			mainAgentTemplatePath,
			"utf-8",
		);
		expect(mainAgentTemplatePrompt).toContain("name: main");
		expect(mainAgentTemplatePrompt).toContain("Primary Wingman agent");
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
				options: { merge: true, only: "config" },
				agent: "main",
			},
			{ workspace },
		);

		const updated = JSON.parse(readFileSync(configPath, "utf-8"));
		expect(updated.logLevel).toBe("debug");
		expect(updated.defaultAgent).toBe("main");
		expect(updated.gateway.fsRoots).toEqual(
			expect.arrayContaining(["./existing", "."]),
		);
		expect(updated.browser?.defaultProfile).toBe("default");
		expect(updated.browser?.profiles?.default).toBe(
			".wingman/browser-profiles/default",
		);
		expect(updated.browser?.extensions?.wingman).toBe(
			".wingman/browser-extensions/wingman",
		);
		expect(updated.browser?.defaultExtensions).toContain("wingman");
	});

	it("merges config without overriding existing browser profile defaults", async () => {
		const configDir = join(workspace, ".wingman");
		const configPath = join(configDir, "wingman.config.json");
		mkdirSync(configDir, { recursive: true });
		writeFileSync(
			configPath,
			JSON.stringify(
				{
					defaultAgent: "wingman",
					browser: {
						defaultProfile: "trading",
						profiles: {
							trading: ".wingman/browser-profiles/trading",
						},
						extensions: {
							relay: ".wingman/browser-extensions/relay",
						},
						defaultExtensions: ["relay"],
					},
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
				options: { merge: true, only: "config" },
				agent: "main",
			},
			{ workspace },
		);

		const updated = JSON.parse(readFileSync(configPath, "utf-8"));
		expect(updated.browser?.defaultProfile).toBe("trading");
		expect(updated.browser?.profiles?.trading).toBe(
			".wingman/browser-profiles/trading",
		);
		expect(updated.browser?.defaultExtensions).toEqual(
			expect.arrayContaining(["relay", "wingman"]),
		);
		expect(updated.browser?.extensions?.relay).toBe(
			".wingman/browser-extensions/relay",
		);
		expect(updated.browser?.extensions?.wingman).toBe(
			".wingman/browser-extensions/wingman",
		);
	});

	it("sync mode copies bundled agents without creating config", async () => {
		await executeInitCommand(
			{
				subcommand: "",
				args: [],
				verbosity: "silent",
				outputMode: "json",
				options: { mode: "sync", only: "agents", force: true },
				agent: "main",
			},
			{ workspace },
		);

		const configPath = join(workspace, ".wingman", "wingman.config.json");
		expect(existsSync(configPath)).toBe(false);

		const codingAgentPath = join(
			workspace,
			".wingman",
			"agents",
			"coding",
			"agent.md",
		);
		expect(existsSync(codingAgentPath)).toBe(true);

		const starterAgentPath = join(
			workspace,
			".wingman",
			"agents",
			"main",
			"agent.json",
		);
		expect(existsSync(starterAgentPath)).toBe(false);
	});

	it("applies explicit model overrides to bundled markdown agents", async () => {
		await executeInitCommand(
			{
				subcommand: "",
				args: [],
				verbosity: "silent",
				outputMode: "json",
				options: {
					yes: true,
					only: "agents",
					model: "openai:gpt-4o",
					force: true,
				},
				agent: "main",
			},
			{ workspace },
		);

		const mainAgentPath = join(
			workspace,
			".wingman",
			"agents",
			"main",
			"agent.md",
		);
		const mainAgent = readFileSync(mainAgentPath, "utf-8");
		expect(mainAgent).toContain("model: openai:gpt-4o");
		expect((mainAgent.match(/model:/g) || []).length).toBe(1);
	});
});
