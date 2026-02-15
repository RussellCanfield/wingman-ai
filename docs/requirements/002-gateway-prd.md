# Wingman Gateway - Product Requirements Document

## Overview

The Wingman Gateway is the central runtime for agents, sessions, routing, and channels. It accepts inbound messages from channels and clients (CLI, Control UI), routes deterministically to a single agent via bindings, loads durable session state, runs the agent, and streams the response back to the originating channel. Broadcast rooms are an explicit opt-in for swarm scenarios.

**Version:** 1.8
**Status:** In Development
**Last Updated:** 2026-02-15

---

## Vision

The gateway enables a single, stateful runtime where:
- Inbound messages are routed deterministically to one agent by bindings
- Sessions are durable and owned by the gateway
- Multiple agents and channel accounts can run side-by-side with isolation
- Broadcast rooms are explicit for parallel responses
- Clients consume a shared streaming protocol for UI consistency

See [Architecture Overview](000-architecture-overview.md) for the full system context.

---

## Goals

### Primary Goals
1. Provide a **stateful runtime** for agents, sessions, routing, and channels
2. Enable **deterministic routing** with bindings (one agent per inbound message by default)
3. Support **multiple isolated agents** and multiple channel accounts in one gateway
4. Deliver a **Control UI** for chat and session creation (MVP)
5. Offer **secure access** with token auth and Tailscale-friendly deployment

### Secondary Goals
1. Support alternative transports (HTTP bridge, SSH tunnels) for firewall traversal
2. Enable horizontal scaling via multiple gateway instances
3. Maintain low latency for real-time agent collaboration
4. Optional discovery (mDNS, Tailscale)
5. **Protocol-first design** - generic protocol that any UI can consume

---

## Use Cases

### 1. Local Gateway + Control UI
**Scenario:** Developer runs the gateway on desktop and chats from phone via Control UI
**Flow:**
1. Start gateway on desktop: `wingman gateway start`
2. Open Control UI from local or tailnet address
3. Create a session and send a message
4. Gateway routes to the bound agent and streams the response

**Requirements:**
- Control UI with chat, streaming output, media attachments (image/audio + voice capture), and file uploads (.txt/.md/.csv/.json/.yaml/.yml/.xml/.log plus common code files and PDF)
- Token-based authentication
- Tailscale-friendly access patterns

### 2. Multi-Agent, Multi-Account Routing
**Scenario:** Two agents handle different channel accounts on one gateway
**Flow:**
1. Configure agents and bindings in `wingman.config.json`
2. Inbound messages are normalized with channel + account identity
3. Router selects one agent using most-specific-first matching
4. Gateway loads the agent's session and runs the turn

**Requirements:**
- Deterministic routing bindings
- Per-agent isolation (workspace, agentDir, sessions)
- Durable session store

### 3. Explicit Broadcast Swarm
**Scenario:** User requests parallel review from multiple agents
**Flow:**
1. User issues a broadcast to a room
2. Gateway fans out to room members
3. Each agent runs and streams independently
4. UI shows multiple streams in parallel

**Requirements:**
- Broadcast rooms
- Sender exclusion (do not reprocess own messages)
- Independent parallel streams

### 4. Corporate Network with Firewall (Planned)
**Scenario:** WebSocket is blocked
**Flow:**
1. Gateway runs with HTTP bridge enabled
2. Client connects via HTTP long-polling
3. Messages route through the bridge

**Requirements:**
- HTTP bridge transport
- HTTPS support
- CORS handling

### 5. Remote Tool Nodes (Planned)
**Scenario:** Gateway calls tools on a paired device
**Flow:**
1. Node pairs with the gateway and advertises capabilities
2. Gateway issues a node invoke request
3. Node runs the command and streams results back

**Requirements:**
- Node pairing and approval flow
- Node invoke protocol
- Capability and permission reporting per node

### 6. macOS Companion App (Planned)
**Scenario:** User installs the Wingman macOS app to expose macOS-only tools
**Flow:**
1. App attaches to a local gateway (launchd-managed) or connects to a remote gateway
2. A local node host service connects to the gateway and advertises macOS capabilities
3. Gateway routes tool invocations to the macOS node
4. UI/TCC-sensitive tools (system.run, screen, camera) are executed in the app context via IPC

**Requirements:**
- Node host service that can proxy to the macOS app for UI/TCC tools
- Local vs remote mode support (app does not spawn a gateway in remote mode)
- Local exec approvals for system.run enforced on-device
- SSH tunnel support for remote gateway control-plane connectivity

### 7. Webhook-Driven Automations (MVP)
**Scenario:** External systems trigger agents via webhooks (e.g., new email, form submissions, CI alerts)
**Flow:**
1. User configures a webhook with agentId + secret
2. External system sends HTTP POST payload
3. Gateway validates the secret and normalizes payload
4. Gateway routes to the configured agent and creates/updates a webhook thread

**Requirements:**
- Webhook registry with per-webhook secret
- Deterministic agent selection per webhook
- Thread creation that mirrors routines (human-readable name + session key)
- Basic access control (shared secret + optional allowlist)

