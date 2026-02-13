import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, normalize } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleFsApi } from "../gateway/http/fs.js";
import type { GatewayHttpContext } from "../gateway/http/types.js";

describe("fs API", () => {
	let rootDir: string;
	let extraDir: string | null;

	beforeEach(() => {
		rootDir = mkdtempSync(join(tmpdir(), "wingman-fs-api-"));
		extraDir = null;
	});

	afterEach(() => {
		rmSync(rootDir, { recursive: true, force: true });
		if (extraDir) {
			rmSync(extraDir, { recursive: true, force: true });
		}
	});

	const createCtx = (): Pick<
		GatewayHttpContext,
		"resolveFsRoots" | "resolveFsPath" | "isPathWithinRoots"
	> => ({
		resolveFsRoots: () => [rootDir],
		resolveFsPath: (path: string) => normalize(path),
		isPathWithinRoots: (targetPath: string, roots: string[]) => {
			const resolved = normalize(targetPath);
			return roots.some((root) => {
				const normalizedRoot = normalize(root);
				return (
					resolved === normalizedRoot ||
					resolved.startsWith(`${normalizedRoot}/`) ||
					resolved.startsWith(`${normalizedRoot}\\`)
				);
			});
		},
	});

	it("creates a folder inside allowed roots", async () => {
		const parent = join(rootDir, "parent");
		mkdirSync(parent, { recursive: true });

		const req = new Request("http://localhost/api/fs/mkdir", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path: parent, name: "new-folder" }),
		});
		const res = await handleFsApi(
			createCtx() as GatewayHttpContext,
			req,
			new URL(req.url),
		);

		expect(res).not.toBeNull();
		expect(res?.ok).toBe(true);
		const payload = (await res?.json()) as { path: string };
		expect(payload.path).toBe(normalize(join(parent, "new-folder")));
		expect(existsSync(payload.path)).toBe(true);
	});

	it("rejects invalid folder names", async () => {
		const parent = join(rootDir, "parent");
		mkdirSync(parent, { recursive: true });

		const req = new Request("http://localhost/api/fs/mkdir", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path: parent, name: "bad/name" }),
		});
		const res = await handleFsApi(
			createCtx() as GatewayHttpContext,
			req,
			new URL(req.url),
		);

		expect(res).not.toBeNull();
		expect(res?.status).toBe(400);
		expect(await res?.text()).toBe("invalid folder name");
	});

	it("rejects paths outside allowed roots", async () => {
		extraDir = mkdtempSync(join(tmpdir(), "wingman-fs-outside-"));

		const req = new Request("http://localhost/api/fs/mkdir", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path: extraDir, name: "new-folder" }),
		});
		const res = await handleFsApi(
			createCtx() as GatewayHttpContext,
			req,
			new URL(req.url),
		);

		expect(res).not.toBeNull();
		expect(res?.status).toBe(403);
		expect(await res?.text()).toBe("path not allowed");
	});

	it("returns 409 when the target folder already exists", async () => {
		const parent = join(rootDir, "parent");
		const existing = join(parent, "existing");
		mkdirSync(existing, { recursive: true });

		const req = new Request("http://localhost/api/fs/mkdir", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path: parent, name: "existing" }),
		});
		const res = await handleFsApi(
			createCtx() as GatewayHttpContext,
			req,
			new URL(req.url),
		);

		expect(res).not.toBeNull();
		expect(res?.status).toBe(409);
		expect(await res?.text()).toBe("path already exists");
	});

	it("rejects non-string path and folder name values", async () => {
		const req = new Request("http://localhost/api/fs/mkdir", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path: 123, name: 456 }),
		});
		const res = await handleFsApi(
			createCtx() as GatewayHttpContext,
			req,
			new URL(req.url),
		);

		expect(res).not.toBeNull();
		expect(res?.status).toBe(400);
		expect(await res?.text()).toBe("path required");
	});
});
