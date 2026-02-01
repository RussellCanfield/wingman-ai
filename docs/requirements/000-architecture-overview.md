# Wingman Architecture Overview

**Version:** 1.1
**Status:** Active
**Last Updated:** 2026-02-01

---

## Executive Summary

Wingman is a three-part AI agent ecosystem:

1. **Wingman Gateway** - A central runtime that hosts agents, sessions, routing, and channels with durable state
2. **Wingman CLI** - A control plane for configuration and invocation; defaults to gateway execution with a `--local` override
3. **Wingman macOS App (Planned)** - A menu-bar companion that manages macOS permissions, attaches to the gateway, and exposes macOS-only capabilities as a node

The vision is simple: run agents through a local gateway with durable state, and optionally connect additional devices and channels for collaboration.

---

## Core Principles

### 1. Stateful Gateway, Durable Sessions
The gateway hosts the agent runtime and owns the session store. Durable state lives in the gateway, not in clients.

### 2. Deterministic Routing
Inbound messages are routed by bindings using most-specific-first matching. One agent is selected per message unless an explicit broadcast is requested.

### 3. Agent Isolation
Each agent has its own workspace, agent directory, auth profiles, and session store. Credentials are not shared by default.

### 4. Broadcast Is Explicit
Rooms enable parallel agent responses, but broadcasts are opt-in. The default path is a single agent per inbound message.

### 5. Protocol-First Design
The gateway forwards raw agent streams (matching CLI streaming format). UI layers interpret these streams for display. This enables any client (mobile, web, terminal) to consume the same protocol.
Tool events may include UI render hints so clients can display static generative UI prompts when user input is required.

### 6. Flexible Provider Support
Support for multiple model providers via API keys and stored subscription tokens today. OAuth/device-code flows remain planned.

### 7. Extensible Ingress
Inbound triggers can come from Control UI, channels, scheduled routines, and planned webhook integrations.

---

## System Topology

```
                              WINGMAN ECOSYSTEM
    ┌───────────────────────────────────────────────────────────────────┐
    │                                                                    │
    │   LOCAL EXECUTION                      DISTRIBUTED COLLABORATION   │
    │   ──────────────                       ─────────────────────────   │
    │                                                                    │
    │   ┌────────────────┐                   ┌────────────────────────┐ │
    │   │  Wingman CLI   │                   │   Wingman Gateway      │ │
    │   │                │                   │                        │ │
    │   │  ┌──────────┐  │    WebSocket      │  ┌──────────────────┐ │ │
    │   │  │  Agent   │──┼───────────────────┼─▶│  Room: "team-1"  │ │ │
    │   │  │ (coder)  │  │                   │  │  Members: [...]  │ │ │
    │   │  └──────────┘  │                   │  └──────────────────┘ │ │
    │   │                │                   │                        │ │
    │   │  ┌──────────┐  │                   │  ┌──────────────────┐ │ │
    │   │  │  Session │  │                   │  │  Room: "team-2"  │ │ │
    │   │  │ (SQLite) │  │                   │  │  Members: [...]  │ │ │
    │   │  └──────────┘  │                   │  └──────────────────┘ │ │
    │   │                │                   │                        │ │
    │   │  ┌──────────┐  │                   └───────────┬────────────┘ │
    │   │  │  Hooks   │  │                               │              │
    │   │  │ (Custom) │  │                               │              │
    │   │  └──────────┘  │                   ┌───────────┼───────────┐  │
    │   └────────────────┘                   │           │           │  │
    │                                        ▼           ▼           ▼  │
    │                                   ┌────────┐ ┌────────┐ ┌────────┐│
    │                                   │Mobile  │ │Desktop │ │Server  ││
    │                                   │App     │ │Agent   │ │Agent   ││
    │                                   │(UI)    │ │(review)│ │(research)│
    │                                   └────────┘ └────────┘ └────────┘│
    │                                                                    │
    └───────────────────────────────────────────────────────────────────┘
```