---

## Core Concepts

### Agents and Isolation

An agent is a fully scoped brain with its own workspace, agentDir, and session store. Auth profiles and sessions are not shared by default.

### Bindings and Routing

Bindings map message metadata to an agentId. Routing is deterministic and most-specific-first. One agent is selected per inbound message unless an explicit broadcast is requested.

**Routing priority (most to least specific):**
```
1. peer match (exact DM/group/channel id)
2. guildId or teamId match
3. accountId match for a channel
4. channel match
5. default agent (agents.list[].default or first entry)
```

Routing happens before agent execution. Replies always return to the originating channel or thread.

### Sessions and Session Keys

The gateway derives a session key from agentId plus channel identity. Sessions are durable and stored per agent.
Sessions can be named on creation and renamed later via the Control UI or API.
Channel adapters may override the derived key for specific sources (e.g., Discord channel-to-session mappings).
The Control UI surfaces each session key in the session snapshot panel for easy copy/paste.

### Per-Session Request Queueing

To preserve conversation ordering, the gateway executes at most one in-flight request per `agentId + sessionKey`.

- Additional `req:agent` messages for the same session are queued by default (`queueIfBusy: true`).
- Clients receive queue lifecycle acks:
  - `status: "queued"` when accepted into the queue
  - `status: "dequeued"` when promoted to active execution
- The gateway also emits `event:agent` with `type: "request-queued"` for immediate UI feedback.
- `req:agent:cancel` can cancel both active and queued requests (queued cancellations return `status: "cancelled_queued"`).
- Clients can opt out of queueing per request with `queueIfBusy: false`, which returns an agent error if the session is busy.

### Background Terminal Sessions

Gateway runtime also supports session-scoped background terminal tools:
- `background_terminal` (single tool for start + stdin write + output polling)

Rules:
- Ownership is scoped to `agentId + sessionKey`; sessions cannot access each other's terminal processes.
- Output is buffered with bounded retention.
- Runtime policy applies command blocks, timeout limits, idle cleanup, and per-owner session caps.
- Tool lifecycle still uses the same `event:agent` stream protocol (`tool-start`, `tool-end`).

### Native Browser Automation

Gateway runtime exposes `browser_control` as a first-class built-in tool for browser automation.

- Backed by Chrome/Chromium runtime control using CDP and Playwright persistent-context.
- Non-persistent runs should prefer CDP and automatically fall back to persistent-context launch when CDP attach fails.
- Persistent named profile runs should launch via persistent-context by default; headed is the default mode, with optional explicit headless mode for automation.
- Intended for JS-rendered pages, interaction-required flows, and screenshots.
- This capability is native to Wingman runtime and is not modeled as an MCP server.
- Supports optional persistent named profiles configured by host settings and selected per agent.
- Profile runs must use lock protection so concurrent executions do not share the same profile simultaneously.
- Supports optional extension mappings in host config with default/per-agent extension selection.
- CLI/browser setup includes first-party extension bootstrap (`wingman browser extension install --default`) in addition to custom unpacked extension mappings.
- Relay mode security requirements:
  - Relay bind host must remain loopback-only (`127.0.0.1` / `localhost` / `::1`).
  - Relay clients (extension/CDP) must support token-based authentication.
  - Extension relay handshake should include explicit hello/ack before CDP forwarding begins.

### Voice Providers (TTS)

The gateway exposes a voice provider configuration that clients can use for text-to-speech playback.
Voice is configured at the gateway level, with optional per-agent overrides.

- Global defaults live under `voice` in wingman.config.json (provider + default settings).
- Per-agent overrides can set provider or specific options in agent config (`voice` block).
- Control UI provides per-session auto-speak toggles (default off).
- Providers:
  - `web_speech`: client-side browser synthesis (no server TTS).
  - `elevenlabs`: gateway-proxied TTS using ElevenLabs API keys.
- ElevenLabs API keys are stored in the credentials file or env vars (`ELEVENLABS_API_KEY`, `XI_API_KEY`).

### Routines (Scheduled Runs)

Routines allow users to run an agent prompt on a CRON schedule. Each run creates or appends to a routine thread so results can be reviewed and followed up via chat.

**Behavior**
- A routine defines: `name`, `agentId`, `cron`, `prompt`, `enabled`.
- Routines may optionally target an existing session (`sessionId`) to deliver output into an ongoing chat.
- When a routine fires, the gateway uses a routine session key:
  - `agent:<agentId>:routine:<routineId>`
- Each run appends a new message in the routine thread.
- Users can open the routine thread in the Control UI and continue the conversation after runs.

**MVP Scope**
- Validate CRON strings server-side.
- Persist routines in gateway state storage (current implementation uses `routines.json` in the gateway config directory).
- UI supports create/edit/delete and enable/disable.

**Examples:**
| Message Source | Session Key Example |
|----------------|-------------------|
| DM (default main) | `agent:main:main` |
| Discord channel | `agent:main:discord:account:bot123:channel:123456` |
| Discord thread | `agent:main:discord:account:bot123:channel:123456:thread:789` |
| WhatsApp group | `agent:support:whatsapp:group:1203...@g.us` |

