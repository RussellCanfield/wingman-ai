import type { GatewayHttpContext } from "./types.js";
import { existsSync, statSync, readdirSync } from "node:fs";
import { join, normalize } from "node:path";

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
			parent !== resolved && ctx.isPathWithinRoots(parent, roots) ? parent : null;

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
