# Wingman Gateway - Product Requirements Document

## Overview

The Wingman Gateway enables AI agent swarming by providing a WebSocket-based communication hub that allows multiple Wingman nodes to connect, form broadcast groups, and collaborate on tasks.

**Version:** 1.0
**Status:** In Development
**Last Updated:** 2026-01-20

---

## Goals

### Primary Goals
1. Enable **AI agent swarming** - multiple agents working together on shared tasks
2. Support **local network discovery** (LAN/home office scenarios)
3. Provide **remote connectivity** via Tailscale for distributed teams
4. Offer **flexible deployment** options (local daemon, Cloudflare Workers)

### Secondary Goals
1. Support alternative transports (HTTP bridge, SSH tunnels) for firewall traversal
2. Provide simple authentication and authorization
3. Enable horizontal scaling via multiple gateway instances
4. Maintain low latency for real-time agent collaboration

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
# Logs: ~/.wingman/gateway.log
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

- [ClawdBot Gateway Documentation](https://docs.clawd.bot/cli/gateway)
- [WebSocket RFC 6455](https://tools.ietf.org/html/rfc6455)
- [mDNS RFC 6762](https://tools.ietf.org/html/rfc6762)
- [Tailscale API](https://tailscale.com/api)