Notes:
- If a channel supports multiple accounts, include `account:<accountId>` in the session key to avoid collisions (Discord keys already include the bot account).
- DMs can collapse to the agent main session. For true isolation per person, use one agent per person.

### Webhooks (MVP)

Webhooks allow external systems to invoke agents over HTTP. Each webhook is a long-lived integration tied to a specific agent and produces a durable thread, similar to routines.

**Behavior**
- A webhook defines: `id`, `name`, `agentId`, `secret`, `enabled`, optional `eventLabel`.
- Webhooks can optionally declare a preset. MVP includes `gog-gmail` for Gmail watch payloads from gogcli.
- Webhooks may optionally target an existing session (`sessionId`) to deliver output into an ongoing chat.
- Incoming webhook payloads become a new user message in the webhook thread.
- Gateway assigns a session key:
  - `agent:<agentId>:webhook:<webhookId>`
- The webhook thread appears in the Control UI and can be continued like any other session.

**Security**
- Webhooks require a shared secret (header or query parameter).
- Optional IP allowlists can further restrict access.
  - Default: deny if no secret provided.

**Preset: gog-gmail (MVP)**
- Purpose: Normalize gogcli Gmail watch payloads without relying on gcloud.
- Expected usage: `gog gmail watch serve` posts payloads to `/webhooks/<id>` with the webhook secret.
- Result: Gateway formats a readable Gmail summary for the selected agent, and stores the payload in the webhook thread.

### Channels and Accounts

Channels normalize inbound messages into a common shape (channel, accountId, peer, thread). Multiple accounts per channel are supported via accountId and bindings.

### Rooms (Broadcast Groups)

Rooms are explicit broadcast groups for swarm-style responses. They do not replace deterministic routing and are only used when broadcast is requested.

### Nodes (Planned)

Nodes are remote tool executors that connect to the gateway and expose capabilities. The first target is the Wingman macOS app, which runs a local node host service and proxies UI/TCC-sensitive tools to the app over IPC.

**Node responsibilities:**
- Identify as a node client and provide metadata (name, platform, mode)
- Advertise capabilities (canvas.*, camera.*, screen.record, system.run, system.notify)
- Report a permissions map (TCC status) so agents can decide what is allowed
- Enforce local exec approvals for system.run

**Gateway responsibilities:**
- Pair/approve nodes and persist approvals
- Route tool invocations to target nodes and stream results
- Surface node status + permissions in stats and Control UI

See the Node Protocol Spec for message schemas and pairing UX: `docs/requirements/004-node-protocol.md`

### Swarm vs Orchestrated Patterns

**Swarm (Parallel Independent):**
- Broadcast room with multiple agents
- Each produces an independent output stream
- Best for: diverse perspectives and brainstorming

**Orchestrated (Sequential Coordinated):**
- Single parent agent with subagents
- Parent coordinates workflow (planner -> implementor -> reviewer)
- Best for: complex tasks requiring coordination

---

## Features

### MVP Scope
- Gateway-hosted agent runtime and registry
- Deterministic routing bindings (most-specific-first)
- Durable session store (SQLite)
- WebSocket API for clients (CLI and Control UI)
- Control UI with chat, streaming output, and attachment uploads (image/audio + text/code files + PDF) (served on `gateway.controlUi.port`)
- Token or password authentication
- Basic health and stats endpoints (gateway + Control UI API proxy)
- Webhook registry + invocation endpoint (create/manage via Control UI)
- Discord channel adapter (gateway-hosted)

### Planned / Later
- Broadcast rooms for explicit swarm workflows
- Node pairing, permission reporting, and remote tool execution (macOS companion app + node host service)
- mDNS discovery
- Tailscale discovery
- HTTP bridge transport
- SSH tunnel helper
- Additional channel adapters (Slack, Teams, etc.)
- Rate limiting and message validation

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Wingman Gateway                          │
├─────────────────────────────────────────────────────────────┤
│  Control UI + WebSocket API                                  │
│  Channel Adapters                                            │
│                  │                                           │
│                  ▼                                           │
│           Router (bindings)                                  │
│                  │                                           │
│                  ▼                                           │
│           Session Store (SQLite)                             │
│                  │                                           │
│                  ▼                                           │
│           Agent Runtime                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Message Flow

#### Connect / Auth Flow
```
Client                Gateway
  │                      │
  │──connect────────────▶│  {client, auth}
  │                      │
  │◀────res─────────────│  {ok: true}
```

#### Routed Agent Flow
```
Inbound Message      Gateway Router        Session Store       Agent Runtime
  │                       │                     │                  │
  │──normalize──────────▶ │                     │                  │
  │                       │──select agent──────▶│                  │
  │                       │                     │──load session──▶ │
  │                       │                     │◀─session state── │
  │                       │◀──stream chunks─────│                  │
  │◀────response─────────│                     │                  │
```