---

## Component Overview

Default operation uses the gateway runtime. Local execution remains available through `--local` for CLI-only workflows.

### Part 1: Wingman CLI

The CLI is the primary interface for configuring the gateway and invoking agents.

| Component | Purpose | Documentation |
|-----------|---------|---------------|
| **Gateway Control** | Start/stop, status, auth, and connection management | [PRD-002](002-gateway-prd.md) |
| **Agent Invocation** | Run agents via gateway (default) or locally with `--local` | [PRD-001](001-multi-agent-architecture.md) |
| **Onboarding** | Bootstrap workspace config + starter agent with `wingman init` | This document |
| **Custom Agents** | User-defined agents via declarative JSON configuration | [Custom Agents Guide](../custom-agents.md) |
| **Hooks System** | Custom shell commands at agent lifecycle points | [PRD-001](001-multi-agent-architecture.md) |
| **Session Management** | Local sessions when running with `--local` | [PRD-001](001-multi-agent-architecture.md) |

### CLI Onboarding (wingman init)

`wingman init` creates a workspace `.wingman/wingman.config.json`, adds the current
workspace to `gateway.fsRoots`, and copies bundled agent templates from the package
`.wingman/agents/` into `.wingman/agents/` in the workspace. It can optionally store
provider credentials and set a default model.

When run interactively, the init wizard lets users pick a default agent and choose
which bundled agents to copy.

### Part 2: Wingman Gateway

The Gateway is the central runtime for agents, sessions, routing, and channels.

| Component | Purpose | Documentation |
|-----------|---------|---------------|
| **Agent Runtime** | Host agent instances and subagents | [PRD-002](002-gateway-prd.md) |
| **Routing Bindings** | Deterministic agent selection per message | [PRD-002](002-gateway-prd.md) |
| **Session Store** | Durable session storage (SQLite) | [PRD-002](002-gateway-prd.md) |
| **Channels + Control UI** | Inbound/outbound message adapters and web chat | [PRD-002](002-gateway-prd.md) |
| **Broadcast Rooms** | Explicit parallel responses when requested | [PRD-002](002-gateway-prd.md) |
| **Webhook Ingress (Planned)** | External systems trigger agent runs | [PRD-002](002-gateway-prd.md) |

### Part 3: Wingman macOS App (Planned)

The macOS app is a menu-bar companion that handles macOS permissions and exposes
macOS-only capabilities to the gateway as a node.

**Responsibilities:**
- Own TCC prompts (Notifications, Accessibility, Screen Recording, Microphone, Speech)
- Attach to a local gateway (launchd-managed) or connect to a remote gateway
- Host a local node service that exposes macOS tools (screen, camera, system.run)
- Provide native status and notifications in the menu bar

| Component | Purpose | Documentation |
|-----------|---------|---------------|
| **macOS App** | Menu-bar companion for permissions and macOS tools | [PRD-003](003-macos-app-prd.md) |
| **Node Protocol (Planned)** | Node connect/invoke and pairing flow | [PRD-004](004-node-protocol.md) |
| **Web UI SGUI (Planned)** | Static generative UI registry and components | [PRD-005](005-web-ui-sgui-prd.md) |

---

## Message Flow Patterns

### Pattern 1: Local Agent Execution (CLI --local)

```
User ──▶ CLI ──▶ Agent ──▶ Tool Execution ──▶ Response ──▶ User
                   │
                   └──▶ Session (SQLite) - State persisted locally
```

No gateway involved. Agent runs locally with a local session store.

### Pattern 2: Gateway Routed Execution (Default)

```
Inbound message (UI/channel/CLI)
            |
            v
┌───────────────────────────────────────────────┐
│                    GATEWAY                    │
│  - bindings router (most-specific-first)      │
│  - session store (SQLite)                     │
│  - agent runtime                              │
└───────────────────────────────────────────────┘
            |
            v
Selected agent executes and streams response
            |
            v
Reply returns to the originating channel/thread
```

