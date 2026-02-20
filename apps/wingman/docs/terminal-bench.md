# Terminal Bench

This project includes a local Terminal Bench harness for evaluating coding-agent runs and producing a score.

## Quick start

```bash
bun run bench:terminal:smoke
bun run bench:terminal:quick
bun run bench:terminal:official
```

This runs a deterministic smoke suite with a command adapter and writes results to `bench/results/<run-id>/`.
`bench:terminal:quick` runs a real Wingman coding-agent task (single task) for fast validation.
`bench:terminal:official` runs official Terminal-Bench 2.0 tasks through Harbor.

## Run against the Wingman coding agent

1. Ensure provider credentials are configured for your local agent.
2. Edit `bench/config.json` if you need a different agent/model setup.
3. Run:

```bash
bun run bench:terminal
```

The script prints score metrics and writes full artifacts to `bench/results/<run-id>/`:

- `summary.json`: machine-readable aggregate scores
- `summary.md`: human-readable summary
- `<task-id>.stdout.log`: raw adapter stdout
- `<task-id>.stderr.log`: raw adapter stderr
- `<task-id>.assistant.txt`: normalized assistant text
- `<task-id>.result.json`: per-task result object

## Config files

- `bench/config.json`: default coding-agent benchmark config
- `bench/config.smoke.json`: deterministic local smoke config
- `bench/config.quick.json`: one-task real coding-agent config
- `bench/config.tb2.json`: official Terminal-Bench 2.0 (Harbor) config
- `bench/config.tb2-wingman.json`: official TB2 config using Wingman bridge agent
- `bench/tasks/coding-agent.json`: sample coding-agent task suite
- `bench/tasks/smoke.json`: smoke task suite
- `bench/tasks/quick-one.json`: one-task quick suite

## Official Terminal-Bench 2.0 (Harbor)

Prerequisites:

- `harbor` CLI installed
- Container runtime available:
  - Docker (`docker`)
  - or Podman (`podman`) (Wingman auto-shims `docker` to Podman for Harbor)
  - If using Podman, a compose provider must be installed: `podman-compose` or `docker-compose`

Install Harbor (see Harbor docs for your platform):

```bash
harbor --help
podman --version # or docker --version
podman-compose --version # or docker-compose --version (Podman users)
```

Run with your TB2 config:

```bash
bun run bench:terminal:official
```

If Harbor cannot resolve datasets from the default registry, provide an explicit registry:

```bash
bun run bench:terminal:official:wingman -- \
  --registry-url "https://raw.githubusercontent.com/laude-institute/harbor/main/registry.json?source=wingman"
```

Run TB2 with Wingman bridge (defaults to Wingman `coding` agent):

```bash
bun run bench:terminal:official:wingman
```

Note: do not pass `model_name` via `--agent-kwarg` for import-path agents; Harbor injects that automatically.

Run one specific TB2 task:

```bash
bun run bench:terminal:official -- --task-name heterogeneous-dates
# alias supported:
bun run bench:terminal:official -- --task-id heterogeneous-dates
```

Run one specific TB2 task with Wingman bridge:

```bash
bun run bench:terminal:official:wingman -- --task-name heterogeneous-dates
```

Run two explicit task names:

```bash
bun run bench:terminal:official -- --task-name heterogeneous-dates --task-name fix-git
```

Run the full TB2 dataset (no task filter):

```bash
bun run bench:terminal:official -- --dataset terminal-bench@2.0 --all-tasks
```

Increase retries per task:

```bash
bun run bench:terminal:official -- --task-name heterogeneous-dates --n-attempts 3
```

Set retries and target a different Wingman local agent:

```bash
bun run bench:terminal:official:wingman -- \
  --task-name heterogeneous-dates \
  --n-attempts 3 \
  --wingman-agent research
```

Run 1-2 real TB2 tasks without knowing task ids in advance:

```bash
bun run bench:terminal:official:wingman -- --all-tasks --n-tasks 1
bun run bench:terminal:official:wingman -- --all-tasks --n-tasks 2
```

Results are written in two places:

- Harbor task results: printed as `Harbor output: ...` (contains `results.json`)
- Wingman wrapper logs: `bench/results/official-wrapper/<run-id>/summary.json`

## Scoring

`summary.json` includes:

- pass/fail rates
- duration metrics (`avgDurationMs`, `p95DurationMs`)
- token totals (`input`, `output`, `total`)
- cost estimates from token pricing in config
- `overallScore` (weighted aggregate)

Weights and budgets are configurable in `scoring`.

## Quality gate and baseline

Set `qualityGate.enabled: true` and configure `qualityGate.baselineFile` in `bench/config.json` to enforce regression thresholds.

Guardrails include:

- minimum pass-rate delta
- maximum cost increase ratio
- maximum average-duration increase ratio

Promote a run summary to baseline:

```bash
bun run bench:terminal:baseline
# or:
bun run bench:terminal:baseline -- --run-dir bench/results/<run-id>
```

## CI recommendation

- run `bun run bench:terminal:smoke` on pull requests
- run `bun run bench:terminal` nightly with real credentials
- upload `bench/results/<run-id>/` as CI artifacts
