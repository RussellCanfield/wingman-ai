import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import type {
	BenchValidator,
	TerminalBenchConfigFile,
	TerminalBenchResolvedConfig,
	TerminalBenchTask,
	TerminalBenchTaskFile,
} from "./types.js";

const commandSchema = z.object({
	command: z.string().min(1),
	args: z.array(z.string()).optional(),
	shell: z.boolean().optional(),
	env: z.record(z.string(), z.string()).optional(),
	allowFailure: z.boolean().optional(),
});

const includesSchema = z
	.union([z.string(), z.array(z.string())])
	.transform((value) => (typeof value === "string" ? [value] : value));

const validatorSchema = z.union([
	z.object({
		type: z.literal("command"),
		command: commandSchema,
		expectedExitCode: z.number().int().optional(),
	}),
	z.object({
		type: z.literal("assistant_contains"),
		includes: includesSchema,
	}),
	z.object({
		type: z.literal("file_contains"),
		path: z.string().min(1),
		includes: includesSchema,
	}),
]);

const taskSchema = z.object({
	id: z.string().min(1),
	description: z.string().optional(),
	prompt: z.string(),
	workingDirectory: z.string().optional(),
	timeoutMs: z.number().int().positive().optional(),
	setup: z.array(commandSchema).optional(),
	validator: validatorSchema,
	metadata: z.record(z.string(), z.string()).optional(),
	adapterOverrides: z
		.object({
			agent: z.string().optional(),
			extraArgs: z.array(z.string()).optional(),
		})
		.optional(),
});

const taskFileSchema = z.object({
	tasks: z.array(taskSchema).min(1),
});

const configSchema = z.object({
	version: z.literal(1).optional(),
	taskFile: z.string().min(1),
	resultsDir: z.string().optional(),
	run: z
		.object({
			defaultTimeoutMs: z.number().int().positive().optional(),
			continueOnFailure: z.boolean().optional(),
		})
		.optional(),
	adapter: z.union([
		z.object({
			type: z.literal("wingman-cli"),
			agent: z.string().min(1),
			cliPath: z.string().optional(),
			extraArgs: z.array(z.string()).optional(),
			env: z.record(z.string(), z.string()).optional(),
		}),
		z.object({
			type: z.literal("command"),
			command: commandSchema,
		}),
	]),
	scoring: z
		.object({
			weights: z
				.object({
					passRate: z.number().nonnegative().optional(),
					reliability: z.number().nonnegative().optional(),
					duration: z.number().nonnegative().optional(),
					cost: z.number().nonnegative().optional(),
				})
				.optional(),
			budgets: z
				.object({
					targetAvgDurationMs: z.number().positive().optional(),
					targetCostPerTaskUsd: z.number().nonnegative().optional(),
				})
				.optional(),
			pricing: z
				.object({
					inputPer1kTokensUsd: z.number().nonnegative().optional(),
					outputPer1kTokensUsd: z.number().nonnegative().optional(),
				})
				.optional(),
		})
		.optional(),
	qualityGate: z
		.object({
			enabled: z.boolean().optional(),
			baselineFile: z.string().optional(),
			minPassRateDelta: z.number().optional(),
			maxCostIncreaseRatio: z.number().nonnegative().optional(),
			maxAvgDurationIncreaseRatio: z.number().nonnegative().optional(),
		})
		.optional(),
	metadata: z.record(z.string(), z.string()).optional(),
});

function normalizeValidator(validator: BenchValidator): BenchValidator {
	if (validator.type === "assistant_contains") {
		return {
			...validator,
			includes: validator.includes.filter((entry) => entry.trim().length > 0),
		};
	}
	if (validator.type === "file_contains") {
		return {
			...validator,
			includes: validator.includes.filter((entry) => entry.trim().length > 0),
		};
	}
	return validator;
}

export async function loadTerminalBenchConfig(
	configPath: string,
): Promise<TerminalBenchResolvedConfig> {
	const resolvedConfigPath = resolve(configPath);
	const configFile = JSON.parse(
		await readFile(resolvedConfigPath, "utf-8"),
	) as TerminalBenchConfigFile;
	const parsedConfig = configSchema.parse(configFile);
	const configDir = dirname(resolvedConfigPath);

	const taskFilePath = resolve(configDir, parsedConfig.taskFile);
	const tasksFile = JSON.parse(
		await readFile(taskFilePath, "utf-8"),
	) as TerminalBenchTaskFile;
	const parsedTasks = taskFileSchema.parse(tasksFile);

	const tasks: TerminalBenchTask[] = parsedTasks.tasks.map((task) => ({
		...task,
		validator: normalizeValidator(task.validator),
	}));

	return {
		version: 1,
		configPath: resolvedConfigPath,
		taskFilePath,
		resultsDir: resolve(configDir, parsedConfig.resultsDir || "bench/results"),
		run: {
			defaultTimeoutMs: parsedConfig.run?.defaultTimeoutMs || 300_000,
			continueOnFailure: parsedConfig.run?.continueOnFailure ?? true,
		},
		adapter: parsedConfig.adapter,
		tasks,
		scoring: {
			weights: {
				passRate: parsedConfig.scoring?.weights?.passRate ?? 0.7,
				reliability: parsedConfig.scoring?.weights?.reliability ?? 0.15,
				duration: parsedConfig.scoring?.weights?.duration ?? 0.1,
				cost: parsedConfig.scoring?.weights?.cost ?? 0.05,
			},
			budgets: {
				targetAvgDurationMs: parsedConfig.scoring?.budgets?.targetAvgDurationMs,
				targetCostPerTaskUsd:
					parsedConfig.scoring?.budgets?.targetCostPerTaskUsd,
			},
			pricing: {
				inputPer1kTokensUsd:
					parsedConfig.scoring?.pricing?.inputPer1kTokensUsd ?? 0,
				outputPer1kTokensUsd:
					parsedConfig.scoring?.pricing?.outputPer1kTokensUsd ?? 0,
			},
		},
		qualityGate: {
			enabled: parsedConfig.qualityGate?.enabled ?? false,
			baselineFile: parsedConfig.qualityGate?.baselineFile
				? resolve(configDir, parsedConfig.qualityGate.baselineFile)
				: undefined,
			minPassRateDelta: parsedConfig.qualityGate?.minPassRateDelta ?? -0.03,
			maxCostIncreaseRatio:
				parsedConfig.qualityGate?.maxCostIncreaseRatio ?? 0.15,
			maxAvgDurationIncreaseRatio:
				parsedConfig.qualityGate?.maxAvgDurationIncreaseRatio ?? 0.2,
		},
		metadata: parsedConfig.metadata || {},
	};
}
