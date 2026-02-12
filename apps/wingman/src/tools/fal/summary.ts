import { homedir } from "node:os";
import { basename, isAbsolute, relative } from "node:path";

export type FalSummaryMedia = {
	modality: "image" | "audio" | "video" | "file";
	path?: string | null;
	remoteUrl?: string | null;
	mimeType?: string | null;
};

export interface FalSummaryInput {
	toolName: string;
	jobId: string;
	status: string;
	modelId: string;
	reviewState?: "pending" | "accepted" | "denied" | null;
	media?: FalSummaryMedia[];
	error?: string | null;
	cwd?: string;
	homeDir?: string;
}

export function buildFalGenerationSummary(input: FalSummaryInput): string {
	const media = input.media || [];
	const lines = [
		`FAL job \`${input.jobId}\` for \`${input.toolName}\` is **${input.status.toLowerCase()}**.`,
		`- Model: \`${input.modelId}\``,
		`- Assets: ${media.length}`,
	];

	if (input.reviewState === "pending") {
		lines.push(
			"- Review required: call `fal_generation_status` with `action` set to `accept` or `deny`.",
		);
	}

	if (media.length > 0) {
		lines.push("- Files:");
		for (const item of media) {
			const localPath =
				typeof item.path === "string" && item.path.trim()
					? formatFalPath(item.path, { cwd: input.cwd, homeDir: input.homeDir })
					: null;
			const target = localPath || item.remoteUrl || "(unavailable)";
			const mime = item.mimeType ? ` ${item.mimeType}` : "";
			lines.push(`  - [${item.modality}] ${target}${mime}`);
		}
	}

	if (input.error?.trim()) {
		lines.push("", `Error: ${input.error.trim()}`);
	}

	return lines.join("\n");
}

export function formatFalPath(
	pathname: string,
	options?: {
		cwd?: string;
		homeDir?: string;
	},
): string {
	const trimmed = pathname.trim();
	if (!trimmed) return pathname;

	const cwd = options?.cwd || process.cwd();
	const homeDir = options?.homeDir || process.env.HOME || homedir();

	if (cwd) {
		const rel = relative(cwd, trimmed);
		if (rel && rel !== "." && !rel.startsWith("..") && !isAbsolute(rel)) {
			return `./${rel}`;
		}
	}

	if (homeDir && trimmed.startsWith(homeDir)) {
		const suffix = trimmed.slice(homeDir.length).replace(/^[/\\]+/, "");
		return suffix ? `~/${suffix}` : "~";
	}

	return basename(trimmed) === trimmed ? `./${trimmed}` : trimmed;
}
