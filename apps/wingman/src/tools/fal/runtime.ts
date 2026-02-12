import { homedir } from "node:os";
import { isAbsolute, join, normalize, resolve } from "node:path";

const DEFAULT_STATE_SUBPATH = [".wingman", "fal-ai"] as const;
const DEFAULT_OUTPUT_SUBPATH = ["generated"] as const;

type RuntimePathOptions = {
	env?: NodeJS.ProcessEnv;
	cwd?: string;
	homeDir?: string;
};

function normalizeHomePath(pathname: string, homeDir: string): string {
	if (pathname === "~") return homeDir;
	if (pathname.startsWith("~/")) {
		return join(homeDir, pathname.slice(2));
	}
	return pathname;
}

function normalizeFromBase(pathname: string, baseDir: string): string {
	return isAbsolute(pathname)
		? normalize(pathname)
		: normalize(resolve(baseDir, pathname));
}

export function resolveFalWorkdir(options?: RuntimePathOptions): string {
	const env = options?.env || process.env;
	const cwd = options?.cwd || process.cwd();
	const homeDir = options?.homeDir || homedir();

	const raw = env.WINGMAN_WORKDIR?.trim();
	if (!raw) return normalize(cwd);

	const withHome = normalizeHomePath(raw, homeDir);
	return normalizeFromBase(withHome, cwd);
}

export function resolveFalStateDir(options?: RuntimePathOptions): string {
	const env = options?.env || process.env;
	const explicit = env.FAL_MCP_STATE_DIR?.trim();
	if (explicit) {
		const cwd = options?.cwd || process.cwd();
		const homeDir = options?.homeDir || homedir();
		const withHome = normalizeHomePath(explicit, homeDir);
		return normalizeFromBase(withHome, cwd);
	}
	const workdir = resolveFalWorkdir(options);
	return join(workdir, ...DEFAULT_STATE_SUBPATH);
}

export function resolveFalOutputDir(options?: RuntimePathOptions): string {
	const env = options?.env || process.env;
	const explicit = env.FAL_MCP_OUTPUT_DIR?.trim();
	if (explicit) {
		const cwd = options?.cwd || process.cwd();
		const homeDir = options?.homeDir || homedir();
		const withHome = normalizeHomePath(explicit, homeDir);
		const workdir = resolveFalWorkdir(options);
		return normalizeFromBase(withHome, workdir || cwd);
	}
	const workdir = resolveFalWorkdir(options);
	return join(workdir, ...DEFAULT_OUTPUT_SUBPATH);
}

export function resolveFalLocalMediaPath(
	pathname: string,
	workdir: string,
	options?: Pick<RuntimePathOptions, "cwd" | "homeDir">,
): string {
	const cwd = options?.cwd || process.cwd();
	const homeDir = options?.homeDir || homedir();
	const trimmed = pathname.trim();
	const withHome = normalizeHomePath(trimmed, homeDir);
	if (isAbsolute(withHome)) return normalize(withHome);
	return normalize(resolve(workdir || cwd, withHome));
}