#### Explicit Broadcast Flow (Optional)
```
Client              Gateway            Room Members
  │                   │                     │
  │─broadcast────────▶│                     │
  │ {roomId, msg}     │                     │
  │                   │────────fanout──────▶│
```

#### Node Connect / Invoke Flow (Planned)
```
Node Host Service        Gateway                 macOS App (IPC)
  │                        │                           │
  │─connect (node)────────▶│                           │
  │ {capabilities,...}     │                           │
  │◀────res (ok)──────────│                           │
  │                        │                           │
  │◀──req:node────────────│                           │
  │ {tool,args}            │                           │
  │───────────────────────────────────────────────────▶│
  │                        │      execute in app       │
  │◀──event:node (stream)──│◀───────────────────────────│
  │◀────res (done)────────│                           │
```

### Discovery Flow

#### mDNS Discovery (Planned)
```
Client              Network               Gateway
  │                    │                     │
  │──query mDNS───────▶│                     │
  │  _wingman-gateway  │                     │
  │                    │◀─────announce───────│
  │                    │   {name, port}      │
  │◀─response──────────│                     │
  │ [{gateway info}]   │                     │
```

---

## Data Models

### Agent
```typescript
interface AgentConfig {
  id: string;                    // Unique agentId
  name?: string;                 // Display name
  workspace: string;             // Agent workspace path
  agentDir: string;              // Per-agent state directory
  model?: string;                // provider:model-name
  tools?: string[];              // Allowed tools
}
```

### Binding
```typescript
interface Binding {
  agentId: string;
  match: {
    channel: string;
    accountId?: string;
    guildId?: string;
    teamId?: string;
    peer?: { kind: "dm" | "group" | "channel"; id: string };
  };
}
```

### SessionKey
```typescript
interface SessionKey {
  key: string;                   // agent:<agentId>:...
  agentId: string;
  channel: string;
  accountId?: string;
  peerId?: string;
  threadId?: string;
}

### Webhook (MVP)
```typescript
interface WebhookConfig {
  id: string;                    // Unique webhook id
  name: string;                  // Display name
  agentId: string;               // Target agent
  secret: string;                // Shared secret for auth
  enabled: boolean;              // Toggle
  eventLabel?: string;           // Optional label for UI
  createdAt: number;
}
```
```

### Node (Planned)
```typescript
interface Node {
  id: string;                    // Unique ID (hex)
  name: string;                  // Human-readable name
  platform?: "macos" | "linux" | "windows" | "unknown";
  mode?: "local" | "remote";
  transport?: "direct" | "ssh-tunnel";
  version?: string;
  capabilities: string[];        // Feature flags
  permissions?: Record<string, "granted" | "denied" | "prompt" | "restricted">;
  groups: Set<string>;           // Group memberships
  connectedAt: number;           // Connection timestamp
  lastPing?: number;             // Last heartbeat
  messageCount?: number;         // For rate limiting
  lastMessageTime?: number;      // For rate limiting
  metadata?: Record<string, unknown>;
  ws: ServerWebSocket;           // WebSocket connection
}
```

### Broadcast Group (Planned)
```typescript
interface BroadcastGroup {
  id: string;                    // Unique ID (hex)
  name: string;                  // Human-readable name
  description?: string;          // Optional description
  createdAt: number;             // Creation timestamp
  createdBy: string;             // Creator node ID
  members: Set<string>;          // Member node IDs
  strategy: "parallel" | "sequential"; // Processing strategy
  metadata?: Record<string, unknown>;  // Custom metadata
}
```

### Gateway Message
```typescript
interface GatewayMessage {
  type: MessageType;             // Message type
  id?: string;                   // Request/response correlation
  clientId?: string;             // Sender client ID
  roomId?: string;               // Target room (broadcast)
  targetNodeId?: string;         // Target node ID (node invoke)
  payload?: unknown;             // Message payload
  timestamp: number;             // Message timestamp
}

type MessageType =
  | "connect" | "res"
  | "req:agent" | "event:agent"
  | "req:node" | "event:node"
  | "broadcast"
  | "error";
```

### Agent Stream Messages

When agents respond through the gateway, they emit lifecycle events that match the CLI streaming format. This enables any UI (mobile, web, terminal) to consume the same protocol.

