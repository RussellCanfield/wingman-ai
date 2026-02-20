import { readFile } from "node:fs/promises";
import type {
	TaskRunResult,
	TerminalBenchResolvedConfig,
	TerminalBenchSummary,
} from "./types.js";

function average(values: number[]): number {
	if (values.length === 0) return 0;
	return values.reduce((total, value) => total + value, 0) / values.length;
}

function percentile(values: number[], p: number): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const index = Math.ceil((p / 100) * sorted.length) - 1;
	return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

function clamp(value: number, min = 0, max = 1): number {
	return Math.max(min, Math.min(max, value));
}

function computeCostUsd(
	inputTokens: number,
	outputTokens: number,
	config: TerminalBenchResolvedConfig,
): number {
	const inputCost =
		(inputTokens / 1000) * config.scoring.pricing.inputPer1kTokensUsd;
	const outputCost =
		(outputTokens / 1000) * config.scoring.pricing.outputPer1kTokensUsd;
	return inputCost + outputCost;
}

function normalizeWeightedScore(input: {
	passRate: number;
	reliability: number;
	duration: number;
	cost: number;
	weights: TerminalBenchResolvedConfig["scoring"]["weights"];
}): number {
	const weightTotal =
		input.weights.passRate +
		input.weights.reliability +
		input.weights.duration +
		input.weights.cost;
	if (weightTotal <= 0) return 0;

	const weighted =
		input.passRate * input.weights.passRate +
		input.reliability * input.weights.reliability +
		input.duration * input.weights.duration +
		input.cost * input.weights.cost;
	return weighted / weightTotal;
}

async function compareToBaseline(
	summary: TerminalBenchSummary,
	config: TerminalBenchResolvedConfig,
): Promise<{ passed: boolean; messages: string[] }> {
	if (!config.qualityGate.enabled || !config.qualityGate.baselineFile) {
		return { passed: true, messages: [] };
	}

	let baseline: TerminalBenchSummary;
	try {
		baseline = JSON.parse(
			await readFile(config.qualityGate.baselineFile, "utf-8"),
		) as TerminalBenchSummary;
	} catch (error) {
		return {
			passed: false,
			messages: [
				`Unable to read baseline file ${config.qualityGate.baselineFile}: ${error instanceof Error ? error.message : String(error)}`,
			],
		};
	}

	const messages: string[] = [];
	let passed = true;

	const passRateDelta = summary.metrics.passRate - baseline.metrics.passRate;
	if (passRateDelta < config.qualityGate.minPassRateDelta) {
		passed = false;
		messages.push(
			`Pass rate delta ${passRateDelta.toFixed(4)} is below threshold ${config.qualityGate.minPassRateDelta.toFixed(4)}.`,
		);
	}

	if (baseline.metrics.totalCostUsd > 0) {
		const costIncreaseRatio =
			(summary.metrics.totalCostUsd - baseline.metrics.totalCostUsd) /
			baseline.metrics.totalCostUsd;
		if (costIncreaseRatio > config.qualityGate.maxCostIncreaseRatio) {
			passed = false;
			messages.push(
				`Cost increase ratio ${(costIncreaseRatio * 100).toFixed(2)}% exceeded threshold ${(config.qualityGate.maxCostIncreaseRatio * 100).toFixed(2)}%.`,
			);
		}
	}

	if (baseline.metrics.avgDurationMs > 0) {
		const durationIncreaseRatio =
			(summary.metrics.avgDurationMs - baseline.metrics.avgDurationMs) /
			baseline.metrics.avgDurationMs;
		if (
			durationIncreaseRatio > config.qualityGate.maxAvgDurationIncreaseRatio
		) {
			passed = false;
			messages.push(
				`Average duration increase ratio ${(durationIncreaseRatio * 100).toFixed(2)}% exceeded threshold ${(config.qualityGate.maxAvgDurationIncreaseRatio * 100).toFixed(2)}%.`,
			);
		}
	}

	return { passed, messages };
}

export async function buildTerminalBenchSummary(input: {
	runId: string;
	startedAt: string;
	endedAt: string;
	config: TerminalBenchResolvedConfig;
	resultsDir: string;
	tasks: TaskRunResult[];
}): Promise<TerminalBenchSummary> {
	const totalTasks = input.tasks.length;
	const passedTasks = input.tasks.filter(
		(task) => task.status === "passed",
	).length;
	const failedTasks = totalTasks - passedTasks;
	const passRate = totalTasks > 0 ? passedTasks / totalTasks : 0;
	const timeoutRate =
		totalTasks > 0
			? input.tasks.filter((task) => task.adapter.timedOut).length / totalTasks
			: 0;
	const durationValues = input.tasks.map((task) => task.durationMs);
	const totalDurationMs = durationValues.reduce(
		(total, value) => total + value,
		0,
	);
	const avgDurationMs = average(durationValues);
	const p95DurationMs = percentile(durationValues, 95);
	const totalInputTokens = input.tasks.reduce(
		(total, task) => total + task.adapter.tokens.inputTokens,
		0,
	);
	const totalOutputTokens = input.tasks.reduce(
		(total, task) => total + task.adapter.tokens.outputTokens,
		0,
	);
	const totalTokens = input.tasks.reduce(
		(total, task) => total + task.adapter.tokens.totalTokens,
		0,
	);
	const totalCostUsd = computeCostUsd(
		totalInputTokens,
		totalOutputTokens,
		input.config,
	);
	const avgCostPerTaskUsd = totalTasks > 0 ? totalCostUsd / totalTasks : 0;
	const costPerPassUsd =
		passedTasks > 0 ? totalCostUsd / passedTasks : totalCostUsd;

	const durationBudget = input.config.scoring.budgets.targetAvgDurationMs;
	const durationScore = durationBudget
		? clamp(durationBudget / Math.max(avgDurationMs, 1)) * 100
		: 100;
	const costBudget = input.config.scoring.budgets.targetCostPerTaskUsd;
	const costScore = costBudget
		? clamp(costBudget / Math.max(avgCostPerTaskUsd, Number.EPSILON)) * 100
		: 100;
	const reliabilityScore = (1 - timeoutRate) * 100;
	const passRateScore = passRate * 100;
	const overallScore = normalizeWeightedScore({
		passRate: passRateScore,
		reliability: reliabilityScore,
		duration: durationScore,
		cost: costScore,
		weights: input.config.scoring.weights,
	});

	const summary: TerminalBenchSummary = {
		runId: input.runId,
		startedAt: input.startedAt,
		endedAt: input.endedAt,
		configPath: input.config.configPath,
		taskFilePath: input.config.taskFilePath,
		resultsDir: input.resultsDir,
		metrics: {
			totalTasks,
			passedTasks,
			failedTasks,
			passRate,
			timeoutRate,
			totalDurationMs,
			avgDurationMs,
			p95DurationMs,
			totalInputTokens,
			totalOutputTokens,
			totalTokens,
			totalCostUsd,
			avgCostPerTaskUsd,
			costPerPassUsd,
			overallScore,
		},
		qualityGate: {
			enabled: input.config.qualityGate.enabled,
			passed: true,
			messages: [],
			baselineFile: input.config.qualityGate.baselineFile,
		},
		tasks: input.tasks,
		metadata: input.config.metadata,
	};

	const qualityGateResult = await compareToBaseline(summary, input.config);
	summary.qualityGate.passed = qualityGateResult.passed;
	summary.qualityGate.messages = qualityGateResult.messages;

	return summary;
}
