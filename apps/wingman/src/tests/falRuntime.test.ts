import { describe, expect, it } from "vitest";
import {
	resolveFalLocalMediaPath,
	resolveFalOutputDir,
	resolveFalStateDir,
	resolveFalWorkdir,
} from "../tools/fal/runtime.js";

describe("fal runtime paths", () => {
	it("uses WINGMAN_WORKDIR when provided", () => {
		const workdir = resolveFalWorkdir({
			env: { WINGMAN_WORKDIR: "/tmp/wingman-session" },
			cwd: "/repo/apps/wingman",
		});
		expect(workdir).toBe("/tmp/wingman-session");
	});

	it("resolves relative WINGMAN_WORKDIR against cwd", () => {
		const workdir = resolveFalWorkdir({
			env: { WINGMAN_WORKDIR: "projects/game" },
			cwd: "/Users/test",
		});
		expect(workdir).toBe("/Users/test/projects/game");
	});

	it("prefers explicit FAL_MCP_STATE_DIR", () => {
		const stateDir = resolveFalStateDir({
			env: {
				WINGMAN_WORKDIR: "/tmp/session",
				FAL_MCP_STATE_DIR: "/tmp/custom-state",
			},
			cwd: "/repo/apps/wingman",
		});
		expect(stateDir).toBe("/tmp/custom-state");
	});

	it("defaults state dir under working folder", () => {
		const stateDir = resolveFalStateDir({
			env: { WINGMAN_WORKDIR: "/tmp/session" },
			cwd: "/repo/apps/wingman",
		});
		expect(stateDir).toBe("/tmp/session/.wingman/fal-ai");
	});

	it("prefers explicit FAL_MCP_OUTPUT_DIR", () => {
		const outputDir = resolveFalOutputDir({
			env: {
				WINGMAN_WORKDIR: "/tmp/session",
				FAL_MCP_OUTPUT_DIR: "assets/out",
			},
			cwd: "/repo/apps/wingman",
		});
		expect(outputDir).toBe("/tmp/session/assets/out");
	});

	it("defaults output dir under working folder", () => {
		const outputDir = resolveFalOutputDir({
			env: { WINGMAN_WORKDIR: "/tmp/session" },
			cwd: "/repo/apps/wingman",
		});
		expect(outputDir).toBe("/tmp/session/generated");
	});

	it("resolves local relative media paths against working folder", () => {
		const resolved = resolveFalLocalMediaPath(
			"images/source.png",
			"/tmp/session",
			{
				cwd: "/repo/apps/wingman",
			},
		);
		expect(resolved).toBe("/tmp/session/images/source.png");
	});

	it("keeps local absolute media paths unchanged", () => {
		const resolved = resolveFalLocalMediaPath(
			"/tmp/session/images/source.png",
			"/tmp/session",
			{ cwd: "/repo/apps/wingman" },
		);
		expect(resolved).toBe("/tmp/session/images/source.png");
	});
});
