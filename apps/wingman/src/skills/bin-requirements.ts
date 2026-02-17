import { spawnSync } from "node:child_process";

const SAFE_BIN_REGEX = /^[A-Za-z0-9._-]+$/;

export type BinAvailabilityChecker = (binName: string) => boolean;

export const isBinAvailable: BinAvailabilityChecker = (binName) => {
	const normalized = binName.trim();
	if (!normalized || !SAFE_BIN_REGEX.test(normalized)) {
		return false;
	}

	const lookupCommand = process.platform === "win32" ? "where" : "which";
	const result = spawnSync(lookupCommand, [normalized], {
		stdio: "ignore",
	});
	return result.status === 0;
};

export const findMissingBins = (
	bins: string[],
	checkBin: BinAvailabilityChecker = isBinAvailable,
): string[] => {
	const seen = new Set<string>();
	const missing: string[] = [];

	for (const bin of bins) {
		const normalized = bin.trim();
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		if (!checkBin(normalized)) {
			missing.push(normalized);
		}
	}

	return missing;
};
