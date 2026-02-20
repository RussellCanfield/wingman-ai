import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { runCommand } from "../process.js";
import type {
	AdapterInvocationResult,
	TaskRunContext,
	TerminalBenchAdapter,
	WingmanCliAdapterConfig,
} from "../types.js";
import { parseWingmanJsonOutput } from "./helpers.js";

function resolveAgent(
	config: WingmanCliAdapterConfig,
	context: TaskRunContext,
): string {
	return context.task.adapterOverrides?.agent || config.agent;
}

function resolveArgs(
	config: WingmanCliAdapterConfig,
	context: TaskRunContext,
): string[] {
	const overrideArgs = context.task.adapterOverrides?.extraArgs || [];
	const extraArgs = [...(config.extraArgs || []), ...overrideArgs];
	const cliArgs = [
		"agent",
		"--local",
		"--output=json",
		"--agent",
		resolveAgent(config, context),
		...extraArgs,
		context.task.prompt,
	];
	return cliArgs;
}

export class WingmanCliAdapter implements TerminalBenchAdapter {
	constructor(private readonly config: WingmanCliAdapterConfig) {}

	async invoke(context: TaskRunContext): Promise<AdapterInvocationResult> {
		const configuredCommand = this.config.cliPath || "./bin/wingman";
		const cliEntryPath = isAbsolute(configuredCommand)
			? configuredCommand
			: resolve(process.cwd(), configuredCommand);
		const args = resolveArgs(this.config, context);
		const runtimeCommand = existsSync(process.execPath)
			? process.execPath
			: "bun";
		const execution = await runCommand(
			runtimeCommand,
			[cliEntryPath, ...args],
			{
				cwd: context.workingDirectory,
				timeoutMs: context.timeoutMs,
				env: this.config.env,
			},
		);

		const parsed = parseWingmanJsonOutput(execution.stdout);
		return {
			exitCode: execution.exitCode,
			timedOut: execution.timedOut,
			durationMs: execution.durationMs,
			stdout: execution.stdout,
			stderr: execution.stderr,
			assistantText: parsed.assistantText,
			errorMessage:
				parsed.errorMessage ||
				(execution.exitCode === 0 ? undefined : execution.stderr.trim()),
			tokens: parsed.tokenUsage,
		};
	}
}
