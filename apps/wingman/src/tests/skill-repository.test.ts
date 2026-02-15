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
