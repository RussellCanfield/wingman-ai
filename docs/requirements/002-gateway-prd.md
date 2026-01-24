# Wingman Gateway - Product Requirements Document

## Overview

The Wingman Gateway enables AI agent swarming by providing a WebSocket-based communication hub that allows multiple Wingman nodes to connect, form **rooms** (broadcast groups), and collaborate on tasks. The gateway is **stateless** - it routes messages but does not store conversation history. Each node maintains its own state.

**Version:** 1.1
**Status:** In Development
**Last Updated:** 2026-01-23

---

## Vision

The gateway enables "AI agents communicating as a team" through bidirectional rooms where:
- All members see all messages (user prompts AND agent responses)
- Agents decide autonomously whether to act based on their system prompt
- Multiple agents can respond in parallel as independent streams
- No explicit routing required - agents self-select based on context

See [Architecture Overview](000-architecture-overview.md) for the full system context.

---

## Goals

### Primary Goals
1. Enable **AI agent swarming** - multiple agents working together on shared tasks
2. Support **local network discovery** (LAN/home office scenarios)
3. Provide **remote connectivity** via Tailscale for distributed teams
4. Offer **flexible deployment** options (local daemon, Cloudflare Workers)
5. **Stateless design** - gateway routes messages, nodes own their state

### Secondary Goals
1. Support alternative transports (HTTP bridge, SSH tunnels) for firewall traversal
2. Provide simple authentication and authorization
3. Enable horizontal scaling via multiple gateway instances
4. Maintain low latency for real-time agent collaboration
5. **Protocol-first design** - generic protocol that any UI can consume

---

## Use Cases

### 1. Home Office Multi-Device Setup
**Scenario:** Developer with desktop, laptop, and server
**Flow:**
1. Start gateway on desktop: `wingman gateway start --discovery mdns`
2. Laptop auto-discovers gateway on LAN
3. Both devices join same broadcast group for collaborative coding

**Requirements:**
- mDNS/Bonjour discovery
- WebSocket transport (low latency)
- Optional authentication

### 2. Distributed Team Collaboration
**Scenario:** Remote team across different locations using Tailscale
**Flow:**
1. Team lead starts gateway with Tailscale discovery
2. Team members discover gateway via Tailscale network
3. All join "project-alpha" broadcast group
4. Agents collaborate on shared tasks (code review, documentation, testing)

**Requirements:**
- Tailscale discovery integration
- Secure WebSocket over Tailscale network
- Broadcast group management
- Token-based authentication

### 3. Corporate Network with Firewall
**Scenario:** Enterprise environment where WebSocket is blocked
**Flow:**
1. Gateway running on server with HTTP bridge enabled
2. Client connects via HTTP long-polling
3. Messages routed through HTTP transport layer

**Requirements:**
- HTTP bridge transport
- HTTPS support
- CORS handling
- Session management

### 4. SSH Tunnel Access
**Scenario:** Gateway behind NAT/firewall, SSH access available
**Flow:**
1. User creates SSH tunnel to gateway host
2. Connects to localhost through tunnel
3. Standard WebSocket communication over tunnel

**Requirements:**
- SSH tunnel helper command
- Reverse tunnel support
- Port forwarding

### 5. Multi-Agent Swarm
**Scenario:** User wants 3 different agents to process the same request
**Flow:**
1. User joins a room with 3 agent nodes (coder, researcher, reviewer)
2. User sends: "Analyze the auth implementation"
3. Gateway broadcasts to all room members
4. Each agent autonomously decides whether to respond based on its system prompt
5. Coder analyzes code structure
6. Researcher finds best practices docs
7. Reviewer identifies security concerns
8. All 3 responses stream independently to all room members
9. User sees all perspectives in their UI

