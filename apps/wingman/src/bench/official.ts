import { chmod, mkdir, writeFile } from "node:fs/promises";
import { delimiter, join, resolve } from "node:path";
import { z } from "zod";
import { runCommand } from "./process.js";

const officialConfigSchema = z.object({
	dataset: z.string().min(1),
	taskNames: z.array(z.string().min(1)).optional(),
	registryUrl: z.string().min(1).optional(),
	registryPath: z.string().min(1).optional(),
	agent: z.string().min(1).optional(),
	agentImportPath: z.string().min(1).optional(),
	agentKwargs: z.record(z.string(), z.string()).optional(),
	model: z.string().optional(),
	nConcurrent: z.number().int().positive().optional(),
	nAttempts: z.number().int().positive().optional(),
	nTasks: z.number().int().positive().optional(),
	timeoutMs: z.number().int().positive().optional(),
	extraArgs: z.array(z.string()).optional(),
});

export type OfficialBenchConfig = z.infer<typeof officialConfigSchema>;

export interface OfficialBenchOverrides {
	taskNames?: string[];
	registryUrl?: string;
	registryPath?: string;
	agent?: string;
	agentImportPath?: string;
	agentKwargs?: Record<string, string>;
	model?: string;
	dataset?: string;
	nConcurrent?: number;
	nAttempts?: number;
	nTasks?: number;
	timeoutMs?: number;
}

export interface OfficialBenchSummary {
	timestamp: string;
	command: {
		binary: string;
		args: string[];
	};
	runtime: {
		containerRuntime: "docker" | "podman";
	};
	exitCode: number;
	timedOut: boolean;
	durationMs: number;
	errorMessage?: string;
	metrics: {
		resolvedTrials?: number;
		unresolvedTrials?: number;
		accuracyPercent?: number;
		passAtK: Record<string, number>;
	};
	runOutputPath?: string;
	artifacts: {
		rawStdoutPath: string;
		rawStderrPath: string;
		summaryPath: string;
	};
}

type ContainerRuntimeResolution = {
	containerRuntime: "docker" | "podman";
	env?: Record<string, string>;
};

export function extractTaskNamesFromArgs(args: string[]): string[] {
	const names: string[] = [];
	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === "--task-name" && args[i + 1]) {
			names.push(args[i + 1]);
			i += 1;
			continue;
		}
		if (arg.startsWith("--task-name=")) {
			names.push(arg.slice("--task-name=".length));
		}
	}
	return names;
}

export function normalizeHarborFailureMessage(params: {
	rawMessage: string | undefined;
	args: string[];
	dataset: string;
}): string | undefined {
	const { rawMessage, args, dataset } = params;
	if (rawMessage !== "ValueError: Either datasets or tasks must be provided.") {
		return rawMessage;
	}
	const selectedTaskNames = extractTaskNamesFromArgs(args);
	if (selectedTaskNames.length === 0) {
		return rawMessage;
	}
	return `No tasks matched ${selectedTaskNames.map((name) => `"${name}"`).join(", ")} in dataset "${dataset}". Verify task ids for Terminal-Bench 2.0.`;
}

