<p align="center" width="100%">
  <img src="./docs/Logo.png" alt="Wingman logo" />
</p>

# Wingman AI Agent System

Wingman is a **stateful, multi-agent runtime** with a **local CLI control plane** and a **gateway** for routing, sessions, and collaboration. It is designed for more than coding: use it for research, operations, support, planning, and any workflow where agents, tools, and durable context matter.

## What Wingman Is

- **Gateway-first runtime**: The gateway hosts agents, routing, and durable sessions by default.
- **Local control plane**: The CLI configures, invokes, and connects to the gateway, with an optional `--local` execution mode.
- **Multi-agent orchestration**: A root agent can delegate to specialized subagents with clear roles.
- **Protocol-first**: The gateway streams raw agent events so any client (web, mobile, terminal) can render them.
- **Extensible**: Custom agents, hooks, skills, and MCP tools let you tailor workflows to your team.

## What It’s For (Not Just Coding)

Wingman is an agent system, not a single “coding assistant.” Example use cases:

- **Engineering**: design reviews, refactors, dependency audits, multi-file changes, test automation
- **Research**: technology evaluations, competitive analysis, documentation synthesis
- **Operations**: scheduled routines, webhook-driven triage, incident summaries
- **Support**: channel routing, account-specific agents, structured responses
- **Custom domains**: finance, legal, data pipelines, or any workflow with tool integrations

## Architecture at a Glance

- **Wingman Gateway**: stateful runtime for agents, routing, sessions, and channels
- **Wingman CLI**: local control plane for onboarding, config, and agent invocation
- **Control UI**: chat + streaming interface (served by the gateway)

By default, the CLI connects to a local gateway. For isolated, local-only runs, use `--local`.

## Documentation Gate (Source of Truth)

**All product requirements live in `docs/requirements/`.** These PRDs are the source of truth and act as a documentation gate:

- Any product or behavior change must update the relevant PRD(s).
- PRs are expected to keep requirements and implementation in sync.
- Legacy docs outside `docs/requirements/` (including any historical docs-site content) should not be used for product decisions.

Key docs:
- `docs/requirements/000-architecture-overview.md`
- `docs/requirements/001-multi-agent-architecture.md`
- `docs/requirements/002-gateway-prd.md`
- `docs/custom-agents.md`

## Quick Start

### Install

```bash
npm install -g @wingman-ai/gateway
```

### Initialize a Workspace

```bash
wingman init
```

### Start the Gateway

```bash
wingman gateway start
```

### Connect

- **CLI**: `wingman chat`
- **Control UI**: `http://localhost:18790` (default)
- **VS Code**: Install the Wingman extension (see project repo)

### Provider Auth

```bash
wingman provider login anthropic
wingman provider login openai
```

### Local-only (No Gateway)

```bash
wingman agent --local --agent <id> "prompt"
```

## Core Concepts

- **Deterministic routing**: bindings map inbound messages to a single agent by default.
- **Durable sessions**: sessions live in the gateway and persist across clients/devices.
- **Agent isolation**: each agent has its own workspace, config, and session store.
- **Explicit broadcast**: rooms enable parallel agent responses when requested.

## Capabilities

- **Channels + bindings** for deterministic routing across accounts and peers.
- **Routines** for scheduled runs and repeatable workflows.
- **Webhooks** to trigger agents from external systems.
- **Hooks** for pre/post tool automation.
- **Skills** for reusable, domain-specific instruction sets.
- **MCP tools** to connect external systems and custom integrations.

## Development

### Prerequisites

- Bun (required for `bun:sqlite` support)
- Node.js (for tools outside Bun)

### Install

```bash
bun install
```

### Build

```bash
cd wingman
bun run build
```

### Run Gateway (with Control UI)

```bash
cd wingman
./bin/wingman gateway start
```

### Run Gateway + Web UI (hot reload)

```bash
cd wingman
bun run dev
```

### Tests

```bash
cd wingman
bun run test
```

### Config and Logs

- Config: `wingman/.wingman/wingman.config.json`
- Logs: `~/.wingman/logs/wingman.log`

## Contributing Expectations

- Keep `docs/requirements/` current for any behavior changes.
- Add tests for new functionality.
- Ensure all tests and builds pass before submitting.

## License

See `LICENSE.txt`.