**Requirements:**
- Bidirectional message flow (all see all)
- Sender exclusion (don't process your own messages)
- Independent parallel streams
- Agent discretion (system prompt determines response)

---

## Core Concepts

### Rooms (Broadcast Groups)

A **room** is a named group where all members see all messages. Think of it as a team chat where both humans and AI agents participate.

**Key Properties:**
- **Bidirectional**: User messages AND agent responses broadcast to everyone
- **No routing required**: Agents self-select whether to respond based on context
- **Parallel execution**: Multiple agents can respond simultaneously
- **Stateless**: Room doesn't store history; nodes maintain their own state

**Message Flow:**
```
User (Node A) sends: "Review the auth code"
        │
        ▼
    ┌───────────────────────────────────────────────┐
    │                    ROOM                        │
    │                                                │
    │  Broadcast to: Node B, Node C, Node D         │
    │  (Node A excluded - sender doesn't receive)   │
    │                                                │
    └───────────────────────────────────────────────┘
        │           │           │
        ▼           ▼           ▼
    Node B      Node C      Node D
    (Mobile)    (Coder)     (Reviewer)

    - Display   - "Is this  - "Is this
      message     for me?     for me?
                  YES"        YES"
                  │           │
                  ▼           ▼
                Respond     Respond
                  │           │
                  └─────┬─────┘
                        ▼
                  Both responses
                  broadcast back
                  to room (including
                  Node A this time)
```

### Agent Discretion Model

Agents decide autonomously whether to act on incoming messages. There's no explicit @mention or routing - the agent's **system prompt** defines when it should respond.

**Example System Prompts:**

```
# Coder Agent
You are a coding expert. Respond when users ask about:
- Code implementation
- Bug fixes
- Refactoring
- Technical questions about the codebase

If the request is primarily about documentation or security research,
defer to other team members.
```

```
# Reviewer Agent
You are a code review specialist. Respond when users ask about:
- Code quality
- Security vulnerabilities
- Best practices
- Performance concerns

Proactively review code changes shared in the room.
```

**Key Rules:**
1. Senders don't receive their own messages (prevents feedback loops)
2. Agent's internal session handles its own context (not gateway's job)
3. Multiple agents can respond to the same message (independent streams)
4. Agents can choose NOT to respond if the request isn't relevant

### Swarm vs Orchestrated Patterns

**Swarm (Parallel Independent):**
- Multiple agents in same room
- Each produces independent output stream
- No coordination - UI shows all responses
- Best for: diverse perspectives, research, brainstorming

**Orchestrated (Sequential Coordinated):**
- Single parent agent with subagents
- Parent coordinates workflow (planner → implementor → reviewer)
- Single output stream from parent
- Best for: complex tasks requiring coordination

Users choose the pattern based on their needs. Both can use the gateway.

---

## Features

### Core Features (Implemented)

#### ✅ WebSocket Communication
- Native Bun WebSocket server
- Ping/pong heartbeat mechanism
- Auto-reconnection on client side
- Binary and text message support

#### ✅ Node Management
- Registration/unregistration
- Unique node IDs (hex)
- Node metadata (name, capabilities, groups)
- Stale node cleanup

#### ✅ Broadcast Groups
- Dynamic group creation
- Join/leave operations
- Group-based message routing
- Parallel/sequential processing strategies

#### ✅ Authentication
- Token-based authentication
- Optional auth mode
- Token generation utility

#### ✅ Daemon Support
- Background process management
- Start/stop/restart/status commands
- PID file management
- Log file output

#### ✅ Health Monitoring
- `/health` HTTP endpoint
- `/stats` HTTP endpoint
- Uptime tracking
- Node/group statistics

#### ✅ Rate Limiting
- Per-node message rate limits (100 msg/min default)
- Time window-based (60s)
- Configurable limits
- Rate limit error messages

#### ✅ Message Validation
- Zod schema validation
- Payload validation for all message types
- Validation error responses

### New Features (Planned)

#### 🔄 mDNS/Bonjour Discovery
**Priority:** High
**Effort:** Medium

**Description:** Auto-discover gateways on local network

**Requirements:**
- Service type: `_wingman-gateway._tcp.local`
- TXT records: version, auth status, capabilities
- Discovery timeout (5s default)
- Multiple gateway discovery
- CLI commands: `discover`, `--discovery mdns`, `--auto-discover`

**Acceptance Criteria:**
- Gateway announces itself on LAN start
- Clients can discover all gateways on network within 5s
- Discovery shows gateway name, URL, auth requirements
- Auto-connect to first discovered gateway works

#### 🔄 Tailscale Discovery
**Priority:** High
**Effort:** Medium

**Description:** Discover gateways across Tailscale VPN network

**Requirements:**
- Query local tailscaled daemon (no API key needed)
- Fall back to Tailscale API if daemon unavailable
- Filter by device tags
- MagicDNS name resolution
- CLI commands: `discover --tailscale`

