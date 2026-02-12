import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	resolveAgentMemorySources,
	OUTPUT_VIRTUAL_PATH,
	resolveAgentExecutionWorkspace,
	resolveExecutionWorkspace,
	resolveExternalOutputMount,
	toWorkspaceAliasVirtualPath,
	WORKDIR_VIRTUAL_PATH,
} from "../cli/core/agentInvoker.js";

describe("resolveExternalOutputMount", () => {
	const workspace = path.resolve("workspace");

	it("mounts external workdir paths", () => {
		const workdir = path.resolve("outside", "session-output");
		const mount = resolveExternalOutputMount(workspace, workdir, null);
		expect(mount).toEqual({
			virtualPath: WORKDIR_VIRTUAL_PATH,
			absolutePath: workdir,
		});
	});

	it("does not mount workdir when it is inside workspace", () => {
		const workdir = path.join(workspace, "outputs");
		const mount = resolveExternalOutputMount(workspace, workdir, null);
		expect(mount).toEqual({
			virtualPath: null,
			absolutePath: null,
		});
	});

	it("mounts external default output when no workdir is set", () => {
		const defaultOutputDir = path.resolve("external-default-output");
		const mount = resolveExternalOutputMount(
			workspace,
			null,
			defaultOutputDir,
		);
		expect(mount).toEqual({
			virtualPath: OUTPUT_VIRTUAL_PATH,
			absolutePath: defaultOutputDir,
		});
	});

	it("prefers workdir mount over default output mount", () => {
		const workdir = path.resolve("outside", "session-output");
		const defaultOutputDir = path.resolve("external-default-output");
		const mount = resolveExternalOutputMount(
			workspace,
			workdir,
			defaultOutputDir,
		);
		expect(mount).toEqual({
			virtualPath: WORKDIR_VIRTUAL_PATH,
			absolutePath: workdir,
		});
	});

	it("does not request an extra external mount when workdir is execution workspace", () => {
		const executionWorkspace = path.resolve("outside", "session-output");
		const mount = resolveExternalOutputMount(
			executionWorkspace,
			executionWorkspace,
			path.resolve("external-default-output"),
		);
		expect(mount).toEqual({
			virtualPath: null,
			absolutePath: null,
		});
	});
});

describe("resolveExecutionWorkspace", () => {
	const workspace = path.resolve("workspace");

	it("uses workspace when workdir is not set", () => {
		expect(resolveExecutionWorkspace(workspace, null)).toBe(path.normalize(workspace));
	});

	it("resolves relative workdir from workspace", () => {
		const resolved = resolveExecutionWorkspace(workspace, "outputs/session");
		expect(resolved).toBe(path.normalize(path.join(workspace, "outputs/session")));
	});

	it("uses absolute workdir directly", () => {
		const absolute = path.resolve("outside", "session-output");
		expect(resolveExecutionWorkspace(workspace, absolute)).toBe(path.normalize(absolute));
	});
});

describe("resolveAgentExecutionWorkspace", () => {
	const workspace = path.resolve("workspace");

	it("prefers explicit workdir over default output dir", () => {
		const workdir = path.resolve("outside", "session-output");
		const defaultOutputDir = path.resolve("outside", "default-output");
		expect(
			resolveAgentExecutionWorkspace(workspace, workdir, defaultOutputDir),
		).toBe(path.normalize(workdir));
	});

	it("uses default output dir when session workdir is unset", () => {
		const defaultOutputDir = path.resolve("outside", "default-output");
		expect(
			resolveAgentExecutionWorkspace(workspace, null, defaultOutputDir),
		).toBe(path.normalize(defaultOutputDir));
	});

	it("falls back to workspace when neither workdir nor default output dir exist", () => {
		expect(resolveAgentExecutionWorkspace(workspace, null, null)).toBe(
			path.normalize(workspace),
		);
	});
});

describe("toWorkspaceAliasVirtualPath", () => {
	it("builds an alias path for absolute workspaces", () => {
		const absolute = path.resolve("outside", "session-output");
		const alias = toWorkspaceAliasVirtualPath(absolute);
		const expected = `/${absolute.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "")}/`;
		expect(alias).toBe(expected);
	});

	it("returns null for non-absolute workspace paths", () => {
		expect(toWorkspaceAliasVirtualPath("relative/workspace")).toBeNull();
	});
});

describe("resolveAgentMemorySources", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const dir of tempDirs) {
			rmSync(dir, { recursive: true, force: true });
		}
		tempDirs.length = 0;
	});

	it("returns /AGENTS.md when present in execution workspace", () => {
		const workspace = mkdtempSync(path.join(tmpdir(), "wingman-memory-"));
		tempDirs.push(workspace);
		writeFileSync(path.join(workspace, "AGENTS.md"), "# Agent Memory");

		expect(resolveAgentMemorySources(workspace)).toEqual(["/AGENTS.md"]);
	});

	it("returns no sources when AGENTS.md is absent", () => {
		const workspace = mkdtempSync(path.join(tmpdir(), "wingman-memory-"));
		tempDirs.push(workspace);

		expect(resolveAgentMemorySources(workspace)).toEqual([]);
	});

	it("ignores .deepagents/AGENTS.md when top-level AGENTS.md is missing", () => {
		const workspace = mkdtempSync(path.join(tmpdir(), "wingman-memory-"));
		tempDirs.push(workspace);
		const deepagentsDir = path.join(workspace, ".deepagents");
		mkdirSync(deepagentsDir, { recursive: true });
		writeFileSync(path.join(deepagentsDir, "AGENTS.md"), "# Nested Memory");

		expect(resolveAgentMemorySources(workspace)).toEqual([]);
	});
});
