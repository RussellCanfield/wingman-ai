# Wingman Gateway - Product Requirements Document

## Overview

The Wingman Gateway is the central runtime for agents, sessions, routing, and channels. It accepts inbound messages from channels and clients (CLI, Control UI), routes deterministically to a single agent via bindings, loads durable session state, runs the agent, and streams the response back to the originating channel. Broadcast rooms are an explicit opt-in for swarm scenarios.

**Version:** 1.1
**Status:** In Development
**Last Updated:** 2026-01-27

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
- Control UI with chat and streaming output
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

### 6. Webhook-Driven Automations (MVP)
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
| Discord channel | `agent:main:discord:channel:123456` |
| Discord thread | `agent:main:discord:channel:123456:thread:789` |
| WhatsApp group | `agent:support:whatsapp:group:1203...@g.us` |

Notes:
- If a channel supports multiple accounts, include `account:<accountId>` in the session key to avoid collisions.
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

Nodes are remote tool executors that connect to the gateway and expose capabilities. Nodes require a pairing flow and are not in MVP.

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
- Control UI with chat and streaming output (served on `gateway.controlUi.port`)
- Token or password authentication
- Basic health and stats endpoints (gateway + Control UI API proxy)
- Webhook registry + invocation endpoint (create/manage via Control UI)

### Planned / Later
- Broadcast rooms for explicit swarm workflows
- Node pairing and remote tool execution
- mDNS discovery
- Tailscale discovery
- HTTP bridge transport
- SSH tunnel helper
- External channel adapters (Discord, Slack, etc.)
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
  capabilities?: string[];       // Feature flags
  groups: Set<string>;           // Group memberships
  connectedAt: number;           // Connection timestamp
  lastPing?: number;             // Last heartbeat
  messageCount?: number;         // For rate limiting
  lastMessageTime?: number;      // For rate limiting
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
  targetNodeId?: string;         // Target node ID (future)
  payload?: unknown;             // Message payload
  timestamp: number;             // Message timestamp
}

type MessageType =
  | "connect" | "res"
  | "req:agent" | "event:agent"
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
  timestamp: number;
}

interface ToolEndEvent {
  type: "tool-end";
  toolName: string;
  toolOutput: unknown;           // Tool result
  timestamp: number;
}
```

**Protocol Design Principles:**

1. **Raw Stream Forwarding**: Gateway forwards agent stream chunks as-is, matching CLI streaming format
2. **UI Interprets**: Each UI (mobile, web, CLI) parses chunks for its presentation
3. **Envelope Only**: Gateway adds routing metadata (clientId, roomId) but doesn't modify payload
4. **Stateful Sessions**: Gateway persists session state but does not buffer stream events

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
  --agents <list>         Copy only bundled agents (comma-separated)
  --model <provider:model>  Set model for the starter agent
  --provider <name>       Configure provider credentials
  --token <string>        Provider token (non-interactive)
  --skip-config           Skip config setup
  --skip-agent            Skip agent scaffolding
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
GET /api/agents
POST /api/agents
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

#### Request Agent
```json
{
  "type": "req:agent",
  "id": "req-1",
  "payload": {
    "content": "Review the auth code",
    "routing": { "channel": "webui" }
  },
  "timestamp": 1234567890
}
```

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
    }
  }
}
```

Environment overrides:
- `WINGMAN_GATEWAY_TOKEN` can supply the auth token at runtime so you can keep `auth.mode` set to `token` without storing the token in config.

### Session Working Folder (Control UI)
- Each session can optionally set a working folder for output files.
- The gateway validates the path against `gateway.fsRoots`.
- If no session folder is set, the agent defaults to `~/.wingman/outputs/<agentId>/`.
- The working folder is injected into agent context via hidden middleware, not the system prompt.

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
cd wingman/cloudflare
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
