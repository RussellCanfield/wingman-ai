import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, normalize } from "node:path";
import type { GatewayHttpContext } from "./types.js";

export const handleFsApi = async (
	ctx: GatewayHttpContext,
	req: Request,
	url: URL,
): Promise<Response | null> => {
	if (url.pathname === "/api/fs/roots" && req.method === "GET") {
		const roots = ctx.resolveFsRoots();
		return new Response(JSON.stringify({ roots }, null, 2), {
			headers: { "Content-Type": "application/json" },
		});
	}

	if (url.pathname === "/api/fs/list" && req.method === "GET") {
		const rawPath = url.searchParams.get("path");
		if (!rawPath) {
			return new Response("path required", { status: 400 });
		}
		const resolved = ctx.resolveFsPath(rawPath);
		const roots = ctx.resolveFsRoots();
		if (!ctx.isPathWithinRoots(resolved, roots)) {
			return new Response("path not allowed", { status: 403 });
		}
		if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
			return new Response("path not found", { status: 404 });
		}

		const entries = readdirSync(resolved, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => ({
				name: entry.name,
				path: join(resolved, entry.name),
			}))
			.sort((a, b) => a.name.localeCompare(b.name));

		const parent = normalize(join(resolved, ".."));
		const parentAllowed =
			parent !== resolved && ctx.isPathWithinRoots(parent, roots)
				? parent
				: null;

		return new Response(
			JSON.stringify(
				{
					path: resolved,
					parent: parentAllowed,
					entries,
				},
				null,
				2,
			),
			{
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	if (url.pathname === "/api/fs/mkdir" && req.method === "POST") {
		let payload: { path?: string; name?: string } | null = null;
		try {
			payload = (await req.json()) as { path?: string; name?: string };
		} catch {
			return new Response("invalid body", { status: 400 });
		}

		const rawPath =
			typeof payload?.path === "string" ? payload.path.trim() : "";
		if (!rawPath) {
			return new Response("path required", { status: 400 });
		}

		const name = typeof payload?.name === "string" ? payload.name.trim() : "";
		if (!name) {
			return new Response("name required", { status: 400 });
		}
		if (!isValidFolderName(name)) {
			return new Response("invalid folder name", { status: 400 });
		}

		const parentPath = ctx.resolveFsPath(rawPath);
		const roots = ctx.resolveFsRoots();
		if (!ctx.isPathWithinRoots(parentPath, roots)) {
			return new Response("path not allowed", { status: 403 });
		}
		if (!existsSync(parentPath) || !statSync(parentPath).isDirectory()) {
			return new Response("path not found", { status: 404 });
		}

		const nextPath = normalize(join(parentPath, name));
		if (!ctx.isPathWithinRoots(nextPath, roots)) {
			return new Response("path not allowed", { status: 403 });
		}
		if (existsSync(nextPath)) {
			return new Response("path already exists", { status: 409 });
		}

		try {
			mkdirSync(nextPath, { recursive: false });
		} catch {
			return new Response("unable to create folder", { status: 500 });
		}

		return new Response(JSON.stringify({ path: nextPath }, null, 2), {
			headers: { "Content-Type": "application/json" },
		});
	}

	if (url.pathname === "/api/fs/file" && req.method === "GET") {
		const rawPath = url.searchParams.get("path");
		if (!rawPath) {
			return new Response("path required", { status: 400 });
		}
		const resolved = ctx.resolveFsPath(rawPath);
		const roots = ctx.resolveFsRoots();
		if (!ctx.isPathWithinRoots(resolved, roots)) {
			return new Response("path not allowed", { status: 403 });
		}
		if (!existsSync(resolved) || !statSync(resolved).isFile()) {
			return new Response("path not found", { status: 404 });
		}

		return new Response(Bun.file(resolved), {
			headers: {
				"Cache-Control": "no-store",
			},
		});
	}

	return null;
};

const isValidFolderName = (name: string): boolean => {
	if (!name || name === "." || name === "..") {
		return false;
	}
	if (name.includes("/") || name.includes("\\")) {
		return false;
	}
	return true;
};