**Acceptance Criteria:**
- Discovers all Tailscale devices running gateway
- Shows Tailscale IP and MagicDNS name
- Can connect using either IP or MagicDNS name
- Works without Tailscale API key (local mode)

#### 🔄 HTTP Bridge Transport
**Priority:** Medium
**Effort:** High

**Description:** HTTP-based transport for firewall traversal

**Requirements:**
- Three endpoints: `/bridge/send` (POST), `/bridge/poll` (GET), `/bridge/sse` (SSE)
- Long-polling with 30s timeout
- Session-based message queuing
- Automatic fallback from WebSocket

**Acceptance Criteria:**
- Can connect when WebSocket is blocked
- Messages delivered with <2s latency
- Auto-reconnect on connection loss
- HTTPS support for production

#### 🔄 SSH Tunnel Helper
**Priority:** Low
**Effort:** Low

**Description:** Helper command for SSH tunnel creation

**Requirements:**
- Forward tunnel: `wingman gateway tunnel user@host`
- Reverse tunnel: `wingman gateway tunnel reverse`
- Auto-cleanup on exit
- Port selection

**Acceptance Criteria:**
- Creates SSH tunnel with single command
- Auto-connects after tunnel established
- Cleans up tunnel on Ctrl+C
- Works with SSH keys and SSH agent

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Wingman Gateway                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   WebSocket  │  │  HTTP Bridge │  │     SSH      │      │
│  │   Transport  │  │   Transport  │  │   Transport  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │               │
│         └──────────────────┴──────────────────┘               │
│                           │                                   │
│                  ┌────────▼────────┐                         │
│                  │  Message Router │                         │
│                  └────────┬────────┘                         │
│                           │                                   │
│         ┌─────────────────┼─────────────────┐               │
│         │                 │                 │               │
│  ┌──────▼───────┐  ┌─────▼──────┐  ┌──────▼──────┐        │
│  │     Node     │  │  Broadcast │  │    Auth     │        │
│  │   Manager    │  │   Groups   │  │  Manager    │        │
│  └──────────────┘  └────────────┘  └─────────────┘        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
         │                  │                  │
         │                  │                  │
    ┌────▼────┐       ┌────▼────┐       ┌────▼────┐
    │  Node 1 │       │  Node 2 │       │  Node 3 │
    │ (Agent) │       │ (Agent) │       │ (Agent) │
    └─────────┘       └─────────┘       └─────────┘
```

### Message Flow

#### Registration Flow
```
Client                Gateway               NodeManager
  │                      │                      │
  │──register──────────▶ │                      │
  │  {name, token}       │                      │
  │                      │──validate token─────▶│
  │                      │                      │
  │                      │◀─node created────────│
  │◀─────ack────────────│  {nodeId}            │
  │  {nodeId, name}      │                      │
```

#### Broadcast Flow
```
Node1              Gateway            BroadcastGroup         Node2, Node3
  │                   │                     │                    │
  │─broadcast────────▶│                     │                    │
  │ {groupId, msg}    │                     │                    │
  │                   │─get members────────▶│                    │
  │                   │◀─[node2, node3]─────│                    │
  │                   │                     │                    │
  │                   │─────────broadcast message──────────────▶ │
  │                   │                {msg, fromNodeId}         │
```

### Discovery Flow

#### mDNS Discovery
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

### Node
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

### Broadcast Group
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
  nodeId?: string;               // Sender node ID
  groupId?: string;              // Target group ID
  targetNodeId?: string;         // Target node ID (direct)
  payload?: unknown;             // Message payload
  timestamp: number;             // Message timestamp
  messageId?: string;            // Optional message ID
}

type MessageType =
  | "register" | "unregister"
  | "join_group" | "leave_group"
  | "broadcast" | "direct"
  | "ping" | "pong"
  | "error" | "ack";
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
3. **Envelope Only**: Gateway adds routing metadata (fromNodeId, groupId) but doesn't modify payload
4. **Stateless**: Gateway doesn't buffer or persist stream events

**Example: Agent Response Flow**

```json
// 1. Agent starts
{
  "type": "broadcast",
  "nodeId": "agent-abc",
  "groupId": "room-xyz",
  "payload": {
    "type": "agent-start",
    "agent": "coder",
    "prompt": "Review the auth code",
    "timestamp": 1706000000000
  }
}