```typescript
// Agent starts processing
interface AgentStartEvent {
  type: "agent-start";
  agent: string;                 // Agent name
  prompt: string;                // User prompt being processed
  sessionId?: string;            // Agent's local session (optional)
  timestamp: number;
}

// Agent streaming content (token by token)
interface AgentStreamEvent {
  type: "agent-stream";
  chunk: unknown;                // Raw LangGraph stream chunk
  timestamp: number;
}

// Agent completed successfully
interface AgentCompleteEvent {
  type: "agent-complete";
  result: unknown;               // Final result
  timestamp: number;
}

// Agent error
interface AgentErrorEvent {
  type: "agent-error";
  error: string;                 // Error message
  stack?: string;                // Optional stack trace
  timestamp: number;
}

// Tool execution (visible to observers)
interface ToolStartEvent {
  type: "tool-start";
  toolName: string;              // Tool being executed
  toolInput: unknown;            // Tool arguments
  ui?: UiRenderSpec;             // Optional UI render hints for clients
  timestamp: number;
}

interface ToolEndEvent {
  type: "tool-end";
  toolName: string;
  toolOutput: unknown;           // Tool result
  timestamp: number;
}

interface UiRenderSpec {
  registry?: string;             // UI registry name (default: webui)
  layout?: UiLayoutSpec;         // Optional layout hints
  components: UiComponentSpec[]; // One or more pre-registered components
}

interface UiComponentSpec {
  component: string;             // Component ID in registry
  props: Record<string, unknown>;
}

interface UiLayoutSpec {
  type: "stack" | "row" | "grid";
  gap?: number;
  columns?: number;              // Grid only
  align?: "start" | "center" | "end" | "stretch";
}
```

**Protocol Design Principles:**

1. **Raw Stream Forwarding**: Gateway forwards agent stream chunks as-is, matching CLI streaming format
2. **UI Interprets**: Each UI (mobile, web, CLI) parses chunks for its presentation
3. **Envelope Only**: Gateway adds routing metadata (clientId, roomId) but doesn't modify payload
4. **Stateful Sessions**: Gateway persists session state but does not buffer stream events

### Tool-Driven UI Prompts (Static Generative UI)

Tools can include UI render hints so clients can render predefined components
when user input is required. This is a static generative UI (SGUI) pattern:
agents choose from a registered component set, while clients control layout
and interaction.

**MVP scope:** Web UI only. Other clients may ignore `ui` hints.

Example tool call: `ask.user.feedback`

```json
{
  "type": "event:agent",
  "clientId": "gateway",
  "payload": {
    "type": "tool-start",
    "toolName": "ask.user.feedback",
    "toolInput": {
      "prompt": "What should we do next?"
    },
    "ui": {
      "registry": "webui",
      "layout": { "type": "stack", "gap": 12 },
      "components": [
        { "component": "FeedbackForm", "props": { "title": "Next Step" } }
      ]
    },
    "timestamp": 1706000001000
  }
}
```

Tool result returns user input to the agent:
```json
{
  "type": "event:agent",
  "clientId": "gateway",
  "payload": {
    "type": "tool-end",
    "toolName": "ask.user.feedback",
    "toolOutput": { "text": "Ship it." },
    "timestamp": 1706000003000
  }
}
```

**Example: Agent Response Flow**

```json
// 1. Agent starts
{
  "type": "event:agent",
  "clientId": "gateway",
  "payload": {
    "type": "agent-start",
    "agent": "coder",
    "prompt": "Review the auth code",
    "timestamp": 1706000000000
  }
}

// 2. Streaming tokens
{
  "type": "event:agent",
  "clientId": "gateway",
  "payload": {
    "type": "agent-stream",
    "chunk": { "event": "on_chat_model_stream", "data": {"chunk": "The"} },
    "timestamp": 1706000000100
  }
}

// 3. Tool execution
{
  "type": "event:agent",
  "clientId": "gateway",
  "payload": {
    "type": "tool-start",
    "toolName": "command_execute",
    "toolInput": { "command": "cat src/auth.ts" },
    "timestamp": 1706000001000
  }
}

// 4. Agent complete
{
  "type": "event:agent",
  "clientId": "gateway",
  "payload": {
    "type": "agent-complete",
    "result": { "response": "The auth code looks good..." },
    "timestamp": 1706000005000
  }
}
```

---

## API Reference

### CLI Commands

#### Gateway Management
```bash
# Start gateway
wingman gateway start [options]
  --port <number>         Port (default: 18789)
  --host <string>         Host (default: 127.0.0.1)
  --auth-mode <mode>      token | password | none
  --token <string>        Auth token (token mode)
  --password <string>     Auth password (password mode)
  --name <string>         Gateway name

# Stop gateway
wingman gateway stop

# Restart gateway
wingman gateway restart

# Show status
wingman gateway status

# Run in foreground
wingman gateway run [options]
```

#### Agent Invocation (CLI)
```bash
# Run via gateway (default)
wingman agent --agent <id> "prompt"
  --gateway <url>         Gateway URL (optional if configured)
  --token <string>        Auth token

# Run locally (no gateway)
wingman agent --local --agent <id> "prompt"
```

#### Onboarding (CLI)
```bash
# Bootstrap workspace config + starter agent
wingman init [options]
  --agent <name>          Agent name (default: wingman)
  --mode <name>           Init mode (onboard|sync). Default: onboard
  --only <targets>        Run only selected setup targets (config,agents,provider)
  --agents <list>         Copy only bundled agents (comma-separated)
  --model <provider:model>  Set model for the starter agent
  --provider <name>       Configure provider credentials
  --token <string>        Provider token (non-interactive)

# Re-copy bundled templates only
wingman init --mode sync --only agents
```

#### Utilities
```bash
# Generate token
wingman gateway token --generate

# Check health
wingman gateway health [options]
  --host <string>         Gateway host
  --port <number>         Gateway port
```

