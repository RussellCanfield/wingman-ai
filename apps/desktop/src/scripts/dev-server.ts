import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";

const APP_ROOT = join(import.meta.dir, "..", "..");
const PORT = 1420;
const transpiler = new Bun.Transpiler({
	loader: "ts",
	target: "browser",
});

function resolvePath(pathname: string): string {
	const withoutQuery = pathname.split("?")[0] || "/";
	const safe = normalize(withoutQuery).replace(/^(\.\.(\/|\\|$))+/, "");
	if (safe === "/" || safe === "\\") {
		return join(APP_ROOT, "index.html");
	}

	let target = join(APP_ROOT, safe);

	// Allow browser imports to use .js while source lives as .ts.
	if (safe.startsWith("/src/") && safe.endsWith(".js") && !existsSync(target)) {
		target = join(APP_ROOT, safe.replace(/\.js$/, ".ts"));
	}

	return target;
}

function contentTypeFor(path: string): string {
	const ext = extname(path);
	switch (ext) {
		case ".html":
			return "text/html; charset=utf-8";
		case ".css":
			return "text/css; charset=utf-8";
		case ".js":
			return "application/javascript; charset=utf-8";
		case ".json":
			return "application/json; charset=utf-8";
		default:
			return "text/plain; charset=utf-8";
	}
}

const server = Bun.serve({
	port: PORT,
	async fetch(request) {
		const url = new URL(request.url);
		const target = resolvePath(url.pathname);
		const file = Bun.file(target);

		if (!(await file.exists())) {
			return new Response("Not found", { status: 404 });
		}

		if (target.endsWith(".ts")) {
			const source = await file.text();
			const transformed = transpiler.transformSync(source);
			return new Response(transformed, {
				headers: {
					"content-type": "application/javascript; charset=utf-8",
				},
			});
		}

		return new Response(file, {
			headers: {
				"content-type": contentTypeFor(target),
			},
		});
	},
});

console.log(`Wingman desktop web shell: http://127.0.0.1:${server.port}`);
