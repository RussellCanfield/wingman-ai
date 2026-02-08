import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const APP_ROOT = join(import.meta.dir, "..", "..");
const SRC_DIR = join(APP_ROOT, "src");
const DIST_DIR = join(APP_ROOT, "dist");
const transpiler = new Bun.Transpiler({
	loader: "ts",
	target: "browser",
});

function walk(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const fullPath = join(directory, entry.name);
		if (entry.isDirectory()) {
			return walk(fullPath);
		}
		return [fullPath];
	});
}

function writeDistFile(relativePath: string, content: string): void {
	const destination = join(DIST_DIR, relativePath);
	mkdirSync(dirname(destination), { recursive: true });
	writeFileSync(destination, content);
}

rmSync(DIST_DIR, { recursive: true, force: true });
mkdirSync(DIST_DIR, { recursive: true });

const sourceFiles = walk(SRC_DIR).filter((path) => {
	return !path.endsWith(".test.ts") && !path.includes(`${join("src", "scripts")}`);
});

for (const sourceFile of sourceFiles) {
	const rel = relative(SRC_DIR, sourceFile);
	if (sourceFile.endsWith(".ts")) {
		const source = readFileSync(sourceFile, "utf8");
		const transformed = transpiler.transformSync(source);
		writeDistFile(rel.replace(/\.ts$/, ".js"), transformed);
		continue;
	}
	if (sourceFile.endsWith(".css")) {
		writeDistFile(rel, readFileSync(sourceFile, "utf8"));
	}
}

function normalizeHtml(source: string): string {
	return source
		.replaceAll("/src/main.js", "./src/main.js")
		.replaceAll("/src/styles.css", "./src/styles.css");
}

const indexHtml = normalizeHtml(readFileSync(join(APP_ROOT, "index.html"), "utf8"));
const overlayHtml = normalizeHtml(readFileSync(join(APP_ROOT, "overlay.html"), "utf8"));

writeDistFile("index.html", indexHtml);
writeDistFile("overlay.html", overlayHtml);

console.log("Built Wingman desktop web shell into dist/");