### HTTP Endpoints

#### Health Check
```
GET /health

Response:
{
  "status": "healthy",
  "version": "1.0.0",
  "stats": {
    "uptime": 123456,
    "totalNodes": 3,
    "totalGroups": 2,
    "messagesProcessed": 1000,
    "startedAt": 1234567890,
    "activeSessions": 2
  },
  "timestamp": 1234567890
}
```

#### Statistics
```
GET /stats

Response:
{
  "voice": {
    "provider": "web_speech",
    "defaultPolicy": "off",
    "webSpeech": { "voiceName": "Samantha", "lang": "en-US", "rate": 1 },
    "elevenlabs": {
      "voiceId": "VOICE_ID",
      "modelId": "eleven_multilingual_v2",
      "stability": 0.4,
      "similarityBoost": 0.7
    }
  },
  "gateway": {
    "uptime": 123456,
    "totalNodes": 3,
    "totalGroups": 2,
    "messagesProcessed": 1000
  },
  "nodes": {
    "totalNodes": 3,
    "nodes": [...]
  },
  "groups": {
    "totalGroups": 2,
    "groups": [...]
  }
}
```

#### Control UI Endpoints (on `gateway.controlUi.port`)
```
GET /
GET /api/health
GET /api/stats
GET /api/config
GET /api/providers
GET /api/agents
POST /api/agents
GET /api/voice
PUT /api/voice
POST /api/voice/speak
GET /api/routines
POST /api/routines
DELETE /api/routines/:id
```
The Control UI serves HTML on `/` and proxies gateway health/stats via `/api/*`
to avoid cross-origin issues when the UI is on a different port.

### WebSocket Messages

#### Connect
```json
{
  "type": "connect",
  "id": "connect-1",
  "client": {
    "instanceId": "cli-1",
    "clientType": "cli",
    "version": "0.1.0"
  },
  "auth": { "token": "sk-..." },
  "timestamp": 1234567890
}
```

#### Response
```json
{
  "type": "res",
  "id": "connect-1",
  "ok": true,
  "payload": "gateway-ready",
  "timestamp": 1234567890
}
```

#### Node Connect (Planned)
```json
{
  "type": "connect",
  "id": "connect-2",
  "client": {
    "instanceId": "mac-node-1",
    "clientType": "node",
    "version": "0.1.0"
  },
  "auth": { "token": "sk-..." },
  "payload": {
    "name": "MacBook Pro",
    "platform": "macos",
    "mode": "local",
    "capabilities": ["system.run", "system.notify", "screen.record"]
  },
  "timestamp": 1234567890
}
```

#### Node Invoke (Planned)
```json
{
  "type": "req:node",
  "id": "node-req-1",
  "targetNodeId": "node-123",
  "payload": {
    "tool": "system.run",
    "args": { "command": "ls -la" },
    "timeoutMs": 30000
  },
  "timestamp": 1234567890
}
```

#### Node Stream (Planned)
```json
{
  "type": "event:node",
  "id": "node-req-1",
  "payload": { "kind": "stdout", "chunk": "..." },
  "timestamp": 1234567890
}
```

#### Request Agent
```json
{
  "type": "req:agent",
  "id": "req-1",
  "payload": {
    "content": "Review the auth code",
    "attachments": [
      {
        "kind": "file",
        "name": "notes.md",
        "mimeType": "text/markdown",
        "textContent": "# Review Notes\n- keep media uploads working"
      },
      {
        "kind": "audio",
        "dataUrl": "data:audio/wav;base64,AAA..."
      },
      {
        "kind": "image",
        "dataUrl": "data:image/png;base64,BBB..."
      }
    ],
    "routing": { "channel": "webui" }
  },
  "timestamp": 1234567890
}
```

Attachment handling notes:
- `image` and `audio` attachments continue to use `dataUrl` transport (existing behavior).
- `file` attachments carry extracted text in `textContent` (for `.txt`, `.md`, `.csv`, `.json`, `.yaml/.yml`, `.xml`, `.log`, and common code files: `.ts`, `.js`, `.py`, `.go`, `.rs`, `.java`, `.c`, `.cpp`, `.sql`, `.html`, `.css`).
- `PDF` uploads are accepted as `file` attachments with native model file blocks when the active model advertises `pdfInputs`; otherwise Wingman falls back to extracted text (or a fallback note when extraction fails).


#### Broadcast (Optional)
```json
{
  "type": "broadcast",
  "id": "req-2",
  "roomId": "swarm-1",
  "payload": {
    "content": "Review code in PR #123"
  },
  "timestamp": 1234567890
}
```

---

## Configuration

