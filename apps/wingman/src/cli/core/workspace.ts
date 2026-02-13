import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

const DEFAULT_CONFIG_DIR = ".wingman";
const WORKSPACE_MARKERS = ["wingman.config.json", "agents"];

export function resolveWorkspaceRoot(
	cwd: string = process.cwd(),
	explicitWorkspace?: string,
	configDir = DEFAULT_CONFIG_DIR,
): string {
	if (typeof explicitWorkspace === "string" && explicitWorkspace.trim()) {
		return resolve(cwd, explicitWorkspace.trim());
	}

	const startDir = resolve(cwd);
	const gitRoot = findGitRoot(startDir);
	const homeDir = resolve(homedir());
	let current = startDir;

	while (true) {
		if (hasWorkspaceMarker(current, configDir)) {
			return current;
		}

		if (gitRoot && current === gitRoot) {
			break;
		}

		const parent = dirname(current);
		if (parent === current) {
			break;
		}

		// Avoid accidentally binding every project under $HOME to ~/.wingman.
		if (parent === homeDir && startDir !== homeDir) {
			break;
		}

		current = parent;
	}

	const nestedWorkspace = findNestedWorkspaceRoot(startDir, configDir);
	if (nestedWorkspace) {
		return nestedWorkspace;
	}

	return startDir;
}

function hasWorkspaceMarker(dir: string, configDir: string): boolean {
	return WORKSPACE_MARKERS.some((marker) =>
		existsSync(join(dir, configDir, marker)),
	);
}

function findGitRoot(startDir: string): string | null {
	let current = resolve(startDir);

	while (true) {
		if (existsSync(join(current, ".git"))) {
			return current;
		}

		const parent = dirname(current);
		if (parent === current) {
			return null;
		}

		current = parent;
	}
}

function findNestedWorkspaceRoot(
	startDir: string,
	configDir: string,
): string | null {
	// Dev-mono fallback: allow running from repo root or sibling apps while workspace lives in apps/wingman.
	const homeDir = resolve(homedir());
	let current = resolve(startDir);

	while (true) {
		const candidates = [join(current, "apps", "wingman"), join(current, "wingman")];
		for (const candidate of candidates) {
			if (existsSync(join(candidate, configDir, "wingman.config.json"))) {
				return candidate;
			}
		}

		const parent = dirname(current);
		if (parent === current) {
			break;
		}
		if (parent === homeDir && startDir !== homeDir) {
			break;
		}

		current = parent;
	}

	return null;
}
