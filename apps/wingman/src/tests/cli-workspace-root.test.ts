import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveWorkspaceRoot } from "@/cli/core/workspace.js";

describe("resolveWorkspaceRoot", () => {
	let sandbox: string;

	beforeEach(() => {
		sandbox = join(tmpdir(), `wingman-workspace-${Date.now()}-${Math.random()}`);
		mkdirSync(sandbox, { recursive: true });
	});

	afterEach(() => {
		if (existsSync(sandbox)) {
			rmSync(sandbox, { recursive: true, force: true });
		}
	});

	it("uses explicit workspace override when provided", () => {
		const startDir = join(sandbox, "repo", "apps", "wingman");
		mkdirSync(startDir, { recursive: true });

		const resolved = resolveWorkspaceRoot(startDir, "../..");

		expect(resolved).toBe(resolve(startDir, "../.."));
	});

	it("finds nearest ancestor with .wingman/wingman.config.json", () => {
		const workspaceRoot = join(sandbox, "repo");
		const nestedDir = join(workspaceRoot, "apps", "wingman", "src");
		mkdirSync(join(workspaceRoot, ".wingman"), { recursive: true });
		mkdirSync(nestedDir, { recursive: true });
		writeFileSync(
			join(workspaceRoot, ".wingman", "wingman.config.json"),
			JSON.stringify({ logLevel: "info" }),
		);

		const resolved = resolveWorkspaceRoot(nestedDir);

		expect(resolved).toBe(workspaceRoot);
	});

	it("finds nearest ancestor with .wingman/agents marker", () => {
		const workspaceRoot = join(sandbox, "repo");
		const nestedDir = join(workspaceRoot, "packages", "cli");
		mkdirSync(join(workspaceRoot, ".wingman", "agents"), { recursive: true });
		mkdirSync(nestedDir, { recursive: true });

		const resolved = resolveWorkspaceRoot(nestedDir);

		expect(resolved).toBe(workspaceRoot);
	});

	it("does not search above git root when workspace markers are missing", () => {
		const parentRoot = join(sandbox, "parent");
		const gitRoot = join(parentRoot, "repo");
		const nestedDir = join(gitRoot, "apps", "wingman");
		mkdirSync(join(parentRoot, ".wingman"), { recursive: true });
		mkdirSync(join(gitRoot, ".git"), { recursive: true });
		mkdirSync(nestedDir, { recursive: true });
		writeFileSync(
			join(parentRoot, ".wingman", "wingman.config.json"),
			JSON.stringify({ logLevel: "info" }),
		);

		const resolved = resolveWorkspaceRoot(nestedDir);

		expect(resolved).toBe(nestedDir);
	});

	it("falls back to nested apps/wingman workspace from repo root", () => {
		const repoRoot = join(sandbox, "repo");
		const nestedWorkspace = join(repoRoot, "apps", "wingman");
		mkdirSync(join(repoRoot, ".git"), { recursive: true });
		mkdirSync(join(nestedWorkspace, ".wingman"), { recursive: true });
		writeFileSync(
			join(nestedWorkspace, ".wingman", "wingman.config.json"),
			JSON.stringify({ logLevel: "info" }),
		);

		const resolved = resolveWorkspaceRoot(repoRoot);

		expect(resolved).toBe(nestedWorkspace);
	});

	it("falls back to nested apps/wingman workspace from sibling app directory", () => {
		const repoRoot = join(sandbox, "repo");
		const startDir = join(repoRoot, "apps", "docs-website");
		const nestedWorkspace = join(repoRoot, "apps", "wingman");
		mkdirSync(join(repoRoot, ".git"), { recursive: true });
		mkdirSync(startDir, { recursive: true });
		mkdirSync(join(nestedWorkspace, ".wingman"), { recursive: true });
		writeFileSync(
			join(nestedWorkspace, ".wingman", "wingman.config.json"),
			JSON.stringify({ logLevel: "info" }),
		);

		const resolved = resolveWorkspaceRoot(startDir);

		expect(resolved).toBe(nestedWorkspace);
	});
});