### Gateway Config (wingman.config.json)
```json
{
  "gateway": {
    "host": "127.0.0.1",
    "port": 18789,
    "stateDir": "~/.wingman",
    "fsRoots": ["~/Projects", "~/.wingman/outputs"],
    "auth": {
      "mode": "token",
      "token": "sk-...",
      "allowTailscale": true
    },
    "controlUi": {
      "enabled": true,
      "port": 18790,
      "pairingRequired": true,
      "allowInsecureAuth": false
    },
    "dynamicUiEnabled": true,
    "mcpProxy": {
      "enabled": false,
      "command": "uvx",
      "baseArgs": ["invariant-gateway@latest", "mcp"],
      "projectName": "wingman-gateway",
      "pushExplorer": false,
      "apiKey": "optional-key",
      "apiUrl": "optional-url"
    },
    "nodes": {
      "enabled": true,
      "pairingRequired": true,
      "pairingTtlSeconds": 300,
      "approved": ["node-123"]
    },
    "adapters": {
      "discord": {
        "enabled": true,
        "token": "discord-bot-token",
        "mentionOnly": true,
        "allowBots": false,
        "allowedGuilds": ["123456789012345678"],
        "allowedChannels": ["987654321098765432"],
        "channelSessions": {
          "discord-channel123": "agent:main:123"
        },
        "sessionCommand": "!session",
        "responseChunkSize": 1900
      }
    }
  }
}
```

Environment overrides:
- `WINGMAN_GATEWAY_TOKEN` can supply the auth token at runtime so you can keep `auth.mode` set to `token` without storing the token in config.

Node pairing notes (planned):
- `nodes.pairingRequired`: require explicit approval for new nodes (recommended)
- `nodes.approved`: allowlist of approved node IDs
- `nodes.pairingTtlSeconds`: how long a pending pairing request stays valid

Discord adapter notes:
- The adapter runs inside the gateway process and connects back to the gateway WebSocket API.
- By default it only responds to mentions (DMs always route).
- Use `!session <sessionKey> <message>` to target an existing session; omit to let the gateway derive a session key from routing (channel/thread).
- `channelSessions` can map a Discord channel ID to a fixed session ID. If set, it overrides the derived session key unless a `!session` command is used.
- If the mapped session ID (or `!session` override) starts with `agent:<id>:`, the adapter will set `agentId` to that `<id>` so the gateway routes to the intended agent without requiring a separate binding.
- The gateway logs startup warnings for common Discord config issues (missing token, blank sessionCommand, and channelSessions entries with whitespace or missing `agent:` prefixes).
- Optional overrides: `gatewayUrl`, `gatewayToken`, `gatewayPassword`.

Dynamic UI notes:
- `dynamicUiEnabled`: when false, clients ignore UI render specs and agents should respond with text only.

MCP proxy notes:
- `gateway.mcpProxy.enabled` wraps stdio MCP commands with a proxy runtime.
- When disabled, MCP processes run directly with their configured command/args.
- Startup dependency checks for `uv` must be conditional:
  - run only when `gateway.mcpProxy.enabled` is true
  - and only when proxy command is `uv`/`uvx`

### Session Working Folder (Control UI)
- Each session can optionally set a working folder (`workdir`).
- The gateway validates the path against `gateway.fsRoots`.
- If no session folder is set, the agent defaults to `~/.wingman/outputs/<agentId>/`.
- When set, the session working folder becomes the agent execution root for subsequent turns in that session:
  - tool execution CWD (`command_execute`, `background_terminal`, `browser_control`, `code_search`, `git_status`)
  - primary file backend root (read/write operations)
- The working folder is also injected into agent context via hidden middleware.

### Agents and Routing
```json
{
  "agents": {
    "list": [
      { "id": "main", "default": true, "workspace": "~/wingman-main" },
      { "id": "support", "workspace": "~/wingman-support" }
    ],
    "bindings": [
      { "agentId": "support", "match": { "channel": "webui", "peer": { "kind": "dm", "id": "user-123" } } },
      { "agentId": "main", "match": { "channel": "webui" } }
    ]
  }
}
```

### Discovery (Planned)
```json
{
  "discovery": {
    "enabled": true,
    "method": "mdns",
    "name": "My Gateway",
    "tailscale": {
      "tags": ["wingman-gateway"]
    }
  }
}
```

---

## Consumer Patterns

The gateway protocol is designed to be consumed by any UI. Here are example patterns for different consumers.

### CLI Consumer (Reference Implementation)

The CLI already handles agent streams via `OutputManager` and `StreamParser`. When connected to gateway:

```typescript
// Pseudocode
gateway.on('message', (msg) => {
  if (msg.payload.type === 'agent-stream') {
    // Parse chunk for text/tool events
    const parsed = streamParser.parse(msg.payload.chunk);
    if (parsed.text) outputManager.emitText(parsed.text);
    if (parsed.toolCall) outputManager.emitToolCall(parsed.toolCall);
  }
});
```

### Mobile App Consumer

A mobile app would parse the same stream for native UI components:

```swift
// iOS Swift pseudocode
func handleGatewayMessage(_ msg: GatewayMessage) {
    switch msg.payload.type {
    case "agent-start":
        showTypingIndicator(agent: msg.payload.agent)
    case "agent-stream":
        let text = parseTextFromChunk(msg.payload.chunk)
        appendToChat(text)
    case "agent-complete":
        hideTypingIndicator()
    case "tool-start":
        showToolExecution(msg.payload.toolName)
    }
}
```