function stripAnsi(value: string): string {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: needed to strip ANSI escape sequences
	return value.replace(/\u001B\[[0-9;]*[A-Za-z]/g, "");
}

function parseMetricNumber(line: string): number | undefined {
	const match = line.match(/(-?\d+(?:\.\d+)?)(?:\s*%?)\s*[│|]?\s*$/);
	if (!match) return undefined;
	const value = Number.parseFloat(match[1]);
	return Number.isFinite(value) ? value : undefined;
}

export function isMissingComposeProviderError(output: string): boolean {
	const normalized = stripAnsi(output).toLowerCase();
	return (
		normalized.includes("looking up compose provider failed") ||
		normalized.includes('exec: "docker-compose": executable file not found') ||
		normalized.includes('exec: "podman-compose": executable file not found')
	);
}

export function isPodmanBackedDockerVersionOutput(output: string): boolean {
	const normalized = stripAnsi(output).toLowerCase();
	return (
		normalized.includes("podman") ||
		normalized.includes("emulate docker cli using podman")
	);
}

export function parseHarborRunOutput(
	output: string,
): OfficialBenchSummary["metrics"] & {
	runOutputPath?: string;
} {
	const normalized = stripAnsi(output);
	const lines = normalized.split(/\r?\n/);
	let resolvedTrials: number | undefined;
	let unresolvedTrials: number | undefined;
	let accuracyPercent: number | undefined;
	const passAtK: Record<string, number> = {};
	let runOutputPath: string | undefined;

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line) continue;

		if (line.includes("Resolved Trials")) {
			resolvedTrials = parseMetricNumber(line);
			continue;
		}
		if (line.includes("Unresolved Trials")) {
			unresolvedTrials = parseMetricNumber(line);
			continue;
		}
		if (line.includes("Accuracy")) {
			accuracyPercent = parseMetricNumber(line);
			continue;
		}

		const passAtKMatch = line.match(/Pass@(\d+)/i);
		if (passAtKMatch) {
			const value = parseMetricNumber(line);
			if (value !== undefined) {
				passAtK[passAtKMatch[1]] = value;
			}
			continue;
		}

		const pathMatch =
			line.match(/results written to\s+(.+)$/i) ||
			line.match(/results saved to\s+(.+)$/i) ||
			line.match(/output written to\s+(.+)$/i);
		if (pathMatch?.[1]) {
			runOutputPath = pathMatch[1].trim();
		}
	}

	return {
		resolvedTrials,
		unresolvedTrials,
		accuracyPercent,
		passAtK,
		runOutputPath,
	};
}

export function extractHarborErrorMessage(stderr: string): string | undefined {
	const normalized = stripAnsi(stderr);

	if (
		normalized.includes("ValueError: Error getting dataset") &&
		normalized.match(/ValueError: Error getting dataset[^\n]*/g)
	) {
		return normalized.match(/ValueError: Error getting dataset[^\n]*/g)?.at(-1);
	}
	if (
		normalized.includes("ConnectError:") &&
		normalized.match(/ConnectError:[^\n]*/g)
	) {
		return normalized.match(/ConnectError:[^\n]*/g)?.at(-1);
	}
	if (
		normalized.includes("nodename nor servname provided") ||
		normalized.includes("temporary failure in name resolution")
	) {
		return "Harbor registry lookup failed due DNS/network error. Verify internet access or pass --registry-url/--registry-path.";
	}

	const lines = normalized
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	if (lines.length === 0) {
		return undefined;
	}

	for (let i = lines.length - 1; i >= 0; i -= 1) {
		if (lines[i].startsWith("ValueError:")) {
			return lines[i];
		}
	}
	for (let i = lines.length - 1; i >= 0; i -= 1) {
		if (/\w+Error:/.test(lines[i])) {
			return lines[i];
		}
	}
	return lines.at(-1);
}

export function buildHarborRunArgs(
	config: OfficialBenchConfig,
	overrides: OfficialBenchOverrides,
): string[] {
	const dataset = overrides.dataset || config.dataset;
	const taskNames = overrides.taskNames ?? config.taskNames ?? [];
	const registryUrl = overrides.registryUrl || config.registryUrl;
	const registryPath = overrides.registryPath || config.registryPath;
	const agent = overrides.agent || config.agent || "oracle";
	const agentImportPath = overrides.agentImportPath || config.agentImportPath;
	const agentKwargs = {
		...(config.agentKwargs || {}),
		...(overrides.agentKwargs || {}),
	};
	const model = overrides.model || config.model;
	const nConcurrent = overrides.nConcurrent || config.nConcurrent;
	const nAttempts = overrides.nAttempts || config.nAttempts;
	const nTasks = overrides.nTasks || config.nTasks;

	const args = ["run", "--dataset", dataset];
	if (registryUrl) {
		args.push("--registry-url", registryUrl);
	}
	if (registryPath) {
		args.push("--registry-path", registryPath);
	}
	if (agentImportPath) {
		args.push("--agent-import-path", agentImportPath);
	} else {
		args.push("--agent", agent);
	}
	if (model) {
		args.push("--model", model);
	}
	if (nConcurrent) {
		args.push("--n-concurrent", String(nConcurrent));
	}
	if (nAttempts) {
		args.push("--n-attempts", String(nAttempts));
	}
	if (nTasks) {
		args.push("--n-tasks", String(nTasks));
	}
	for (const [key, value] of Object.entries(agentKwargs)) {
		if (agentImportPath && key === "model_name") {
			// Harbor already passes model_name for import-path agents.
			continue;
		}
		args.push("--agent-kwarg", `${key}=${value}`);
	}
	for (const taskName of taskNames) {
		args.push("--task-name", taskName);
	}
	if (config.extraArgs && config.extraArgs.length > 0) {
		args.push(...config.extraArgs);
	}
	return args;
}