**Key behaviors:**
1. Message is normalized by the channel and routed by bindings
2. Session key is derived from agent + channel identity
3. Gateway loads session and runs the selected agent
4. Response streams back to the same channel or UI

### Pattern 3: Explicit Broadcast (Rooms)

```
                    User Prompt: "Optimize this function"
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
              ┌──────────┐   ┌──────────┐   ┌──────────┐
              │ Agent A  │   │ Agent B  │   │ Agent C  │
              │ (perf)   │   │ (clean)  │   │ (secure) │
              └────┬─────┘   └────┬─────┘   └────┬─────┘
                   │              │              │
                   ▼              ▼              ▼
             "Use memoize"  "Extract fn"  "Add validation"
                   │              │              │
                   └──────────────┴──────────────┘
                                  │
                                  ▼
                        3 Independent Streams
                        shown in parallel in UI
```

Each agent produces independent output. No built-in aggregation - the UI displays all streams. If you want coordinated output, use an orchestrating agent with subagents.

---

## Provider Model

### Current Implementation

```
┌─────────────────────────────────────────────────────────────┐
│                    Provider Interface                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Cloud Providers:                                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────┐│
│  │   Anthropic  │ │    OpenAI    │ │  OpenRouter  │ │ xAI ││
│  │ claude-opus  │ │   gpt-4o     │ │  any model   │ │grok ││
│  │ claude-sonnet│ │   gpt-4-turbo│ │              │ │     ││
│  └──────────────┘ └──────────────┘ └──────────────┘ └─────┘│
│                                                              │
│  Subscription:                                               │
│  ┌──────────────┐                                            │
│  │GitHub Copilot│                                            │
│  │   gpt-4o     │                                            │
│  └──────────────┘                                            │
│                                                              │
│  Local Inference:                                            │
│  ┌──────────────┐ ┌──────────────┐                          │
│  │  LM Studio   │ │    Ollama    │                          │
│  │ localhost:   │ │ localhost:   │                          │
│  │   1234       │ │   11434      │                          │
│  └──────────────┘ └──────────────┘                          │
│                                                              │
│  Authentication:                                             │
│  - API keys via env: ANTHROPIC_API_KEY, OPENAI_API_KEY,      │
│    OPENROUTER_API_KEY, XAI_API_KEY                          │
│  - Subscription tokens in ~/.wingman/credentials.json        │
│  - Local providers: Optional (no auth required)              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### OAuth Subscription Flows

```
┌─────────────────────────────────────────────────────────────┐
│                    Provider Interface                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌────────────────────────────────────────────────────┐    │
│   │                  API Key Providers                  │    │
│   │   Anthropic, OpenAI, Google, etc.                  │    │
│   └────────────────────────────────────────────────────┘    │
│                                                              │
│   ┌────────────────────────────────────────────────────┐    │
│   │              Subscription Providers                 │    │
│   │   ┌──────────┐  ┌──────────┐  ┌──────────┐        │    │
│   │   │  GitHub  │  │  Claude  │  │  OpenAI  │        │    │
│   │   │  Copilot │  │   Max    │  │   Plus   │        │    │
│   │   │  (OAuth) │  │  (OAuth) │  │  (OAuth) │        │    │
│   │   └──────────┘  └──────────┘  └──────────┘        │    │
│   └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

OAuth flows are planned; today, `wingman provider login` stores subscription tokens locally.

---

## Data Flow

