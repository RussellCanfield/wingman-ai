import { stat, readFile } from "node:fs/promises";
import { isAbsolute, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export type UiRegistryComponent = {
	label?: string;
	description?: string;
	tags?: string[];
	useCases?: string[];
	propsSchema?: Record<string, unknown>;
	exampleRef?: string;
};

export type UiRegistry = {
	version: number;
	components: Record<string, UiRegistryComponent>;
};

type RegistryCacheEntry = {
	mtimeMs: number;
	registry: UiRegistry;
};

const registryCache = new Map<string, RegistryCacheEntry>();

export type UiRegistryResolution = {
	path: string;
	source: "workspace" | "bundled";
};

export function getUiRegistryPath(
	workspace: string,
	skillsDirectory: string,
): string {
	return join(workspace, skillsDirectory, "ui-registry", "registry.json");
}

export function getBundledSkillsPath(): string {
	const here = fileURLToPath(import.meta.url);
	return join(dirname(here), "../../skills");
}

export function getBundledRegistryPath(): string {
	return join(getBundledSkillsPath(), "ui-registry", "registry.json");
}

export function getExpectedRegistryPaths(
	workspace: string,
	skillsDirectory: string,
): { workspacePath: string; bundledPath: string } {
	return {
		workspacePath: getUiRegistryPath(workspace, skillsDirectory),
		bundledPath: getBundledRegistryPath(),
	};
}

export async function resolveUiRegistryPath(
	workspace: string,
	skillsDirectory: string,
): Promise<UiRegistryResolution | null> {
	const { workspacePath, bundledPath } = getExpectedRegistryPaths(
		workspace,
		skillsDirectory,
	);
	if (await fileExists(workspacePath)) {
		return { path: workspacePath, source: "workspace" };
	}
	if (await fileExists(bundledPath)) {
		return { path: bundledPath, source: "bundled" };
	}
	return null;
}

export async function loadUiRegistry(
	registryPath: string,
): Promise<UiRegistry | null> {
	try {
		const stats = await stat(registryPath);
		const cached = registryCache.get(registryPath);
		if (cached && cached.mtimeMs === stats.mtimeMs) {
			return cached.registry;
		}
		const raw = await readFile(registryPath, "utf-8");
		const parsed = JSON.parse(raw) as UiRegistry;
		if (!isUiRegistry(parsed)) return null;
		registryCache.set(registryPath, {
			mtimeMs: stats.mtimeMs,
			registry: parsed,
		});
		return parsed;
	} catch {
		return null;
	}
}

export async function loadUiRegistryExample(
	registryPath: string,
	exampleRef?: string,
): Promise<string | undefined> {
	if (!exampleRef) return undefined;
	const baseDir = dirname(registryPath);
	const examplePath = isAbsolute(exampleRef)
		? exampleRef
		: join(baseDir, exampleRef);
	try {
		return await readFile(examplePath, "utf-8");
	} catch {
		return undefined;
	}
}

export function summarizeUiRegistry(
	registry: UiRegistry,
	maxEntries = 6,
): string[] {
	const entries = Object.entries(registry.components || {});
	if (entries.length === 0) return [];
	return entries.slice(0, maxEntries).map(([id, component]) => {
		const label = component.label ? ` (${component.label})` : "";
		const desc = component.description ? `: ${component.description}` : "";
		return `- ${id}${label}${desc}`;
	});
}

function isUiRegistry(value: unknown): value is UiRegistry {
	if (!value || typeof value !== "object") return false;
	const record = value as UiRegistry;
	if (typeof record.version !== "number") return false;
	if (!record.components || typeof record.components !== "object") return false;
	return true;
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}
