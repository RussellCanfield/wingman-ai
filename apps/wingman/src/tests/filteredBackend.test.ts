import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FilesystemBackend } from "deepagents";
import { afterEach, describe, expect, it } from "vitest";
import {
	BLOCKED_BACKEND_PATH_MESSAGE,
	createFilteredBackend,
	pathUsesHiddenSegment,
} from "../agent/backend/filtered-backend.js";

const tempRoots: string[] = [];

const createTestBackend = () => {
	const rootDir = mkdtempSync(join(tmpdir(), "wingman-filtered-backend-"));
	tempRoots.push(rootDir);

	mkdirSync(join(rootDir, "conversation_history"), { recursive: true });
	mkdirSync(join(rootDir, "notes"), { recursive: true });
	mkdirSync(join(rootDir, "conversation_history_extra"), { recursive: true });

	writeFileSync(
		join(rootDir, "conversation_history", "session.md"),
		"internal archive line\n",
	);
	writeFileSync(join(rootDir, "notes", "keep.md"), "keep this result\n");
	writeFileSync(
		join(rootDir, "conversation_history_extra", "keep.md"),
		"keep this folder visible\n",
	);

	return createFilteredBackend(
		new FilesystemBackend({
			rootDir,
			virtualMode: true,
		}),
	);
};

afterEach(() => {
	for (const rootDir of tempRoots.splice(0)) {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

describe("createFilteredBackend", () => {
	it("hides conversation history paths from listings and glob results", async () => {
		const backend = createTestBackend();

		const rootEntries = await backend.lsInfo("/");
		expect(rootEntries.some((entry) => entry.path.includes("notes"))).toBe(
			true,
		);
		expect(
			rootEntries.some((entry) => entry.path.includes("conversation_history/")),
		).toBe(false);
		expect(
			rootEntries.some((entry) =>
				entry.path.includes("conversation_history_extra"),
			),
		).toBe(true);

		const markdownFiles = await backend.globInfo("**/*.md", "/");
		expect(
			markdownFiles.some((entry) =>
				entry.path.includes("conversation_history/"),
			),
		).toBe(false);
		expect(
			markdownFiles.some((entry) => entry.path.includes("notes/keep.md")),
		).toBe(true);
	});

	it("blocks direct reads and writes into conversation history", async () => {
		const backend = createTestBackend();

		await expect(
			backend.read("/conversation_history/session.md"),
		).resolves.toBe(BLOCKED_BACKEND_PATH_MESSAGE);
		await expect(
			backend.write("/conversation_history/new.md", "blocked"),
		).resolves.toMatchObject({
			error: BLOCKED_BACKEND_PATH_MESSAGE,
			path: "/conversation_history/new.md",
		});
		await expect(
			backend.edit("/conversation_history/session.md", "internal", "changed"),
		).resolves.toMatchObject({
			error: BLOCKED_BACKEND_PATH_MESSAGE,
			path: "/conversation_history/session.md",
		});
	});

	it("filters grep matches that originate from hidden archive paths", async () => {
		const backend = createTestBackend();
		const result = await backend.grepRaw("keep", "/");

		expect(typeof result).not.toBe("string");
		expect(result).toEqual([
			expect.objectContaining({
				path: "/notes/keep.md",
			}),
			expect.objectContaining({
				path: "/conversation_history_extra/keep.md",
			}),
		]);
	});
});

describe("pathUsesHiddenSegment", () => {
	it("matches exact hidden path segments only", () => {
		expect(pathUsesHiddenSegment("/conversation_history/session.md")).toBe(
			true,
		);
		expect(pathUsesHiddenSegment("/nested/conversation_history/item.md")).toBe(
			true,
		);
		expect(pathUsesHiddenSegment("/conversation_history_extra/item.md")).toBe(
			false,
		);
	});
});
