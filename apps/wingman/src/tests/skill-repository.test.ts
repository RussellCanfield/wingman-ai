import { afterEach, describe, expect, it, vi } from "vitest";
import { SkillRepository } from "@/cli/services/skillRepository.js";

describe("SkillRepository clawhub provider", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it("lists skills from ClawHub", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					items: [
						{
							slug: "gog",
							displayName: "Gog",
							summary: "Google workspace tooling",
							latestVersion: { version: "1.0.0" },
						},
					],
					nextCursor: null,
				}),
				{ status: 200 },
			),
		);
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const repository = new SkillRepository({
			provider: "clawhub",
			clawhubBaseUrl: "https://clawhub.ai",
		});
		const skills = await repository.listAvailableSkills();

		expect(skills).toEqual([
			{
				name: "gog",
				description: "Google workspace tooling",
				path: "gog",
				metadata: {
					name: "gog",
					description: "Google workspace tooling",
				},
			},
		]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][0]).toBe(
			"https://clawhub.ai/api/v1/skills?sort=downloads&limit=100",
		);
	});

	it("downloads files for a ClawHub skill", async () => {
		const fetchMock = vi.fn(async (input: string | URL) => {
			const url = input.toString();
			if (url === "https://clawhub.ai/api/v1/skills/gog") {
				return new Response(
					JSON.stringify({
						skill: { slug: "gog", summary: "Google workspace tooling" },
						latestVersion: { version: "1.0.0" },
					}),
					{ status: 200 },
				);
			}
			if (url === "https://clawhub.ai/api/v1/skills/gog/versions/1.0.0") {
				return new Response(
					JSON.stringify({
						version: {
							version: "1.0.0",
							files: [{ path: "SKILL.md" }, { path: "examples.md" }],
						},
					}),
					{ status: 200 },
				);
			}
			if (url.includes("/api/v1/skills/gog/file?")) {
				const parsed = new URL(url);
				const requestedPath = parsed.searchParams.get("path");
				if (requestedPath === "SKILL.md") {
					return new Response("---\nname: gog\ndescription: Test\n---\n", {
						status: 200,
					});
				}
				if (requestedPath === "examples.md") {
					return new Response("# Examples", { status: 200 });
				}
			}
			return new Response("Not Found", { status: 404 });
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const repository = new SkillRepository({
			provider: "clawhub",
			clawhubBaseUrl: "https://clawhub.ai",
		});
		const files = await repository.downloadSkill("gog");

		expect(files.size).toBe(2);
		expect(Buffer.isBuffer(files.get("SKILL.md"))).toBe(true);
		expect(files.get("SKILL.md")?.toString("utf-8")).toContain("name: gog");
		expect(files.get("examples.md")?.toString("utf-8")).toContain("Examples");
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});
});

