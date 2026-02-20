import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runCommand } from "./process.js";
import type {
	AdapterInvocationResult,
	TaskRunContext,
	TaskValidatorResult,
} from "./types.js";

function includesAll(haystack: string, needles: string[]): string[] {
	const missing: string[] = [];
	for (const needle of needles) {
		if (!haystack.includes(needle)) {
			missing.push(needle);
		}
	}
	return missing;
}

export async function runTaskValidator(
	context: TaskRunContext,
	adapterResult: AdapterInvocationResult,
): Promise<TaskValidatorResult> {
	const validator = context.task.validator;

	if (validator.type === "assistant_contains") {
		const missing = includesAll(
			adapterResult.assistantText,
			validator.includes,
		);
		if (missing.length === 0) {
			return {
				passed: true,
				details: "Assistant response contains all required strings.",
			};
		}
		return {
			passed: false,
			details: `Missing assistant substrings: ${missing.join(", ")}`,
		};
	}

	if (validator.type === "file_contains") {
		const filePath = resolve(context.workingDirectory, validator.path);
		try {
			const content = await readFile(filePath, "utf-8");
			const missing = includesAll(content, validator.includes);
			if (missing.length === 0) {
				return {
					passed: true,
					details: `File ${validator.path} contains all required strings.`,
				};
			}
			return {
				passed: false,
				details: `File ${validator.path} missing: ${missing.join(", ")}`,
			};
		} catch (error) {
			return {
				passed: false,
				details: `Unable to read ${validator.path}: ${error instanceof Error ? error.message : String(error)}`,
			};
		}
	}

	const run = await runCommand(
		validator.command.command,
		validator.command.args || [],
		{
			cwd: context.workingDirectory,
			timeoutMs: context.timeoutMs,
			shell: validator.command.shell,
			env: validator.command.env,
		},
	);
	const expectedExitCode = validator.expectedExitCode ?? 0;
	if (run.exitCode === expectedExitCode) {
		return {
			passed: true,
			details: `Validator command exit code matched ${expectedExitCode}.`,
		};
	}

	return {
		passed: false,
		details: `Validator command exit code ${run.exitCode} did not match ${expectedExitCode}. stderr: ${run.stderr.trim()}`,
	};
}