// 2. Streaming tokens
{
  "type": "broadcast",
  "nodeId": "agent-abc",
  "groupId": "room-xyz",
  "payload": {
    "type": "agent-stream",
    "chunk": { "event": "on_chat_model_stream", "data": {"chunk": "The"} },
    "timestamp": 1706000000100
  }
}

// 3. Tool execution
{
  "type": "broadcast",
  "nodeId": "agent-abc",
  "groupId": "room-xyz",
  "payload": {
    "type": "tool-start",
    "toolName": "command_execute",
    "toolInput": { "command": "cat src/auth.ts" },
    "timestamp": 1706000001000
  }
}

// 4. Agent complete
{
  "type": "broadcast",
  "nodeId": "agent-abc",
  "groupId": "room-xyz",
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
  --port <number>         Port (default: 3000)
  --host <string>         Host (default: 0.0.0.0)
  --auth                  Enable authentication
  --token <string>        Auth token
  --discovery <method>    Discovery: mdns, tailscale
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

#### Node Connection
```bash
# Join gateway
wingman gateway join <url> [options]
  --name <string>         Node name
  --token <string>        Auth token
  --group <string>        Auto-join group
  --transport <type>      Transport: websocket, http
  --auto-transport        Auto-detect transport
  --auto-discover         Join first discovered gateway

# Discover gateways
wingman gateway discover [options]
  --tailscale             Discover via Tailscale
  --timeout <ms>          Timeout (default: 5000)
  --verbose               Show details
```

#### Utilities
```bash
# Generate token
wingman gateway token --generate

# Check health
wingman gateway health [options]
  --host <string>         Gateway host
  --port <number>         Gateway port

# SSH tunnel
wingman gateway tunnel <user@host> [options]
  --port <number>         Gateway port
  --name <string>         Node name
  reverse                 Reverse tunnel
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
    "totalNodes": 5,
    "totalGroups": 2,
    "messagesProcessed": 1000,
    "startedAt": 1234567890
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
    "totalNodes": 5,
    "totalGroups": 2,
    "messagesProcessed": 1000
  },
  "nodes": {
    "totalNodes": 5,
    "nodes": [...]
  },
  "groups": {
    "totalGroups": 2,
    "groups": [...]
  }
}
```

### WebSocket Messages

#### Register
```json
{
  "type": "register",
  "payload": {
    "name": "agent-1",
    "capabilities": ["coding", "research"],
    "token": "abc123"
  },
  "timestamp": 1234567890
}
```

#### Join Group
```json
{
  "type": "join_group",
  "nodeId": "abc123",
  "payload": {
    "groupName": "swarm-1",
    "createIfNotExists": true,
    "description": "Collaborative coding"
  },
  "timestamp": 1234567890
}
```

#### Broadcast
```json
{
  "type": "broadcast",
  "nodeId": "abc123",
  "payload": {
    "groupId": "xyz789",
    "message": {
      "type": "task",
      "content": "Review code in PR #123"
    }
  },
  "timestamp": 1234567890
}
```

---

## Configuration

### Gateway Config
```json
{
  "port": 3000,
  "host": "0.0.0.0",
  "requireAuth": false,
  "authToken": "secret-token",
  "maxNodes": 1000,
  "pingInterval": 30000,
  "pingTimeout": 60000,
  "logLevel": "info"
}
```

### Discovery Config
```json
{
  "discovery": {
    "enabled": true,
    "method": "mdns",
    "name": "My Gateway",
    "tailscale": {
      "apiKey": "optional",
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
- Concurrent nodes: 1000+ (per gateway)
- Broadcast groups: 100+ (per gateway)

### Scalability
- Horizontal scaling via multiple gateway instances
- No single point of failure
- Stateless design (future: shared state via Redis/KV)

---

## Security

### Authentication
- Token-based authentication (HMAC-SHA256)
- Optional auth mode for trusted networks
- Token rotation support

### Network Security
- mDNS: Local network only (inherent security)
- Tailscale: Uses Tailscale ACLs
- Public: Requires auth token + HTTPS

### Rate Limiting
- 100 messages per minute per node (default)
- Configurable per gateway
- Blocks on rate limit exceeded

### Message Validation
- Zod schema validation for all messages
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
- Message validation
- Rate limiting logic
- Node management
- Broadcast group operations

### Integration Tests
- Multi-node scenarios
- Broadcast group messaging
- Discovery mechanisms
- Transport fallback

### Load Tests
- 1000 concurrent nodes
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
