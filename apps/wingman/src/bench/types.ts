export type BenchCommand = {
	command: string;
	args?: string[];
	shell?: boolean;
	env?: Record<string, string>;
	allowFailure?: boolean;
};

export type BenchValidator =
	| {
			type: "command";
			command: BenchCommand;
			expectedExitCode?: number;
	  }
	| {
			type: "assistant_contains";
			includes: string[];
	  }
	| {
			type: "file_contains";
			path: string;
			includes: string[];
	  };

export interface TerminalBenchTask {
	id: string;
	description?: string;
	prompt: string;
	workingDirectory?: string;
	timeoutMs?: number;
	setup?: BenchCommand[];
	validator: BenchValidator;
	metadata?: Record<string, string>;
	adapterOverrides?: {
		agent?: string;
		extraArgs?: string[];
	};
}

export interface TerminalBenchTaskFile {
	tasks: TerminalBenchTask[];
}

export type WingmanCliAdapterConfig = {
	type: "wingman-cli";
	agent: string;
	cliPath?: string;
	extraArgs?: string[];
	env?: Record<string, string>;
};

export type CommandAdapterConfig = {
	type: "command";
	command: BenchCommand;
};

export type TerminalBenchAdapterConfig =
	| WingmanCliAdapterConfig
	| CommandAdapterConfig;

export interface TerminalBenchConfigFile {
	version?: 1;
	taskFile: string;
	resultsDir?: string;
	run?: {
		defaultTimeoutMs?: number;
		continueOnFailure?: boolean;
	};
	adapter: TerminalBenchAdapterConfig;
	scoring?: {
		weights?: {
			passRate?: number;
			reliability?: number;
			duration?: number;
			cost?: number;
		};
		budgets?: {
			targetAvgDurationMs?: number;
			targetCostPerTaskUsd?: number;
		};
		pricing?: {
			inputPer1kTokensUsd?: number;
			outputPer1kTokensUsd?: number;
		};
	};
	qualityGate?: {
		enabled?: boolean;
		baselineFile?: string;
		minPassRateDelta?: number;
		maxCostIncreaseRatio?: number;
		maxAvgDurationIncreaseRatio?: number;
	};
	metadata?: Record<string, string>;
}

export interface TerminalBenchResolvedConfig {
	version: 1;
	configPath: string;
	taskFilePath: string;
	resultsDir: string;
	run: {
		defaultTimeoutMs: number;
		continueOnFailure: boolean;
	};
	adapter: TerminalBenchAdapterConfig;
	tasks: TerminalBenchTask[];
	scoring: {
		weights: {
			passRate: number;
			reliability: number;
			duration: number;
			cost: number;
		};
		budgets: {
			targetAvgDurationMs?: number;
			targetCostPerTaskUsd?: number;
		};
		pricing: {
			inputPer1kTokensUsd: number;
			outputPer1kTokensUsd: number;
		};
	};
	qualityGate: {
		enabled: boolean;
		baselineFile?: string;
		minPassRateDelta: number;
		maxCostIncreaseRatio: number;
		maxAvgDurationIncreaseRatio: number;
	};
	metadata: Record<string, string>;
}

export interface AdapterTokenUsage {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
}

export interface AdapterInvocationResult {
	exitCode: number;
	timedOut: boolean;
	durationMs: number;
	stdout: string;
	stderr: string;
	assistantText: string;
	errorMessage?: string;
	tokens: AdapterTokenUsage;
}

export interface TaskRunContext {
	task: TerminalBenchTask;
	workingDirectory: string;
	timeoutMs: number;
}

export interface TerminalBenchAdapter {
	invoke(context: TaskRunContext): Promise<AdapterInvocationResult>;
}

export interface TaskValidatorResult {
	passed: boolean;
	details: string;
}

export interface TaskRunResult {
	taskId: string;
	description?: string;
	workingDirectory: string;
	prompt: string;
	status: "passed" | "failed";
	startedAt: string;
	endedAt: string;
	durationMs: number;
	adapter: AdapterInvocationResult;
	validator: TaskValidatorResult;
	setup: {
		runCount: number;
		failed?: string;
	};
	artifacts: {
		stdoutFile: string;
		stderrFile: string;
		assistantFile: string;
		recordFile: string;
	};
}

export interface TerminalBenchSummary {
	runId: string;
	startedAt: string;
	endedAt: string;
	configPath: string;
	taskFilePath: string;
	resultsDir: string;
	metrics: {
		totalTasks: number;
		passedTasks: number;
		failedTasks: number;
		passRate: number;
		timeoutRate: number;
		totalDurationMs: number;
		avgDurationMs: number;
		p95DurationMs: number;
		totalInputTokens: number;
		totalOutputTokens: number;
		totalTokens: number;
		totalCostUsd: number;
		avgCostPerTaskUsd: number;
		costPerPassUsd: number;
		overallScore: number;
	};
	qualityGate: {
		enabled: boolean;
		passed: boolean;
		messages: string[];
		baselineFile?: string;
	};
	tasks: TaskRunResult[];
	metadata: Record<string, string>;
}
