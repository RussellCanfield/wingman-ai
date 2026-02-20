import { runCommand } from "../process.js";
import type {
	AdapterInvocationResult,
	CommandAdapterConfig,
	TaskRunContext,
	TerminalBenchAdapter,
} from "../types.js";

function applyTemplate(input: string, context: TaskRunContext): string {
	return input
		.replaceAll("{{prompt}}", context.task.prompt)
		.replaceAll("{{taskId}}", context.task.id)
		.replaceAll("{{workingDirectory}}", context.workingDirectory);
}

function mapArgs(
	args: string[] | undefined,
	context: TaskRunContext,
): string[] {
	if (!args || args.length === 0) return [];
	return args.map((arg) => applyTemplate(arg, context));
}

function mapEnv(
	env: Record<string, string> | undefined,
	context: TaskRunContext,
): Record<string, string> {
	const mapped: Record<string, string> = {
		WINGMAN_BENCH_PROMPT: context.task.prompt,
		WINGMAN_BENCH_TASK_ID: context.task.id,
		WINGMAN_BENCH_WORKDIR: context.workingDirectory,
	};
	for (const [key, value] of Object.entries(env || {})) {
		mapped[key] = applyTemplate(value, context);
	}
	return mapped;
}

export class CommandAdapter implements TerminalBenchAdapter {
	constructor(private readonly config: CommandAdapterConfig) {}

	async invoke(context: TaskRunContext): Promise<AdapterInvocationResult> {
		const command = applyTemplate(this.config.command.command, context);
		const args = mapArgs(this.config.command.args, context);
		const env = mapEnv(this.config.command.env, context);
		const execution = await runCommand(command, args, {
			cwd: context.workingDirectory,
			timeoutMs: context.timeoutMs,
			shell: this.config.command.shell,
			env,
		});

		return {
			exitCode: execution.exitCode,
			timedOut: execution.timedOut,
			durationMs: execution.durationMs,
			stdout: execution.stdout,
			stderr: execution.stderr,
			assistantText: execution.stdout.trim(),
			errorMessage:
				execution.exitCode === 0 ? undefined : execution.stderr.trim(),
			tokens: {
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0,
			},
		};
	}
}