### Web UI Consumer

A React web app might use a custom hook:

```typescript
// React hook pseudocode
function useGatewayStream(roomId: string) {
  const [messages, setMessages] = useState([]);
  const [activeAgents, setActiveAgents] = useState({});

  useEffect(() => {
    gateway.subscribe(roomId, (msg) => {
      if (msg.payload.type === 'agent-start') {
        setActiveAgents(prev => ({...prev, [msg.nodeId]: msg.payload}));
      }
      if (msg.payload.type === 'agent-stream') {
        // Accumulate text into agent's current message
      }
      if (msg.payload.type === 'agent-complete') {
        setMessages(prev => [...prev, msg.payload.result]);
        setActiveAgents(prev => {
          const {[msg.nodeId]: _, ...rest} = prev;
          return rest;
        });
      }
    });
  }, [roomId]);

  return { messages, activeAgents };
}
```

### Slack/Teams Adapter

Enterprise adapters transform gateway messages to platform format:

```typescript
// Slack adapter pseudocode
gateway.on('message', async (msg) => {
  if (msg.payload.type === 'agent-complete') {
    await slack.postMessage({
      channel: mapRoomToChannel(msg.groupId),
      text: `*${msg.payload.agent}*: ${extractText(msg.payload.result)}`,
      blocks: formatAsSlackBlocks(msg.payload.result)
    });
  }
});
```

### Key Design Decisions

1. **Raw Chunks**: Gateway sends raw agent stream chunks, not processed text
2. **Client Parsing**: Each client implements parsing appropriate for its UI
3. **Flexible Presentation**: Same data, different presentations (CLI = scrolling text, mobile = chat bubbles, Slack = formatted messages)
4. **Stateless Gateway**: Clients maintain their own view state and message history

---

## Performance Requirements

### Latency
- WebSocket message delivery: <50ms (p99)
- HTTP bridge message delivery: <2s (p99)
- Discovery response time: <5s
- Heartbeat interval: 30s

### Throughput
- Messages per second: 1000+ (per gateway)
- Concurrent clients: 1000+ (per gateway)
- Broadcast rooms: 100+ (per gateway)

### Scalability
- Horizontal scaling via multiple gateway instances
- No single point of failure
- Future: shared session store for multi-gateway operation

---

## Security

### Authentication
- Token or password authentication
- Optional local-only mode for trusted environments
- Token rotation support
- Control UI pairing (optional)
- Optional tailnet allowlist for trusted peers

### Network Security
- Local bind by default
- Tailscale for remote access
- Public exposure requires TLS and auth

### Rate Limiting
- 100 messages per minute per client (default)
- Configurable per gateway (planned)
- Blocks on rate limit exceeded

### Message Validation
- Payload validation for all message types (planned)
- Payload size limits
- Type safety enforcement

---

## Deployment Options

### Local Daemon
```bash
wingman gateway start
# Runs as background daemon
# PID file: ~/.wingman/gateway.pid
# Logs: ~/.wingman/logs/wingman.log
```

### Docker
```dockerfile
FROM oven/bun:1.1.42
WORKDIR /app
COPY . .
RUN bun install
CMD ["bun", "run", "wingman", "gateway", "run"]
```

### Cloudflare Workers (Optional Adapter)
```bash
cd apps/wingman/cloudflare
wrangler deploy
```

---

## Testing Strategy

### Unit Tests
- Routing bindings and match order
- Session store behavior
- Auth handshake
- Broadcast room operations (if enabled)

### Integration Tests
- Multi-client scenarios
- Control UI chat flow
- Broadcast room messaging
- Transport fallback (planned)

### Load Tests
- 1000 concurrent clients
- 100 messages/sec sustained
- Memory usage < 500MB

---

## Success Metrics

### Adoption
- Number of gateways deployed
- Average nodes per gateway
- Broadcast group usage

### Performance
- Message delivery latency (p50, p99)
- Uptime percentage
- Error rate

### User Experience
- Discovery success rate
- Auto-connect success rate
- Connection stability (disconnects/hour)

---

## Future Enhancements

### Phase 2
- Registry-based discovery (Cloudflare KV, Redis)
- Message persistence (survive gateway restart)
- Multi-gateway routing
- Load balancing

### Phase 3
- Encryption at rest
- End-to-end encryption (node-to-node)
- RBAC (role-based access control)
- Audit logging

### Phase 4
- Web dashboard for monitoring
- Metrics/observability (Prometheus, Grafana)
- Auto-scaling based on load
- Geographic routing

---

## References

- [Architecture Overview](000-architecture-overview.md) - System-wide architecture
- [Multi-Agent Architecture](001-multi-agent-architecture.md) - Agent hierarchy, custom agents, hooks
- [WebSocket RFC 6455](https://tools.ietf.org/html/rfc6455)
- [mDNS RFC 6762](https://tools.ietf.org/html/rfc6762)
- [Tailscale API](https://tailscale.com/api)
