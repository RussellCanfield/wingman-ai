<p align="center" width="100%">
  <img src="./apps/website/public/wingman_opengraph.png" alt="Wingman logo" />
</p>

# Wingman AI Agent System

Wingman is a **stateful, multi-agent runtime** with a **local CLI control plane** and a **gateway** for routing, sessions, and collaboration. It is designed for more than coding: use it for research, operations, support, planning, and any workflow where agents, tools, and durable context matter.

## What Wingman Is

- **Gateway-first runtime**: The gateway hosts agents, routing, and durable sessions by default.
- **Local control plane**: The CLI configures, invokes, and connects to the gateway, with an optional `--local` execution mode.
- **Multi-agent orchestration**: A root agent can delegate to specialized subagents with clear roles.
- **Protocol-first**: The gateway streams raw agent events so any client (web, mobile, terminal) can render them.
- **Tool-driven UI prompts (SGUI)**: tool calls can include UI render hints for Web UI components.
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
- **Wingman macOS App (planned)**: menu-bar companion that exposes macOS-only capabilities as a node

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
- `docs/requirements/003-macos-app-prd.md`
- `docs/requirements/004-node-protocol.md`
- `docs/requirements/005-web-ui-sgui-prd.md`
- `docs/custom-agents.md`

## Repository Layout

- `apps/macos`: macOS app (Xcode project)
- `apps/wingman`: Gateway + CLI + Control UI (Bun)
- `apps/docs-website`: documentation site (Rspress)
- `apps/website`: marketing site (Vite)
- `docs/requirements`: PRDs (source of truth)
- `docs/dev-setup.md`: local development guide

## Quick Start

### Install

```bash
npm install -g @wingman-ai/gateway
```

### Initialize a Workspace

```bash
wingman init
```

### Re-sync Bundled Agent Templates

```bash
wingman init --mode sync --only agents
wingman init --mode sync --only agents --agents main,coding
wingman init --mode sync --only agents --force
```

### Start the Gateway

```bash
wingman gateway start
```

### Gateway Auth (Environment Token)

```bash
export WINGMAN_GATEWAY_TOKEN=sk-...
wingman gateway start --auth
```

### Connect

- **CLI**: `wingman chat`
- **Control UI**: `http://localhost:18790` (default)
- **VS Code**: Install the Wingman extension (see project repo)

### Provider Auth

```bash
# Cloud providers
wingman provider login anthropic
wingman provider login openai
wingman provider login codex
wingman provider login openrouter
wingman provider login xai
wingman provider login copilot

# Local providers (optional - work without auth)
wingman provider login lmstudio  # Optional
wingman provider login ollama     # Optional
```

### Local-only (No Gateway)

```bash
wingman agent --local --agent <id> "prompt"
```

## Secure Skills + MCP Proxy (TL;DR)

Main point: skill scanning and MCP proxy are separate toggles, both explicit, and `uv` checks only happen when the feature is enabled.

Key CLI commands:

```bash
# gateway auth token
wingman gateway token --generate
export WINGMAN_GATEWAY_TOKEN="<token>"

# gateway runtime
wingman gateway start

# skills
wingman skill browse
wingman skill install <skill-name>
wingman skill list
wingman skill remove <skill-name>
```

- Skill scan runs on each `wingman skill install` only when `skills.security.scanOnInstall` is enabled.
- MCP proxy runs at agent runtime only when `gateway.mcpProxy.enabled` is enabled.
- If `uv` is missing for an enabled feature, Wingman fails with an error (no interactive prompt).
- Full config examples: `../docs-website/docs/configuration/skills.mdx`, `../docs-website/docs/configuration/gateway.mdx`, `../docs-website/docs/configuration/wingman-config.mdx`.

## Configuration

Where to configure:

- Runtime flags: `wingman gateway start --help`
- Environment secret: `WINGMAN_GATEWAY_TOKEN`
- Persistent config: `.wingman/wingman.config.json`
- JSON schema: `https://getwingmanai.com/schemas/wingman.config.schema.json`

Docs (full examples):

- Gateway: `../docs-website/docs/configuration/gateway.mdx`
- Skills: `../docs-website/docs/configuration/skills.mdx`
- Full config: `../docs-website/docs/configuration/wingman-config.mdx`

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
- **Bundled MCP servers** for finance (`bun run mcp:finance`) and FAL AI multimodal generation (`bun run mcp:fal-ai`).

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
cd apps/wingman
bun run build
```

### Run Gateway (with Control UI)

```bash
cd apps/wingman
./bin/wingman gateway start
```

### Run Gateway + Web UI (hot reload)

```bash
cd apps/wingman
bun run dev
```

### Tests

```bash
cd apps/wingman
bun run test
```

### Config and Logs

- Config: `apps/wingman/.wingman/wingman.config.json`
- Logs: `~/.wingman/logs/wingman.log`

## Contributing Expectations

- Keep `docs/requirements/` current for any behavior changes.
- Add tests for new functionality.
- Ensure all tests and builds pass before submitting.

## License

See `LICENSE.txt`.
