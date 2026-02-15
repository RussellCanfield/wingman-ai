import { spawnSync } from "node:child_process";
import { basename } from "node:path";

function normalizeCommandName(command: string): string {
	return basename(command).toLowerCase().replace(/\.exe$/, "");
}

export function commandRequiresUv(command: string): boolean {
	const normalized = normalizeCommandName(command.trim());
	return normalized === "uv" || normalized === "uvx";
}

export function isUvAvailable(): boolean {
	const result = spawnSync("uv", ["--version"], {
		stdio: "ignore",
	});
	if (typeof result.status === "number") {
		return result.status === 0;
	}
	return !result.error;
}

export function ensureUvAvailableForFeature(
	command: string,
	featureName: string,
): void {
	if (!commandRequiresUv(command)) {
		return;
	}
	if (isUvAvailable()) {
		return;
	}
	throw new Error(
		`Feature "${featureName}" requires uv, but it was not found on PATH. Install uv (https://docs.astral.sh/uv/) or disable the feature.`,
	);
}