describe("SkillRepository github provider", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it("merges skills across repositories with later sources overriding earlier ones", async () => {
		const encodeSkill = (name: string, description: string): string =>
			Buffer.from(
				`---\nname: ${name}\ndescription: ${description}\n---\n`,
				"utf-8",
			).toString("base64");

		const fetchMock = vi.fn(async (input: string | URL) => {
			const url = input.toString();
			if (url.endsWith("/repos/example-org/community-skills/contents/skills")) {
				return new Response(
					JSON.stringify([
						{
							name: "gog",
							path: "skills/gog",
							type: "dir",
							url: "https://api.github.com/repos/example-org/community-skills/contents/skills/gog",
						},
						{
							name: "alpha",
							path: "skills/alpha",
							type: "dir",
							url: "https://api.github.com/repos/example-org/community-skills/contents/skills/alpha",
						},
					]),
					{ status: 200 },
				);
			}
			if (
				url.endsWith("/repos/example-team/custom-skills/contents/skills")
			) {
				return new Response(
					JSON.stringify([
						{
							name: "alpha",
							path: "skills/alpha",
							type: "dir",
							url: "https://api.github.com/repos/example-team/custom-skills/contents/skills/alpha",
						},
						{
							name: "wingman-special",
							path: "skills/wingman-special",
							type: "dir",
							url: "https://api.github.com/repos/example-team/custom-skills/contents/skills/wingman-special",
						},
					]),
					{ status: 200 },
				);
			}
			if (
				url.endsWith(
					"/repos/example-org/community-skills/contents/skills/gog/SKILL.md",
				)
			) {
				return new Response(
					JSON.stringify({
						type: "file",
						content: encodeSkill("gog", "Community gog skill"),
					}),
					{ status: 200 },
				);
			}
			if (
				url.endsWith(
					"/repos/example-org/community-skills/contents/skills/alpha/SKILL.md",
				)
			) {
				return new Response(
					JSON.stringify({
						type: "file",
						content: encodeSkill("alpha", "Community alpha skill"),
					}),
					{ status: 200 },
				);
			}
			if (
				url.endsWith(
					"/repos/example-team/custom-skills/contents/skills/alpha/SKILL.md",
				)
			) {
				return new Response(
					JSON.stringify({
						type: "file",
						content: encodeSkill("alpha", "Custom alpha override"),
					}),
					{ status: 200 },
				);
			}
			if (
				url.endsWith(
					"/repos/example-team/custom-skills/contents/skills/wingman-special/SKILL.md",
				)
			) {
				return new Response(
					JSON.stringify({
						type: "file",
						content: encodeSkill("wingman-special", "Custom-only skill"),
					}),
					{ status: 200 },
				);
			}
			return new Response("Not Found", { status: 404 });
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const repository = new SkillRepository({
			provider: "github",
			repositories: [
				{ owner: "example-org", name: "community-skills" },
				{ owner: "example-team", name: "custom-skills" },
			],
		});

		const skills = await repository.listAvailableSkills();

		expect(skills).toEqual([
			{
				name: "gog",
				description: "Community gog skill",
				path: "skills/gog",
				metadata: {
					name: "gog",
					description: "Community gog skill",
				},
			},
			{
				name: "alpha",
				description: "Custom alpha override",
				path: "skills/alpha",
				metadata: {
					name: "alpha",
					description: "Custom alpha override",
				},
			},
			{
				name: "wingman-special",
				description: "Custom-only skill",
				path: "skills/wingman-special",
				metadata: {
					name: "wingman-special",
					description: "Custom-only skill",
				},
			},
		]);
	});

	it("downloads a skill from the highest-priority matching repository", async () => {
		const encodedSkill = Buffer.from(
			"---\nname: alpha\ndescription: Custom alpha override\n---\n",
			"utf-8",
		).toString("base64");
		const encodedExample = Buffer.from("# Custom Example\n", "utf-8").toString(
			"base64",
		);

		const fetchMock = vi.fn(async (input: string | URL) => {
			const url = input.toString();
			if (
				url.endsWith(
					"/repos/example-team/custom-skills/contents/skills/alpha/SKILL.md",
				)
			) {
				return new Response(
					JSON.stringify({
						type: "file",
						content: encodedSkill,
						encoding: "base64",
					}),
					{ status: 200 },
				);
			}
			if (url.endsWith("/repos/example-team/custom-skills/contents/skills/alpha")) {
				return new Response(
					JSON.stringify([
						{
							type: "file",
							name: "SKILL.md",
							path: "skills/alpha/SKILL.md",
							content: encodedSkill,
							encoding: "base64",
						},
						{
							type: "file",
							name: "examples.md",
							path: "skills/alpha/examples.md",
							content: encodedExample,
							encoding: "base64",
						},
					]),
					{ status: 200 },
				);
			}
			return new Response("Not Found", { status: 404 });
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const repository = new SkillRepository({
			provider: "github",
			repositories: [
				{ owner: "example-org", name: "community-skills" },
				{ owner: "example-team", name: "custom-skills" },
			],
		});

		const files = await repository.downloadSkill("alpha");

		expect(files.size).toBe(2);
		expect(files.get("SKILL.md")?.toString("utf-8")).toContain(
			"Custom alpha override",
		);
		expect(files.get("examples.md")?.toString("utf-8")).toContain(
			"Custom Example",
		);

		const requestedUrls = fetchMock.mock.calls.map((call) =>
			(call[0] as URL | string).toString(),
		);
		expect(
			requestedUrls.some((url) =>
				url.includes("/repos/example-org/community-skills/contents/skills/alpha"),
			),
		).toBe(false);
	});

	it("uses legacy repositoryOwner/repositoryName when repositories are not provided", async () => {
		const fetchMock = vi.fn(async (input: string | URL) => {
			const url = input.toString();
			if (url.endsWith("/repos/myorg/myskills/contents/skills")) {
				return new Response(
					JSON.stringify([
						{
							name: "legacy-skill",
							path: "skills/legacy-skill",
							type: "dir",
							url: "https://api.github.com/repos/myorg/myskills/contents/skills/legacy-skill",
						},
					]),
					{ status: 200 },
				);
			}
			if (
				url.endsWith("/repos/myorg/myskills/contents/skills/legacy-skill/SKILL.md")
			) {
				return new Response(
					JSON.stringify({
						type: "file",
						content: Buffer.from(
							"---\nname: legacy-skill\ndescription: Legacy source\n---\n",
							"utf-8",
						).toString("base64"),
					}),
					{ status: 200 },
				);
			}
			return new Response("Not Found", { status: 404 });
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const repository = new SkillRepository({
			provider: "github",
			repositoryOwner: "myorg",
			repositoryName: "myskills",
		});

		const skills = await repository.listAvailableSkills();
		expect(skills).toHaveLength(1);
		expect(skills[0]?.name).toBe("legacy-skill");
	});

	it("fails clearly when github provider has no configured repositories", async () => {
		const repository = new SkillRepository({
			provider: "github",
		});

		await expect(repository.listAvailableSkills()).rejects.toThrow(
			"No GitHub skill repositories configured",
		);
	});
});

describe("SkillRepository hybrid provider", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
		vi.restoreAllMocks();
	});

	it("merges ClawHub and GitHub skills, with GitHub overriding conflicts", async () => {
		const encodeSkill = (name: string, description: string): string =>
			Buffer.from(
				`---\nname: ${name}\ndescription: ${description}\n---\n`,
				"utf-8",
			).toString("base64");

		const fetchMock = vi.fn(async (input: string | URL) => {
			const url = input.toString();
			if (url === "https://clawhub.ai/api/v1/skills?sort=downloads&limit=100") {
				return new Response(
					JSON.stringify({
						items: [
							{ slug: "alpha", summary: "ClawHub alpha skill" },
							{ slug: "weather", summary: "ClawHub weather skill" },
						],
						nextCursor: null,
					}),
					{ status: 200 },
				);
			}
			if (url.endsWith("/repos/example-team/custom-skills/contents/skills")) {
				return new Response(
					JSON.stringify([
						{
							name: "alpha",
							path: "skills/alpha",
							type: "dir",
							url: "https://api.github.com/repos/example-team/custom-skills/contents/skills/alpha",
						},
						{
							name: "wingman-special",
							path: "skills/wingman-special",
							type: "dir",
							url: "https://api.github.com/repos/example-team/custom-skills/contents/skills/wingman-special",
						},
					]),
					{ status: 200 },
				);
			}
			if (
				url.endsWith(
					"/repos/example-team/custom-skills/contents/skills/alpha/SKILL.md",
				)
			) {
				return new Response(
					JSON.stringify({
						type: "file",
						content: encodeSkill("alpha", "GitHub alpha override"),
					}),
					{ status: 200 },
				);
			}
			if (
				url.endsWith(
					"/repos/example-team/custom-skills/contents/skills/wingman-special/SKILL.md",
				)
			) {
				return new Response(
					JSON.stringify({
						type: "file",
						content: encodeSkill("wingman-special", "GitHub only skill"),
					}),
					{ status: 200 },
				);
			}
			return new Response("Not Found", { status: 404 });
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const repository = new SkillRepository({
			provider: "hybrid",
			repositories: [{ owner: "example-team", name: "custom-skills" }],
			clawhubBaseUrl: "https://clawhub.ai",
		});

		const skills = await repository.listAvailableSkills();

		expect(skills).toEqual([
			{
				name: "weather",
				description: "ClawHub weather skill",
				path: "weather",
				metadata: {
					name: "weather",
					description: "ClawHub weather skill",
				},
			},
			{
				name: "alpha",
				description: "GitHub alpha override",
				path: "skills/alpha",
				metadata: {
					name: "alpha",
					description: "GitHub alpha override",
				},
			},
			{
				name: "wingman-special",
				description: "GitHub only skill",
				path: "skills/wingman-special",
				metadata: {
					name: "wingman-special",
					description: "GitHub only skill",
				},
			},
		]);
	});

	it("falls back to ClawHub when a skill is missing from configured GitHub repos", async () => {
		const fetchMock = vi.fn(async (input: string | URL) => {
			const url = input.toString();
			if (
				url.endsWith(
					"/repos/example-team/custom-skills/contents/skills/gog/SKILL.md",
				)
			) {
				return new Response("Not Found", { status: 404 });
			}
			if (url === "https://clawhub.ai/api/v1/skills/gog") {
				return new Response(
					JSON.stringify({
						skill: { slug: "gog", summary: "Google workspace tooling" },
						latestVersion: { version: "1.0.0" },
					}),
					{ status: 200 },
				);
			}
			if (url === "https://clawhub.ai/api/v1/skills/gog/versions/1.0.0") {
				return new Response(
					JSON.stringify({
						version: {
							version: "1.0.0",
							files: [{ path: "SKILL.md" }],
						},
					}),
					{ status: 200 },
				);
			}
			if (url.includes("/api/v1/skills/gog/file?")) {
				return new Response("---\nname: gog\ndescription: Test\n---\n", {
					status: 200,
				});
			}
			return new Response("Not Found", { status: 404 });
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const repository = new SkillRepository({
			provider: "hybrid",
			repositories: [{ owner: "example-team", name: "custom-skills" }],
			clawhubBaseUrl: "https://clawhub.ai",
		});

		const metadata = await repository.getSkillMetadata("gog");
		expect(metadata.name).toBe("gog");
		expect(metadata.description).toContain("Google workspace tooling");

		const files = await repository.downloadSkill("gog");
		expect(files.has("SKILL.md")).toBe(true);
	});
});
