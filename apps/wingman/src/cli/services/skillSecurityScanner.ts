import { spawn } from "node:child_process";
import type { Logger } from "@/logger.js";
import { ensureUvAvailableForFeature } from "@/utils/uv.js";
import type { SkillSecurityOptions } from "../types/skill.js";

const DEFAULT_SCANNER_COMMAND = "uvx";
const DEFAULT_SCANNER_ARGS = [
	"--from",
	"mcp-scan>=0.4,<0.5",
	"mcp-scan",
	"--json",
	"--skills",
];
const DEFAULT_BLOCKED_CODES = [
	"MCP501",
	"MCP506",
	"MCP507",
	"MCP508",
	"MCP509",
	"MCP510",
	"MCP511",
];

type ScanIssue = {
	code?: string;
	message?: string;
};

type ScanError = {
	message?: string;
	is_failure?: boolean;
	category?: string;
};

type ScanPathResult = {
	issues?: ScanIssue[];
	error?: ScanError | null;
};

type ScanResultMap = Record<string, ScanPathResult>;

type CommandResult = {
	exitCode: number | null;
	stdout: string;
	stderr: string;
};

function getScannerCommand(security?: SkillSecurityOptions): string {
	return security?.scannerCommand?.trim() || DEFAULT_SCANNER_COMMAND;
}

function getScannerArgs(security?: SkillSecurityOptions): string[] {
	if (Array.isArray(security?.scannerArgs) && security.scannerArgs.length > 0) {
		return security.scannerArgs;
	}
	return DEFAULT_SCANNER_ARGS;
}

function getBlockedIssueCodes(security?: SkillSecurityOptions): Set<string> {
	const configured = security?.blockIssueCodes || DEFAULT_BLOCKED_CODES;
	return new Set(
		configured.map((code) => code.trim().toUpperCase()).filter(Boolean),
	);
}

function parseScanResult(stdout: string): ScanResultMap {
	try {
		return JSON.parse(stdout) as ScanResultMap;
	} catch {
		const firstBrace = stdout.indexOf("{");
		const lastBrace = stdout.lastIndexOf("}");
		if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
			throw new Error("Scanner output did not include JSON");
		}
		const jsonPayload = stdout.slice(firstBrace, lastBrace + 1);
		return JSON.parse(jsonPayload) as ScanResultMap;
	}
}

async function runCommand(
	command: string,
	args: string[],
): Promise<CommandResult> {
	return await new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("error", reject);
		child.on("close", (exitCode) => {
			resolve({
				exitCode,
				stdout,
				stderr,
			});
		});
	});
}

export async function scanSkillDirectory(
	skillPath: string,
	logger: Logger,
	security?: SkillSecurityOptions,
): Promise<void> {
	const scanOnInstall = security?.scanOnInstall ?? true;
	if (!scanOnInstall) {
		return;
	}

	const command = getScannerCommand(security);
	ensureUvAvailableForFeature(command, "skills.security.scanOnInstall");

	const args = [...getScannerArgs(security), skillPath];
	logger.info(`Running skill security scan: ${command} ${args.join(" ")}`);
	const result = await runCommand(command, args);
	if (result.exitCode !== 0) {
		const details = result.stderr.trim() || result.stdout.trim();
		throw new Error(
			`Skill security scan failed with exit code ${result.exitCode ?? "unknown"}${details ? `: ${details}` : ""}`,
		);
	}

	const parsed = parseScanResult(result.stdout);
	const failedPaths = Object.entries(parsed).filter(([, value]) => {
		return Boolean(value.error && value.error.is_failure !== false);
	});
	if (failedPaths.length > 0) {
		const formatted = failedPaths
			.map(([path, value]) => {
				const category = value.error?.category
					? ` (${value.error.category})`
					: "";
				return `${path}: ${value.error?.message || "unknown scan error"}${category}`;
			})
			.join("; ");
		throw new Error(`Skill security scan reported errors: ${formatted}`);
	}

	const blockedCodes = getBlockedIssueCodes(security);
	const blockingIssues: Array<{ code: string; message: string }> = [];
	const nonBlockingIssues: Array<{ code: string; message: string }> = [];

	for (const value of Object.values(parsed)) {
		for (const issue of value.issues || []) {
			const code = (issue.code || "").trim().toUpperCase();
			if (!code) {
				continue;
			}
			const issueDetails = {
				code,
				message: issue.message || "",
			};
			if (blockedCodes.has(code)) {
				blockingIssues.push(issueDetails);
			} else {
				nonBlockingIssues.push(issueDetails);
			}
		}
	}

	if (nonBlockingIssues.length > 0) {
		const codes = Array.from(new Set(nonBlockingIssues.map((issue) => issue.code)));
		logger.warn(
			`Skill security scan returned non-blocking issues: ${codes.join(", ")}`,
		);
	}

	if (blockingIssues.length > 0) {
		const codes = Array.from(new Set(blockingIssues.map((issue) => issue.code)));
		throw new Error(
			`Skill security scan blocked installation due to issue codes: ${codes.join(", ")}`,
		);
	}
}

export const __skillSecurityScanner = {
	parseScanResult,
	getScannerArgs,
	getScannerCommand,
	getBlockedIssueCodes,
};