export async function loadOfficialBenchConfig(
	configPath: string,
): Promise<OfficialBenchConfig> {
	const path = resolve(configPath);
	const text = await Bun.file(path).text();
	return officialConfigSchema.parse(JSON.parse(text));
}

async function resolveRequiredBinary(name: "harbor"): Promise<string> {
	const check = await runCommand("sh", ["-lc", `command -v ${name}`], {
		cwd: process.cwd(),
		timeoutMs: 5_000,
	});
	if (check.exitCode !== 0) {
		throw new Error(
			"harbor is not installed or not on PATH. Install Harbor CLI and verify with `harbor --help`.",
		);
	}

	const resolvedPath = check.stdout.trim().split(/\r?\n/).at(-1)?.trim();
	if (!resolvedPath) {
		throw new Error(`Unable to resolve ${name} binary path.`);
	}
	return resolvedPath;
}

async function resolveBinary(name: string): Promise<string | null> {
	const check = await runCommand("sh", ["-lc", `command -v ${name}`], {
		cwd: process.cwd(),
		timeoutMs: 5_000,
	});
	if (check.exitCode !== 0) {
		return null;
	}

	const resolvedPath = check.stdout.trim().split(/\r?\n/).at(-1)?.trim();
	return resolvedPath || null;
}

function shellQuote(value: string): string {
	return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export function createDockerShimScript(targetBinary: string): string {
	return `#!/bin/bash
set -e
TARGET_BINARY=${shellQuote(targetBinary)}

if [[ "$1" == "compose" ]] && command -v podman-compose >/dev/null 2>&1; then
	shift
	PROJECT_DIR=""
	PROJECT_NAME=""
	COMPOSE_FILES=()
	TRANSLATED_ARGS=()

	while [[ $# -gt 0 ]]; do
		case "$1" in
			-p)
				PROJECT_NAME="$2"
				TRANSLATED_ARGS+=("$1" "$2")
				shift 2
				;;
			-p=*)
				PROJECT_NAME="\${1#*=}"
				TRANSLATED_ARGS+=("$1")
				shift
				;;
			-f)
				COMPOSE_FILES+=("$2")
				TRANSLATED_ARGS+=("$1" "$2")
				shift 2
				;;
			-f=*)
				COMPOSE_FILES+=("\${1#*=}")
				TRANSLATED_ARGS+=("$1")
				shift
				;;
			--project-directory)
				PROJECT_DIR="$2"
				shift 2
				;;
			--project-directory=*)
				PROJECT_DIR="\${1#*=}"
				shift
				;;
			*)
				TRANSLATED_ARGS+=("$1")
				shift
				;;
		esac
	done

	if [[ -n "$PROJECT_DIR" ]]; then
		cd "$PROJECT_DIR"
	fi

	resolve_container_id() {
		local service="$1"
		local container_id=""

		if [[ -n "$PROJECT_NAME" ]]; then
			container_id=$(podman ps -a \
				--filter "label=com.docker.compose.project=$PROJECT_NAME" \
				--filter "label=com.docker.compose.service=$service" \
				--format "{{.ID}}" | head -n 1 || true)
		fi

		if [[ -z "$container_id" && -n "$PROJECT_NAME" ]]; then
			local c1="\${PROJECT_NAME}_\${service}_1"
			local c2="\${PROJECT_NAME}-\${service}-1"
			if podman container exists "$c1" >/dev/null 2>&1; then
				container_id="$c1"
			elif podman container exists "$c2" >/dev/null 2>&1; then
				container_id="$c2"
			fi
		fi

		echo "$container_id"
	}

	translate_cp_endpoint() {
		local endpoint="$1"
		if [[ "$endpoint" == *:* ]]; then
			local service="\${endpoint%%:*}"
			local inner_path="\${endpoint#*:}"
			local container_id
			container_id=$(resolve_container_id "$service")
			if [[ -z "$container_id" ]]; then
				echo "docker shim: unable to resolve container for service '$service' (project '$PROJECT_NAME')" >&2
				exit 2
			fi
			echo "$container_id:$inner_path"
			return
		fi
		echo "$endpoint"
	}

	# podman-compose does not implement compose cp, so map it directly to podman cp.
	if [[ "\${#TRANSLATED_ARGS[@]}" -gt 0 ]]; then
		for i in "\${!TRANSLATED_ARGS[@]}"; do
			if [[ "\${TRANSLATED_ARGS[$i]}" == "cp" ]]; then
				cp_index="$i"
				src_idx=$((cp_index + 1))
				dst_idx=$((cp_index + 2))
				if [[ -z "\${TRANSLATED_ARGS[$src_idx]:-}" || -z "\${TRANSLATED_ARGS[$dst_idx]:-}" ]]; then
					echo "docker shim: compose cp requires source and destination" >&2
					exit 2
				fi
				src=""
				dst=""
				src=$(translate_cp_endpoint "\${TRANSLATED_ARGS[$src_idx]}")
				dst=$(translate_cp_endpoint "\${TRANSLATED_ARGS[$dst_idx]}")
				exec podman cp "$src" "$dst"
			fi

			if [[ "\${TRANSLATED_ARGS[$i]}" == "exec" ]]; then
				exec_idx="$i"
				j=$((exec_idx + 1))
				PODMAN_EXEC_ARGS=()

				while [[ $j -lt \${#TRANSLATED_ARGS[@]} ]]; do
					tok="\${TRANSLATED_ARGS[$j]}"
					case "$tok" in
						-it|-ti|-i|-t|--interactive|--tty)
							# Skip compose tty/interactive flags to avoid non-tty failures.
							j=$((j + 1))
							;;
						-w|--workdir|-e|--env)
							if [[ $((j + 1)) -ge \${#TRANSLATED_ARGS[@]} ]]; then
								echo "docker shim: missing value for $tok in compose exec" >&2
								exit 2
							fi
							PODMAN_EXEC_ARGS+=("$tok" "\${TRANSLATED_ARGS[$((j + 1))]}")
							j=$((j + 2))
							;;
						-w=*|--workdir=*|-e=*|--env=*)
							PODMAN_EXEC_ARGS+=("$tok")
							j=$((j + 1))
							;;
						--)
							j=$((j + 1))
							break
							;;
						-*)
							PODMAN_EXEC_ARGS+=("$tok")
							j=$((j + 1))
							;;
						*)
							service="$tok"
							j=$((j + 1))
							break
							;;
					esac
				done

				if [[ -z "\${service:-}" ]]; then
					echo "docker shim: compose exec missing service name" >&2
					exit 2
				fi

				container_id=$(resolve_container_id "$service")
				if [[ -z "$container_id" ]]; then
					echo "docker shim: unable to resolve container for service '$service' (project '$PROJECT_NAME')" >&2
					exit 2
				fi

				REMAINDER=("\${TRANSLATED_ARGS[@]:$j}")
				if [[ \${#REMAINDER[@]} -eq 0 ]]; then
					echo "docker shim: compose exec missing command" >&2
					exit 2
				fi
				exec podman exec "\${PODMAN_EXEC_ARGS[@]}" "$container_id" "\${REMAINDER[@]}"
			fi
		done
	fi

	exec podman-compose "\${TRANSLATED_ARGS[@]}"
fi

exec "$TARGET_BINARY" "$@"
`;
}

export function buildRuntimePathEnv(
	shimDir: string,
	basePath = process.env.PATH || "",
): string {
	return basePath ? `${shimDir}:${basePath}` : shimDir;
}

export function buildPythonPathEnv(
	pathToAdd: string,
	basePythonPath = process.env.PYTHONPATH || "",
): string {
	return basePythonPath
		? `${pathToAdd}${delimiter}${basePythonPath}`
		: pathToAdd;
}

function parseLastNonEmptyLine(value: string): string | undefined {
	const lines = value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	return lines.at(-1);
}

function normalizeDockerHost(value: string): string {
	const trimmed = value.trim().replace(/^['"]|['"]$/g, "");
	if (/^[a-zA-Z]+:\/\//.test(trimmed)) {
		return trimmed;
	}
	if (trimmed.startsWith("/")) {
		return `unix://${trimmed}`;
	}
	return trimmed;
}

export function parseDockerHostCandidate(
	value: string | undefined,
): string | undefined {
	if (!value) return undefined;
	const normalized = normalizeDockerHost(value);
	if (
		normalized.length === 0 ||
		normalized === "null" ||
		normalized === "<nil>" ||
		normalized === "<no value>" ||
		normalized === "[]"
	) {
		return undefined;
	}
	return normalized;
}

async function resolvePodmanDockerHost(): Promise<string | undefined> {
	const existing = parseDockerHostCandidate(process.env.DOCKER_HOST);
	if (existing) {
		return existing;
	}

	const inspect = await runCommand(
		"podman",
		["machine", "inspect", "--format", "{{.ConnectionInfo.PodmanSocket.Path}}"],
		{ cwd: process.cwd(), timeoutMs: 5_000 },
	);
	if (inspect.exitCode === 0) {
		const fromInspect = parseDockerHostCandidate(
			parseLastNonEmptyLine(inspect.stdout),
		);
		if (fromInspect) {
			return fromInspect;
		}
	}

	const machineEnv = await runCommand("podman", ["machine", "env"], {
		cwd: process.cwd(),
		timeoutMs: 5_000,
	});
	if (machineEnv.exitCode === 0) {
		const match = machineEnv.stdout.match(/DOCKER_HOST=(['"]?)([^'"\n]+)\1/);
		const fromMachineEnv = parseDockerHostCandidate(match?.[2]);
		if (fromMachineEnv) {
			return fromMachineEnv;
		}
	}

	const info = await runCommand(
		"podman",
		["info", "--format", "{{.Host.RemoteSocket.Path}}"],
		{ cwd: process.cwd(), timeoutMs: 5_000 },
	);
	if (info.exitCode === 0) {
		return parseDockerHostCandidate(parseLastNonEmptyLine(info.stdout));
	}

	return undefined;
}

async function resolveContainerRuntime(
	wrapperOutputDir: string,
): Promise<ContainerRuntimeResolution> {
	const dockerBinary = await resolveBinary("docker");
	const podmanBinary = await resolveBinary("podman");

	if (dockerBinary) {
		const dockerVersionCheck = await runCommand(dockerBinary, ["--version"], {
			cwd: process.cwd(),
			timeoutMs: 5_000,
		});
		const dockerVersionOutput = `${dockerVersionCheck.stdout}\n${dockerVersionCheck.stderr}`;
		const dockerLooksPodman =
			dockerBinary.toLowerCase().includes("podman") ||
			isPodmanBackedDockerVersionOutput(dockerVersionOutput);
		if (!dockerLooksPodman || !podmanBinary) {
			return { containerRuntime: "docker" };
		}

		const shimDir = join(wrapperOutputDir, "runtime-bin");
		const shimPath = join(shimDir, "docker");
		await mkdir(shimDir, { recursive: true });
		await writeFile(shimPath, createDockerShimScript(podmanBinary), "utf-8");
		await chmod(shimPath, 0o755);

		const runtimeEnv: Record<string, string> = {
			PATH: buildRuntimePathEnv(shimDir),
		};
		const podmanDockerHost = await resolvePodmanDockerHost();
		if (podmanDockerHost) {
			runtimeEnv.DOCKER_HOST = podmanDockerHost;
		}

		return {
			containerRuntime: "podman",
			env: runtimeEnv,
		};
	}

	if (!podmanBinary) {
		throw new Error(
			"Neither docker nor podman is installed or on PATH. Install Docker Desktop or Podman, then retry.",
		);
	}

	const shimDir = join(wrapperOutputDir, "runtime-bin");
	const shimPath = join(shimDir, "docker");
	await mkdir(shimDir, { recursive: true });
	await writeFile(shimPath, createDockerShimScript(podmanBinary), "utf-8");
	await chmod(shimPath, 0o755);

	const runtimeEnv: Record<string, string> = {
		PATH: buildRuntimePathEnv(shimDir),
	};
	const podmanDockerHost = await resolvePodmanDockerHost();
	if (podmanDockerHost) {
		runtimeEnv.DOCKER_HOST = podmanDockerHost;
	}

	return {
		containerRuntime: "podman",
		env: runtimeEnv,
	};
}

async function ensureComposeAvailableForPodman(
	runtime: ContainerRuntimeResolution,
): Promise<void> {
	if (runtime.containerRuntime !== "podman") {
		return;
	}

	const check = await runCommand("docker", ["compose", "version"], {
		cwd: process.cwd(),
		timeoutMs: 10_000,
		env: runtime.env,
	});
	if (check.exitCode === 0) {
		return;
	}

	const combinedOutput = `${check.stdout}\n${check.stderr}`;
	if (isMissingComposeProviderError(combinedOutput)) {
		throw new Error(
			"Podman compose provider is missing. Install `podman-compose` (e.g. `uv tool install podman-compose`) or `docker-compose`, then verify with `docker compose version`.",
		);
	}
}

function createRunId(): string {
	return new Date().toISOString().replace(/[:.]/g, "-");
}

export async function runOfficialTerminalBench(options: {
	configPath: string;
	overrides: OfficialBenchOverrides;
}): Promise<OfficialBenchSummary> {
	const config = await loadOfficialBenchConfig(options.configPath);
	const selectedAgentImportPath =
		options.overrides.agentImportPath || config.agentImportPath;
	const harborBinary = await resolveRequiredBinary("harbor");

	const runId = createRunId();
	const wrapperOutputDir = join(
		process.cwd(),
		"bench",
		"results",
		"official-wrapper",
		runId,
	);
	await mkdir(wrapperOutputDir, { recursive: true });
	const runtime = await resolveContainerRuntime(wrapperOutputDir);
	await ensureComposeAvailableForPodman(runtime);

	const args = buildHarborRunArgs(config, options.overrides);
	const timeoutMs =
		options.overrides.timeoutMs || config.timeoutMs || 3_600_000;
	const runEnv = { ...(runtime.env || {}) };
	if (selectedAgentImportPath) {
		runEnv.PYTHONPATH = buildPythonPathEnv(process.cwd(), runEnv.PYTHONPATH);
	}
	const effectiveRuntime: ContainerRuntimeResolution = {
		...runtime,
		env: runEnv,
	};
	const result = await runCommand(harborBinary, args, {
		cwd: process.cwd(),
		timeoutMs,
		env: effectiveRuntime.env,
	});

	const parsed = parseHarborRunOutput(`${result.stdout}\n${result.stderr}`);
	const rawStdoutPath = join(wrapperOutputDir, "harbor.stdout.log");
	const rawStderrPath = join(wrapperOutputDir, "harbor.stderr.log");
	const summaryPath = join(wrapperOutputDir, "summary.json");
	const summary: OfficialBenchSummary = {
		timestamp: new Date().toISOString(),
		command: {
			binary: harborBinary,
			args,
		},
		runtime: effectiveRuntime,
		exitCode: result.exitCode,
		timedOut: result.timedOut,
		durationMs: result.durationMs,
		errorMessage:
			result.exitCode !== 0
				? extractHarborErrorMessage(`${result.stderr}\n${result.stdout}`)
				: undefined,
		metrics: {
			resolvedTrials: parsed.resolvedTrials,
			unresolvedTrials: parsed.unresolvedTrials,
			accuracyPercent: parsed.accuracyPercent,
			passAtK: parsed.passAtK,
		},
		runOutputPath: parsed.runOutputPath,
		artifacts: {
			rawStdoutPath,
			rawStderrPath,
			summaryPath,
		},
	};

	summary.errorMessage = normalizeHarborFailureMessage({
		rawMessage: summary.errorMessage,
		args,
		dataset: options.overrides.dataset || config.dataset,
	});

	await Promise.all([
		writeFile(rawStdoutPath, result.stdout, "utf-8"),
		writeFile(rawStderrPath, result.stderr, "utf-8"),
		writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf-8"),
	]);

	return summary;
}
