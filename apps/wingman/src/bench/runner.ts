import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { createAdapter } from "./adapters/index.js";
import { loadTerminalBenchConfig } from "./config.js";
import { runCommand } from "./process.js";
import { buildTerminalBenchSummary } from "./scoring.js";
import type {
	BenchCommand,
	TaskRunContext,
	TaskRunResult,
	TerminalBenchResolvedConfig,
	TerminalBenchSummary,
} from "./types.js";
import { runTaskValidator } from "./validator.js";

export interface TerminalBenchRunOptions {
	configPath: string;
}

function createRunId(now = new Date()): string {
	return now.toISOString().replace(/[:.]/g, "-");
}

function safeTaskFileName(taskId: string): string {
	return taskId.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function toIsoString(value: number): string {
	return new Date(value).toISOString();
}

async function runBenchCommand(
	command: BenchCommand,
	context: TaskRunContext,
): Promise<{ exitCode: number; stderr: string }> {
	const run = await runCommand(command.command, command.args || [], {
		cwd: context.workingDirectory,
		timeoutMs: context.timeoutMs,
		env: command.env,
		shell: command.shell,
	});
	if (!command.allowFailure && run.exitCode !== 0) {
		return { exitCode: run.exitCode, stderr: run.stderr };
	}
	return { exitCode: run.exitCode, stderr: run.stderr };
}

async function executeSetup(
	context: TaskRunContext,
): Promise<{ runCount: number; failed?: string }> {
	const setupCommands = context.task.setup || [];
	for (let i = 0; i < setupCommands.length; i += 1) {
		const run = await runBenchCommand(setupCommands[i], context);
		if (run.exitCode !== 0 && !setupCommands[i].allowFailure) {
			return {
				runCount: i + 1,
				failed: `Setup command ${i + 1} failed with exit code ${run.exitCode}: ${run.stderr.trim()}`,
			};
		}
	}
	return { runCount: setupCommands.length };
}

function resolveTaskWorkingDirectory(
	config: TerminalBenchResolvedConfig,
	workingDirectory: string | undefined,
): string {
	const baseDir = dirname(config.configPath);
	if (!workingDirectory || workingDirectory.trim().length === 0) {
		return baseDir;
	}
	return resolve(baseDir, workingDirectory);
}

async function writeTaskArtifacts(taskResult: TaskRunResult): Promise<void> {
	await Promise.all([
		writeFile(
			taskResult.artifacts.stdoutFile,
			taskResult.adapter.stdout,
			"utf-8",
		),
		writeFile(
			taskResult.artifacts.stderrFile,
			taskResult.adapter.stderr,
			"utf-8",
		),
		writeFile(
			taskResult.artifacts.assistantFile,
			taskResult.adapter.assistantText,
			"utf-8",
		),
		writeFile(
			taskResult.artifacts.recordFile,
			`${JSON.stringify(taskResult, null, 2)}\n`,
			"utf-8",
		),
	]);
}

export async function runTerminalBenchWithConfig(
	config: TerminalBenchResolvedConfig,
): Promise<TerminalBenchSummary> {
	const runStarted = Date.now();
	const runId = createRunId(new Date(runStarted));
	const runDir = join(config.resultsDir, runId);
	await mkdir(runDir, { recursive: true });

	const adapter = createAdapter(config.adapter);
	const taskResults: TaskRunResult[] = [];

	for (const task of config.tasks) {
		const taskStarted = Date.now();
		const workingDirectory = resolveTaskWorkingDirectory(
			config,
			task.workingDirectory,
		);
		const context: TaskRunContext = {
			task,
			workingDirectory,
			timeoutMs: task.timeoutMs || config.run.defaultTimeoutMs,
		};

		const filePrefix = safeTaskFileName(task.id);
		const stdoutFile = join(runDir, `${filePrefix}.stdout.log`);
		const stderrFile = join(runDir, `${filePrefix}.stderr.log`);
		const assistantFile = join(runDir, `${filePrefix}.assistant.txt`);
		const recordFile = join(runDir, `${filePrefix}.result.json`);

		const setup = await executeSetup(context);
		if (setup.failed) {
			const endedAt = Date.now();
			const failedTask: TaskRunResult = {
				taskId: task.id,
				description: task.description,
				workingDirectory,
				prompt: task.prompt,
				status: "failed",
				startedAt: toIsoString(taskStarted),
				endedAt: toIsoString(endedAt),
				durationMs: endedAt - taskStarted,
				setup,
				adapter: {
					exitCode: 1,
					timedOut: false,
					durationMs: 0,
					stdout: "",
					stderr: setup.failed,
					assistantText: "",
					errorMessage: setup.failed,
					tokens: {
						inputTokens: 0,
						outputTokens: 0,
						totalTokens: 0,
					},
				},
				validator: {
					passed: false,
					details: setup.failed,
				},
				artifacts: {
					stdoutFile,
					stderrFile,
					assistantFile,
					recordFile,
				},
			};
			await writeTaskArtifacts(failedTask);
			taskResults.push(failedTask);
			if (!config.run.continueOnFailure) {
				break;
			}
			continue;
		}

		const adapterResult = await adapter.invoke(context);
		const validatorResult = await runTaskValidator(context, adapterResult);
		const endedAt = Date.now();
		const passed =
			adapterResult.exitCode === 0 &&
			!adapterResult.timedOut &&
			validatorResult.passed;
		const taskResult: TaskRunResult = {
			taskId: task.id,
			description: task.description,
			workingDirectory,
			prompt: task.prompt,
			status: passed ? "passed" : "failed",
			startedAt: toIsoString(taskStarted),
			endedAt: toIsoString(endedAt),
			durationMs: endedAt - taskStarted,
			setup,
			adapter: adapterResult,
			validator: validatorResult,
			artifacts: {
				stdoutFile,
				stderrFile,
				assistantFile,
				recordFile,
			},
		};
		await writeTaskArtifacts(taskResult);
		taskResults.push(taskResult);

		if (!passed && !config.run.continueOnFailure) {
			break;
		}
	}

	const runEnded = Date.now();
	const summary = await buildTerminalBenchSummary({
		runId,
		startedAt: toIsoString(runStarted),
		endedAt: toIsoString(runEnded),
		config,
		resultsDir: runDir,
		tasks: taskResults,
	});

	const summaryPath = join(runDir, "summary.json");
	const markdownPath = join(runDir, "summary.md");
	await writeFile(
		summaryPath,
		`${JSON.stringify(summary, null, 2)}\n`,
		"utf-8",
	);
	await writeFile(markdownPath, createMarkdownSummary(summary), "utf-8");

	return summary;
}

function createMarkdownSummary(summary: TerminalBenchSummary): string {
	const lines = [
		`# Terminal Bench Summary`,
		"",
		`- Run ID: ${summary.runId}`,
		`- Started: ${summary.startedAt}`,
		`- Ended: ${summary.endedAt}`,
		`- Overall score: ${summary.metrics.overallScore.toFixed(2)}`,
		`- Pass rate: ${(summary.metrics.passRate * 100).toFixed(2)}% (${summary.metrics.passedTasks}/${summary.metrics.totalTasks})`,
		`- Avg duration: ${summary.metrics.avgDurationMs.toFixed(0)} ms`,
		`- Total tokens: ${summary.metrics.totalTokens}`,
		`- Total cost: $${summary.metrics.totalCostUsd.toFixed(4)}`,
		`- Quality gate: ${summary.qualityGate.passed ? "passed" : "failed"}`,
		"",
		"## Tasks",
		"",
	];

	for (const task of summary.tasks) {
		lines.push(
			`- ${task.status === "passed" ? "PASS" : "FAIL"} ${task.taskId}: ${task.validator.details}`,
		);
	}

	if (summary.qualityGate.messages.length > 0) {
		lines.push("", "## Quality Gate Messages", "");
		for (const message of summary.qualityGate.messages) {
			lines.push(`- ${message}`);
		}
	}

	return `${lines.join("\n")}\n`;
}

export async function runTerminalBench(
	options: TerminalBenchRunOptions,
): Promise<TerminalBenchSummary> {
	const config = await loadTerminalBenchConfig(options.configPath);
	await mkdir(config.resultsDir, { recursive: true });
	return runTerminalBenchWithConfig(config);
}

export function getSummaryFileName(): string {
	return basename("summary.json");
}
