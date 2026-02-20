import { resolve } from "node:path";
import type { OfficialBenchOverrides } from "./official.js";

function normalizeWingmanModel(value: string): string {
	const trimmed = value.trim();
	if (trimmed.includes(":")) {
		return trimmed;
	}
	const slash = trimmed.indexOf("/");
	if (slash > 0 && slash < trimmed.length - 1) {
		return `${trimmed.slice(0, slash)}:${trimmed.slice(slash + 1)}`;
	}
	return trimmed;
}

export function parseOfficialBenchArgs(argv: string[]): {
	configPath: string;
	overrides: OfficialBenchOverrides;
} {
	const args = argv.slice(2);
	let configPath = "bench/config.tb2.json";
	const taskNames: string[] = [];
	let useAllTasks = false;
	const agentKwargs: Record<string, string> = {};
	const overrides: OfficialBenchOverrides = {};

	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if ((arg === "--config" || arg === "-c") && args[i + 1]) {
			configPath = args[i + 1];
			i += 1;
			continue;
		}
		if (arg.startsWith("--config=")) {
			configPath = arg.slice("--config=".length);
			continue;
		}
		if ((arg === "--task-id" || arg === "--task-name") && args[i + 1]) {
			taskNames.push(args[i + 1]);
			i += 1;
			continue;
		}
		if (arg.startsWith("--task-id=")) {
			taskNames.push(arg.slice("--task-id=".length));
			continue;
		}
		if (arg.startsWith("--task-name=")) {
			taskNames.push(arg.slice("--task-name=".length));
			continue;
		}
		if (arg === "--all-tasks") {
			useAllTasks = true;
			continue;
		}
		if (arg === "--registry-url" && args[i + 1]) {
			overrides.registryUrl = args[i + 1];
			i += 1;
			continue;
		}
		if (arg.startsWith("--registry-url=")) {
			overrides.registryUrl = arg.slice("--registry-url=".length);
			continue;
		}
		if (arg === "--registry-path" && args[i + 1]) {
			overrides.registryPath = args[i + 1];
			i += 1;
			continue;
		}
		if (arg.startsWith("--registry-path=")) {
			overrides.registryPath = arg.slice("--registry-path=".length);
			continue;
		}
		if (arg === "--agent" && args[i + 1]) {
			overrides.agent = args[i + 1];
			i += 1;
			continue;
		}
		if (arg.startsWith("--agent=")) {
			overrides.agent = arg.slice("--agent=".length);
			continue;
		}
		if (arg === "--agent-import-path" && args[i + 1]) {
			overrides.agentImportPath = args[i + 1];
			i += 1;
			continue;
		}
		if (arg.startsWith("--agent-import-path=")) {
			overrides.agentImportPath = arg.slice("--agent-import-path=".length);
			continue;
		}
		if (arg === "--agent-kwarg" && args[i + 1]) {
			const [key, ...valueParts] = args[i + 1].split("=");
			if (key && valueParts.length > 0) {
				agentKwargs[key] = valueParts.join("=");
			}
			i += 1;
			continue;
		}
		if (arg.startsWith("--agent-kwarg=")) {
			const pair = arg.slice("--agent-kwarg=".length);
			const [key, ...valueParts] = pair.split("=");
			if (key && valueParts.length > 0) {
				agentKwargs[key] = valueParts.join("=");
			}
			continue;
		}
		if (arg === "--wingman-agent" && args[i + 1]) {
			agentKwargs.wingman_agent = args[i + 1];
			i += 1;
			continue;
		}
		if (arg.startsWith("--wingman-agent=")) {
			agentKwargs.wingman_agent = arg.slice("--wingman-agent=".length);
			continue;
		}
		if (arg === "--wingman-model" && args[i + 1]) {
			agentKwargs.wingman_model = normalizeWingmanModel(args[i + 1]);
			i += 1;
			continue;
		}
		if (arg.startsWith("--wingman-model=")) {
			agentKwargs.wingman_model = normalizeWingmanModel(
				arg.slice("--wingman-model=".length),
			);
			continue;
		}
		if (arg === "--model" && args[i + 1]) {
			overrides.model = args[i + 1];
			i += 1;
			continue;
		}
		if (arg.startsWith("--model=")) {
			overrides.model = arg.slice("--model=".length);
			continue;
		}
		if (arg === "--dataset" && args[i + 1]) {
			overrides.dataset = args[i + 1];
			i += 1;
			continue;
		}
		if (arg.startsWith("--dataset=")) {
			overrides.dataset = arg.slice("--dataset=".length);
			continue;
		}
		if (arg === "--n-concurrent" && args[i + 1]) {
			overrides.nConcurrent = Number.parseInt(args[i + 1], 10);
			i += 1;
			continue;
		}
		if (arg.startsWith("--n-concurrent=")) {
			overrides.nConcurrent = Number.parseInt(
				arg.slice("--n-concurrent=".length),
				10,
			);
			continue;
		}
		if (arg === "--n-attempts" && args[i + 1]) {
			overrides.nAttempts = Number.parseInt(args[i + 1], 10);
			i += 1;
			continue;
		}
		if (arg.startsWith("--n-attempts=")) {
			overrides.nAttempts = Number.parseInt(
				arg.slice("--n-attempts=".length),
				10,
			);
			continue;
		}
		if (arg === "--n-tasks" && args[i + 1]) {
			overrides.nTasks = Number.parseInt(args[i + 1], 10);
			i += 1;
			continue;
		}
		if (arg.startsWith("--n-tasks=")) {
			overrides.nTasks = Number.parseInt(arg.slice("--n-tasks=".length), 10);
			continue;
		}
		if (arg === "--timeout-ms" && args[i + 1]) {
			overrides.timeoutMs = Number.parseInt(args[i + 1], 10);
			i += 1;
			continue;
		}
		if (arg.startsWith("--timeout-ms=")) {
			overrides.timeoutMs = Number.parseInt(
				arg.slice("--timeout-ms=".length),
				10,
			);
		}
	}

	if (useAllTasks) {
		overrides.taskNames = [];
	} else if (taskNames.length > 0) {
		overrides.taskNames = taskNames;
	}
	if (Object.keys(agentKwargs).length > 0) {
		overrides.agentKwargs = agentKwargs;
	}

	return { configPath: resolve(process.cwd(), configPath), overrides };
}
