import { describe, expect, it } from "vitest";
import {
	buildHarborRunArgs,
	buildPythonPathEnv,
	buildRuntimePathEnv,
	createDockerShimScript,
	extractHarborErrorMessage,
	isMissingComposeProviderError,
	isPodmanBackedDockerVersionOutput,
	normalizeHarborFailureMessage,
	parseDockerHostCandidate,
	parseHarborRunOutput,
} from "../bench/official";

describe("terminal bench official runner (harbor tb2)", () => {
	it("builds harbor args with overrides", () => {
		const args = buildHarborRunArgs(
			{
				dataset: "terminal-bench@2.0",
				taskNames: ["a", "b"],
				agent: "oracle",
				nConcurrent: 1,
				nAttempts: 1,
			},
			{
				taskNames: ["single"],
				agent: "codex",
				nConcurrent: 2,
				nAttempts: 3,
				nTasks: 2,
				model: "openai/gpt-4.1-mini",
				agentKwargs: {
					foo: "bar",
				},
			},
		);

		expect(args).toEqual([
			"run",
			"--dataset",
			"terminal-bench@2.0",
			"--agent",
			"codex",
			"--model",
			"openai/gpt-4.1-mini",
			"--n-concurrent",
			"2",
			"--n-attempts",
			"3",
			"--n-tasks",
			"2",
			"--agent-kwarg",
			"foo=bar",
			"--task-name",
			"single",
		]);
	});

	it("builds harbor args with explicit registry url", () => {
		const args = buildHarborRunArgs(
			{
				dataset: "terminal-bench@2.0",
				registryUrl:
					"https://raw.githubusercontent.com/laude-institute/harbor/main/registry.json?source=wingman",
				agent: "oracle",
			},
			{},
		);

		expect(args).toEqual([
			"run",
			"--dataset",
			"terminal-bench@2.0",
			"--registry-url",
			"https://raw.githubusercontent.com/laude-institute/harbor/main/registry.json?source=wingman",
			"--agent",
			"oracle",
		]);
	});

	it("builds harbor args without task names when running all dataset tasks", () => {
		const args = buildHarborRunArgs(
			{
				dataset: "terminal-bench@2.0",
				agent: "oracle",
				nConcurrent: 1,
			},
			{ taskNames: [] },
		);

		expect(args).toEqual([
			"run",
			"--dataset",
			"terminal-bench@2.0",
			"--agent",
			"oracle",
			"--n-concurrent",
			"1",
		]);
	});

	it("builds harbor args with custom import-path agent", () => {
		const args = buildHarborRunArgs(
			{
				dataset: "terminal-bench@2.0",
				taskNames: ["hello-world"],
				agent: "oracle",
				agentImportPath: "my_pkg.my_agent:MyAgent",
				agentKwargs: {
					wingman_agent: "coding",
					model_name: "should-not-pass",
				},
				nConcurrent: 1,
			},
			{
				agentKwargs: {
					wingman_cli_path: "./bin/wingman",
				},
			},
		);

		expect(args).toEqual([
			"run",
			"--dataset",
			"terminal-bench@2.0",
			"--agent-import-path",
			"my_pkg.my_agent:MyAgent",
			"--n-concurrent",
			"1",
			"--agent-kwarg",
			"wingman_agent=coding",
			"--agent-kwarg",
			"wingman_cli_path=./bin/wingman",
			"--task-name",
			"hello-world",
		]);
	});

	it("parses resolved/unresolved/accuracy and pass@k", () => {
		const parsed = parseHarborRunOutput(`
│ Resolved Trials   │ 1        │
│ Unresolved Trials │ 1        │
│ Accuracy          │ 50.00%   │
│ Pass@1            │ 50.00%   │
Results saved to /tmp/harbor/runs/run-1
`);

		expect(parsed.resolvedTrials).toBe(1);
		expect(parsed.unresolvedTrials).toBe(1);
		expect(parsed.accuracyPercent).toBe(50);
		expect(parsed.passAtK["1"]).toBe(50);
		expect(parsed.runOutputPath).toBe("/tmp/harbor/runs/run-1");
	});

	it("builds a docker shim script and path for podman fallback", () => {
		const script = createDockerShimScript("/usr/local/bin/podman");
		expect(script).toContain("TARGET_BINARY='/usr/local/bin/podman'");
		expect(script).toContain("exec podman-compose");
		expect(script).toContain("exec podman cp");
		expect(script).toContain("exec podman exec");
		expect(script).toContain("label=com.docker.compose.project");
		expect(script).toContain("--project-directory");
		expect(script.startsWith("#!/bin/bash")).toBe(true);
		expect(buildRuntimePathEnv("/tmp/runtime-bin", "/usr/bin")).toBe(
			"/tmp/runtime-bin:/usr/bin",
		);
		expect(buildPythonPathEnv("/tmp/repo", "/usr/lib/python")).toBe(
			"/tmp/repo:/usr/lib/python",
		);
	});

	it("extracts a concise harbor error message", () => {
		const message = extractHarborErrorMessage(`
Traceback...
ValueError: No tasks found matching pattern: jq-data-processing
`);
		expect(message).toBe(
			"ValueError: No tasks found matching pattern: jq-data-processing",
		);
	});

	it("extracts a specific dataset resolution error over generic fallback", () => {
		const message = extractHarborErrorMessage(`
Traceback...
ValueError: Error getting dataset terminal-bench@2.0
ValueError: Either datasets or tasks must be provided.
`);
		expect(message).toBe(
			"ValueError: Error getting dataset terminal-bench@2.0",
		);
	});

	it("rewrites generic empty-task selection error", () => {
		const message = normalizeHarborFailureMessage({
			rawMessage: "ValueError: Either datasets or tasks must be provided.",
			args: [
				"run",
				"--dataset",
				"terminal-bench@2.0",
				"--task-name",
				"heterogeneous-dates",
			],
			dataset: "terminal-bench@2.0",
		});
		expect(message).toBe(
			'No tasks matched "heterogeneous-dates" in dataset "terminal-bench@2.0". Verify task ids for Terminal-Bench 2.0.',
		);
	});

	it("normalizes podman docker host candidates", () => {
		expect(parseDockerHostCandidate("unix:///tmp/podman.sock")).toBe(
			"unix:///tmp/podman.sock",
		);
		expect(parseDockerHostCandidate("/tmp/podman.sock")).toBe(
			"unix:///tmp/podman.sock",
		);
		expect(parseDockerHostCandidate("'unix:///tmp/podman.sock'")).toBe(
			"unix:///tmp/podman.sock",
		);
		expect(parseDockerHostCandidate("<nil>")).toBeUndefined();
		expect(parseDockerHostCandidate(undefined)).toBeUndefined();
	});

	it("detects missing compose provider errors", () => {
		expect(
			isMissingComposeProviderError(`
Error: looking up compose provider failed
* exec: "podman-compose": executable file not found in $PATH
`),
		).toBe(true);
		expect(isMissingComposeProviderError("some other error")).toBe(false);
	});

	it("detects podman-backed docker version output", () => {
		expect(
			isPodmanBackedDockerVersionOutput("Emulate Docker CLI using podman"),
		).toBe(true);
		expect(isPodmanBackedDockerVersionOutput("Docker version 27.0.0")).toBe(
			false,
		);
	});
});
