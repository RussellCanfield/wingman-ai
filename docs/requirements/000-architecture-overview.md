# Wingman Architecture Overview

**Version:** 1.0
**Status:** Active
**Last Updated:** 2026-01-23

---

## Executive Summary

Wingman is a two-part AI agent ecosystem:

1. **Wingman CLI** - A local AI agent framework that runs on your machine, supporting multiple model providers and customizable agent configurations
2. **Wingman Gateway** - A distributed communication hub that enables multi-agent collaboration across devices, allowing AI agents to communicate as a team

The vision is simple: run AI agents locally with full control, and optionally connect them through a gateway to collaborate with other agents and devices.

---

## Core Principles

### 1. Stateless Gateway, Stateful Nodes
The gateway is a pure message router. It does not store conversation history or agent state. Each node (CLI, agent, UI) maintains its own state, enabling horizontal scaling and fault tolerance.

### 2. Bidirectional Rooms
When devices join a broadcast group (room), all members see all messages - user prompts AND agent responses. This creates a shared workspace where multiple agents can observe and collaborate.

### 3. Agent Discretion Model
Agents decide autonomously whether to act on messages based on their system prompt. There's no explicit routing or @mentions required - agents self-select based on context, enabling natural team-like behavior.

### 4. Independent Agent Streams
Multiple agents in a room produce separate output streams. There's no built-in aggregation - each agent's response flows independently. Orchestration is opt-in via parent agents with subagents.

### 5. Protocol-First Design
The gateway forwards raw agent streams (matching CLI streaming format). UI layers interpret these streams for display. This enables any client (mobile, web, terminal) to consume the same protocol.

### 6. Flexible Provider Support
Support for multiple model providers through API keys today, with OAuth/subscription authentication (Copilot, Codex, Claude subscriptions) planned for future.

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

### Part 1: Wingman CLI

The CLI is the primary interface for running agents locally.

| Component | Purpose | Documentation |
|-----------|---------|---------------|
| **Multi-Agent System** | Root orchestrator + specialized subagents (coder, researcher, planner, implementor, reviewer) | [PRD-001](001-multi-agent-architecture.md) |
| **Custom Agents** | User-defined agents via declarative JSON configuration | [PRD-002](002-custom-agents-configuration.md) |
| **Direct Invocation** | CLI commands for running specific agents without orchestration | [PRD-003](003-cli-direct-invocation.md) |
| **Hooks System** | Custom shell commands at agent lifecycle points | [PRD-004](004-hooks-system.md) |
| **Session Management** | Persistent conversations with SQLite storage | [PRD-002](002-session-based-cli.md) |

### Part 2: Wingman Gateway

The Gateway enables distributed agent collaboration.

| Component | Purpose | Documentation |
|-----------|---------|---------------|
| **WebSocket Server** | Real-time bidirectional communication | [PRD-005](005-gateway-prd.md) |
| **Broadcast Groups (Rooms)** | Message routing to group members | [PRD-005](005-gateway-prd.md) |
| **Node Management** | Registration, heartbeat, capabilities | [PRD-005](005-gateway-prd.md) |
| **Discovery** | mDNS (LAN) and Tailscale (VPN) discovery | [PRD-005](005-gateway-prd.md) |

---

## Message Flow Patterns

### Pattern 1: Local Agent Execution (CLI Only)

```
User ──▶ CLI ──▶ Agent ──▶ Tool Execution ──▶ Response ──▶ User
                   │
                   └──▶ Session (SQLite) - State persisted locally
```

No gateway involved. Agent runs locally with full context from session.

### Pattern 2: Multi-Agent Collaboration (Gateway)

```
User (Laptop)
     │
     │ "Review the auth code"
     ▼
┌─────────────────────────────────────────────────────────────┐
│                        GATEWAY                               │
│                                                              │
│    Room: "project-alpha"                                     │
│    ┌─────────────────────────────────────────────────────┐  │
│    │  Broadcast to all members                            │  │
│    │                                                      │  │
│    │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │  │
│    │  │ Mobile   │  │ Desktop  │  │ Server   │          │  │
│    │  │ (UI)     │  │ (review) │  │ (research)│          │  │
│    │  └────┬─────┘  └────┬─────┘  └────┬─────┘          │  │
│    │       │              │              │                │  │
│    └───────┼──────────────┼──────────────┼────────────────┘  │
│            │              │              │                    │
└────────────┼──────────────┼──────────────┼────────────────────┘
             │              │              │
             ▼              ▼              ▼
         Display     "Is this for    "Is this for
         message       me? YES"        me? YES"
                          │              │
                          ▼              ▼
                    Review code    Research auth
                          │        best practices
                          │              │
                          └──────┬───────┘
                                 │
                                 ▼
                          Both responses
                          broadcast back
                          to all members
```

**Key behaviors:**
1. User message broadcasts to all room members
2. Each agent autonomously decides whether to respond
3. Agent responses stream back through gateway
4. All members see all responses (including the originating laptop)
5. Senders ignore their own messages to prevent feedback loops

### Pattern 3: Agent Swarm (Parallel Processing)

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
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│   │   Anthropic  │  │    OpenAI    │  │   (Future)   │     │
│   │              │  │              │  │              │     │
│   │ claude-opus  │  │   gpt-4o     │  │   copilot    │     │
│   │ claude-sonnet│  │   gpt-4-turbo│  │   codex      │     │
│   └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│   Authentication: API Keys (ANTHROPIC_API_KEY, etc.)        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Future: Subscription Provider Support

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

The goal is flexible adoption - use what you have, whether that's API keys or existing subscriptions.

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
│   Node A ──▶ WebSocket ──▶ Message Router ──▶ Room Lookup   │
│              Server            │                  │          │
│                                │                  ▼          │
│                                │           Get Room Members  │
│                                │                  │          │
│                                ▼                  ▼          │
│                           Rate Limiter ──▶ Broadcast to      │
│                                │           Members           │
│                                │           (except sender)   │
│                                │                  │          │
│                                │          ┌──────┴──────┐   │
│                                │          ▼             ▼   │
│                                │      Node B        Node C   │
│                                │                             │
│                                └─────────────────────────────┤
│                                                              │
│   Note: Gateway is STATELESS                                │
│   - No conversation history                                 │
│   - No message persistence                                  │
│   - Pure routing                                            │
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
│   $ wingman agent --agent coder │
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
│   (Gateway)   │◀──▶│   (Agent)     │◀──▶│    (UI)       │
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
│   │ Gateway  │◀──────▶│  Agent   │◀──────▶│  Agent   │      │
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

### Phase 2: Gateway Core (In Progress)
- WebSocket communication
- Broadcast groups (rooms)
- Node management
- Authentication
- Rate limiting

### Phase 3: Discovery & Connectivity
- mDNS/Bonjour discovery
- Tailscale integration
- HTTP bridge (firewall traversal)

### Phase 4: Provider Expansion
- Provider abstraction layer
- OAuth flow implementation
- Copilot/Codex integration

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
| [PRD-002: Custom Agents](002-custom-agents-configuration.md) | Declarative agent configuration |
| [PRD-002: Session-Based CLI](002-session-based-cli.md) | Persistent conversations |
| [PRD-003: CLI Direct Invocation](003-cli-direct-invocation.md) | Command-line interface |
| [PRD-004: Hooks System](004-hooks-system.md) | Lifecycle hooks |
| [PRD-005: Gateway](005-gateway-prd.md) | Distributed communication |

---

**Document Owner:** Wingman-AI Team
**Status:** Active
