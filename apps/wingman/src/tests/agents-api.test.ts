import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as yaml from "js-yaml";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleAgentsApi } from "../gateway/http/agents.js";

const isBunRuntime = typeof (globalThis as any).Bun !== "undefined";
const describeIfBun = isBunRuntime ? describe : describe.skip;

const parseMarkdownAgent = (raw: string) => {
	const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
	const match = raw.match(frontmatterRegex);
	if (!match) {
		throw new Error("Agent markdown is missing frontmatter");
	}
	const metadata = (yaml.load(match[1]) as Record<string, any>) || {};
	return { metadata, prompt: match[2].trim() };
};

describeIfBun("agents API", () => {
	let tempDir: string;
	let config: any;
	let ctx: any;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "wingman-agents-api-"));
		config = {
			agents: {
				list: [],
				bindings: [],
			},
		};
		ctx = {
			workspace: tempDir,
			configDir: tempDir,
			getWingmanConfig: () => config,
			setWingmanConfig: (next: any) => {
				config = next;
			},
			persistWingmanConfig: () => {},
			router: {},
			setRouter: () => {},
			resolveConfigDirPath: () => tempDir,
			getBuiltInTools: () => [],
		};
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("creates agent markdown with promptTraining and subAgents", async () => {
		const createReq = new Request("http://localhost/api/agents", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				id: "orchestrator",
				displayName: "Orchestrator",
				description: "Delegates work",
				tools: ["think", "not_real_tool"],
				prompt: "You are the orchestrator.",
				reasoningEffort: "high",
				promptTraining: {
					enabled: true,
					instructionsPath: "/memories/agents/orchestrator/instructions.md",
				},
				subAgents: [
					{
						id: "planner",
						description: "Plans tasks",
						tools: ["think", "not_real_tool"],
						prompt: "Plan tasks in detail.",
						reasoningEffort: "low",
						promptTraining: true,
					},
					{
						id: "executor",
						description: "Executes tasks",
						tools: ["command_execute"],
						prompt: "Execute planned tasks.",
						thinkingEffort: "minimal",
					},
				],
			}),
		});

		const createRes = await handleAgentsApi(
			ctx as any,
			createReq,
			new URL(createReq.url),
		);
		expect(createRes).not.toBeNull();
		expect(createRes?.ok).toBe(true);
		const created = (await createRes!.json()) as Record<string, any>;
		expect(created.promptTraining).toEqual({
			enabled: true,
			instructionsPath: "/memories/agents/orchestrator/instructions.md",
		});
		expect(created.reasoningEffort).toBe("high");
		expect(created.promptRefinement).toEqual(created.promptTraining);
		expect(created.subAgents).toHaveLength(2);
		expect(created.subAgents[0].promptTraining).toBe(true);
		expect(created.subAgents[0].tools).toEqual(["think"]);
		expect(created.subAgents[0].reasoningEffort).toBe("low");
		expect(created.subAgents[1].reasoningEffort).toBe("minimal");

		const agentPath = join(tempDir, "agents", "orchestrator", "agent.md");
		const parsed = parseMarkdownAgent(readFileSync(agentPath, "utf-8"));
		expect(parsed.prompt).toBe("You are the orchestrator.");
		expect(parsed.metadata.promptRefinement).toEqual({
			enabled: true,
			instructionsPath: "/memories/agents/orchestrator/instructions.md",
		});
		expect(parsed.metadata.reasoningEffort).toBe("high");
		expect(parsed.metadata.subAgents).toHaveLength(2);
		expect(parsed.metadata.subAgents[0].name).toBe("planner");
		expect(parsed.metadata.subAgents[0].reasoningEffort).toBe("low");
		expect(parsed.metadata.subAgents[0].promptRefinement).toBe(true);
		expect(parsed.metadata.subAgents[0].systemPrompt).toBe(
			"Plan tasks in detail.",
		);
		expect(parsed.metadata.subAgents[1].reasoningEffort).toBe("minimal");

		const detailReq = new Request("http://localhost/api/agents/orchestrator", {
			method: "GET",
		});
		const detailRes = await handleAgentsApi(
			ctx as any,
			detailReq,
			new URL(detailReq.url),
		);
		expect(detailRes).not.toBeNull();
		expect(detailRes?.ok).toBe(true);
		const detail = (await detailRes!.json()) as Record<string, any>;
		expect(detail.promptTraining).toEqual(created.promptTraining);
		expect(detail.promptRefinement).toEqual(created.promptTraining);
		expect(detail.reasoningEffort).toBe("high");
		expect(detail.subAgents).toHaveLength(2);
		expect(detail.subAgents[0].id).toBe("planner");
		expect(detail.subAgents[0].prompt).toBe("Plan tasks in detail.");
		expect(detail.subAgents[0].reasoningEffort).toBe("low");
	});

	it("updates promptTraining and subAgents in markdown", async () => {
		const createReq = new Request("http://localhost/api/agents", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				id: "editor-agent",
				tools: ["think"],
				prompt: "Original prompt",
				reasoningEffort: "low",
				promptTraining: true,
				subAgents: [
					{
						id: "planner",
						description: "Plans",
						tools: ["think"],
						prompt: "Original planner prompt",
						reasoningEffort: "minimal",
					},
				],
			}),
		});
		const createRes = await handleAgentsApi(
			ctx as any,
			createReq,
			new URL(createReq.url),
		);
		expect(createRes?.ok).toBe(true);

		const updateReq = new Request("http://localhost/api/agents/editor-agent", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				reasoningEffort: "high",
				promptTraining: false,
				subAgents: [
					{
						id: "reviewer",
						description: "Reviews output",
						tools: ["git_status"],
						prompt: "Review carefully.",
						thinkingEffort: "medium",
						promptTraining: {
							enabled: true,
							instructionsPath: "/memories/reviewer.md",
						},
					},
				],
			}),
		});
		const updateRes = await handleAgentsApi(
			ctx as any,
			updateReq,
			new URL(updateReq.url),
		);
		expect(updateRes).not.toBeNull();
		if (updateRes && !updateRes.ok) {
			throw new Error(await updateRes.text());
		}
		expect(updateRes?.ok).toBe(true);
		const updated = (await updateRes!.json()) as Record<string, any>;
		expect(updated.promptTraining).toBe(false);
		expect(updated.promptRefinement).toBe(false);
		expect(updated.reasoningEffort).toBe("high");
		expect(updated.subAgents).toHaveLength(1);
		expect(updated.subAgents[0].id).toBe("reviewer");
		expect(updated.subAgents[0].reasoningEffort).toBe("medium");
		expect(updated.subAgents[0].promptTraining).toEqual({
			enabled: true,
			instructionsPath: "/memories/reviewer.md",
		});

		const agentPath = join(tempDir, "agents", "editor-agent", "agent.md");
		const parsed = parseMarkdownAgent(readFileSync(agentPath, "utf-8"));
		expect(parsed.metadata.promptRefinement).toBe(false);
		expect(parsed.metadata.reasoningEffort).toBe("high");
		expect(parsed.metadata.subAgents).toHaveLength(1);
		expect(parsed.metadata.subAgents[0].name).toBe("reviewer");
		expect(parsed.metadata.subAgents[0].reasoningEffort).toBe("medium");
		expect(parsed.metadata.subAgents[0].promptRefinement).toEqual({
			enabled: true,
			instructionsPath: "/memories/reviewer.md",
		});
		expect(parsed.metadata.subAgents[0].systemPrompt).toBe("Review carefully.");
	});

	it("accepts legacy promptRefinement input as promptTraining", async () => {
		const createReq = new Request("http://localhost/api/agents", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				id: "legacy-agent",
				tools: ["think"],
				prompt: "Legacy prompt",
				promptRefinement: true,
			}),
		});
		const createRes = await handleAgentsApi(
			ctx as any,
			createReq,
			new URL(createReq.url),
		);
		expect(createRes).not.toBeNull();
		expect(createRes?.ok).toBe(true);
		const created = (await createRes!.json()) as Record<string, any>;
		expect(created.promptTraining).toBe(true);
		expect(created.promptRefinement).toBe(true);
	});

	it("accepts legacy thinkingEffort input as reasoningEffort", async () => {
		const createReq = new Request("http://localhost/api/agents", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				id: "legacy-thinking-agent",
				tools: ["think"],
				prompt: "Legacy thinking prompt",
				thinkingEffort: "medium",
			}),
		});
		const createRes = await handleAgentsApi(
			ctx as any,
			createReq,
			new URL(createReq.url),
		);
		expect(createRes).not.toBeNull();
		expect(createRes?.ok).toBe(true);
		const created = (await createRes!.json()) as Record<string, any>;
		expect(created.reasoningEffort).toBe("medium");
	});
});