### CLI Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   User Input ──▶ AgentInvoker ──▶ DeepAgent ──▶ LLM         │
│                       │              │                       │
│                       │              ├──▶ Tools              │
│                       │              │     (command_execute, │
│                       │              │      web_crawler,     │
│                       │              │      internet_search) │
│                       │              │                       │
│                       ▼              ▼                       │
│                  SessionManager   Streaming                  │
│                  (SQLite)         Output                     │
│                       │              │                       │
│                       └──────────────┼───────────────────────┤
│                                      ▼                       │
│                               OutputManager                  │
│                               (Interactive UI                │
│                                or JSON mode)                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Gateway Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                       GATEWAY                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Inbound Message                                              │
│       │                                                      │
│       ▼                                                      │
│  Channel Adapter / Control UI                                │
│       │                                                      │
│       ▼                                                      │
│  Router (bindings, most-specific-first)                      │
│       │                                                      │
│       ▼                                                      │
│  Session Store (SQLite)                                      │
│       │                                                      │
│       ▼                                                      │
│  Agent Runtime                                               │
│       │                                                      │
│       ▼                                                      │
│  Response to originating channel/thread                      │
│                                                              │
│  Note: Gateway is STATEFUL                                   │
│  - Durable sessions                                          │
│  - Routing bindings and agent registry                       │
│  - Channel and UI adapters                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Deployment Scenarios

### Scenario 1: Local Development (CLI Only)

```
Developer's Machine
┌─────────────────────────────────┐
│                                  │
│   Terminal                       │
│   $ wingman agent --local --agent coder │
│                                  │
│   ┌────────────────────────────┐│
│   │ Wingman CLI                ││
│   │ - Agent: coder             ││
│   │ - Session: local SQLite    ││
│   │ - Provider: Anthropic      ││
│   └────────────────────────────┘│
│                                  │
└─────────────────────────────────┘
```

### Scenario 2: Home Office Multi-Device

```
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│    Desktop    │    │    Laptop     │    │    Mobile     │
│   (Gateway)   │◀──▶│    (CLI)      │◀──▶│    (UI)       │
└───────────────┘    └───────────────┘    └───────────────┘
        │                    │                    │
        └────────────────────┴────────────────────┘
                    LAN (mDNS Discovery)
```

### Scenario 3: Distributed Team (Tailscale)

```
┌─────────────────────────────────────────────────────────────┐
│                    Tailscale Network                         │
│                                                              │
│   Location A           Location B           Location C       │
│   ┌──────────┐        ┌──────────┐        ┌──────────┐      │
│   │ Gateway  │◀──────▶│  Client  │◀──────▶│  Client  │      │
│   │ (server) │        │ (laptop) │        │ (mobile) │      │
│   └──────────┘        └──────────┘        └──────────┘      │
│                                                              │
│   All nodes discover each other via Tailscale MagicDNS      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Future Roadmap

### Phase 1: CLI Foundation (Complete)
- Multi-agent architecture
- Custom agent configuration
- Session persistence
- Hooks system
- Direct agent invocation

### Phase 2: Gateway Runtime (In Progress)
- Agent registry and runtime
- Deterministic routing and bindings
- Session store (SQLite)
- Control UI (web chat)
- WebSocket API + authentication

### Phase 3: Discovery & Connectivity
- Tailscale-friendly access patterns
- mDNS/Bonjour discovery
- HTTP bridge (firewall traversal)

### Phase 4: Provider Expansion
- Provider abstraction layer
- Additional OAuth/device-code flow implementation
- Additional subscription integrations (Codex, Claude Max)

### Phase 5: Consumer Ecosystem
- Reference mobile app
- Reference web UI
- Slack/Teams adapters

### Phase 6: Advanced Collaboration
- Multi-gateway routing
- End-to-end encryption
- RBAC (role-based access)
- Audit logging

---

## Related Documents

| Document | Description |
|----------|-------------|
| [PRD-001: Multi-Agent Architecture](001-multi-agent-architecture.md) | Agent hierarchy and orchestration |
| [PRD-002: Gateway](002-gateway-prd.md) | Gateway runtime, routing, sessions, and channels |
| [Custom Agents Guide](../custom-agents.md) | Declarative agent configuration |

---

**Document Owner:** Wingman-AI Team
**Status:** Active
