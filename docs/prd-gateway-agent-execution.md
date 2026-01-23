# PRD: Gateway Agent Execution

**Status:** Planning
**Priority:** P1 (Medium Priority)
**Target Release:** Phase 3
**Owner:** Wingman Gateway Team
**Last Updated:** 2026-01-22

---

## Executive Summary

Enable remote agent execution through the Wingman Gateway, streaming structured JSON events to web and mobile UIs. This transforms the gateway from a simple message broker into a full agent orchestration system, allowing multiple clients (web, mobile, desktop) to invoke agents and receive real-time streaming responses.

**Architecture Inspiration:** ClawdBot coordinator/node pattern

---

## Problem Statement

### Current State
- **Gateway is message broker only**: Currently routes messages between nodes but doesn't execute agents
- **No remote agent execution**: Web/mobile apps can't invoke Wingman agents
- **Separate OutputManager protocols**: Gateway uses `GatewayMessage`, OutputManager uses `OutputEvent`
- **No UI integration path**: No way to display rich tool visualization in web UIs

### User Pain Points
1. **CLI-only limitation**: Agents only accessible via terminal
2. **No multi-platform support**: Can't build web/mobile apps on top of Wingman
3. **Duplicate implementation**: Would need to reimplement agent execution for each client
4. **No real-time streaming**: REST APIs don't provide streaming event updates

---

## Goals and Non-Goals

### Goals
✅ Enable remote agent invocation through WebSocket gateway
✅ Stream OutputManager JSON events to connected clients
✅ Maintain session persistence across CLI and gateway
✅ Support multiple concurrent agent executions
✅ Provide structured events for UI rendering (tools, text, status)
✅ Follow ClawdBot architecture patterns (coordinator/node)

### Non-Goals
❌ Authentication/authorization (future security layer)
❌ Rate limiting (future feature)
❌ Agent marketplace (separate product)
❌ Custom agent creation via gateway (use CLI)
❌ File uploads through WebSocket (use HTTP endpoints)

---

## Architecture Overview

### Coordinator/Node Pattern (ClawdBot-Inspired)

```
┌─────────────────────────────────────────────────────────────┐
│                    Gateway (Coordinator)                    │
│  - Manages WebSocket connections                           │
│  - Routes invocation requests                              │
│  - Validates frames (JSON Schema)                          │
│  - Maintains idempotency                                    │
│  - Streams events to clients                               │
└────────────┬────────────────────────────────┬──────────────┘
             │                                │
    ┌────────▼────────┐              ┌────────▼──────────┐
    │  Agent Node 1   │              │  Agent Node 2     │
    │  (Local)        │              │  (Remote)         │
    │  - researcher   │              │  - coder          │
    │  - analyst      │              │  - reviewer       │
    └─────────────────┘              └───────────────────┘
```

### Communication Protocol

**Request/Response + Event Streaming:**
```typescript
// Client → Gateway: Invoke agent
{
  type: "req",
  id: "req-123",           // Idempotency key
  method: "invoke-agent",
  params: {
    agentName: "researcher",
    prompt: "What is TypeScript?",
    sessionId?: "abc123",   // Optional resumption
    outputFormat: "json"
  }
}

// Gateway → Client: Streaming events
{
  type: "event",
  requestId: "req-123",
  event: {
    type: "agent-stream",
    chunk: {...},           // Raw OutputEvent
    timestamp: "2026-01-22T..."
  }
}

// Gateway → Client: Final response
{
  type: "res",
  requestId: "req-123",
  ok: true,
  payload: {
    sessionId: "abc123",
    messageCount: 5,
    result: "..."
  }
}
```

---

## User Experience

### Web Application Flow

**1. Connection Establishment**
```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

// Register client node
ws.send(JSON.stringify({
  type: 'register',
  nodeId: 'webapp-user123',
  capabilities: [],        // Web clients don't execute agents
  metadata: {
    platform: 'web',
    userAgent: navigator.userAgent
  }
}));
```

**2. Agent Invocation**
```javascript
// Invoke agent
ws.send(JSON.stringify({
  type: 'req',
  id: 'req-' + Date.now(),
  method: 'invoke-agent',
  params: {
    agentName: 'researcher',
    prompt: 'List all TypeScript files in src/',
    outputFormat: 'json'
  }
}));

// Handle streaming events
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === 'event') {
    const outputEvent = msg.event;

    switch (outputEvent.type) {
      case 'agent-stream':
        // Parse chunk for text, tool calls, tool results
        const parsed = parseStreamChunk(outputEvent.chunk);
        if (parsed.type === 'tool') {
          showToolCallUI(parsed.toolCall);
        } else if (parsed.type === 'text') {
          appendTextToChat(parsed.text);
        }
        break;

      case 'agent-complete':
        showCompletionStatus();
        break;

      case 'agent-error':
        showErrorUI(outputEvent.error);
        break;
    }
  }

  if (msg.type === 'res') {
    // Final response with session info
    console.log('Session ID:', msg.payload.sessionId);
    console.log('Message count:', msg.payload.messageCount);
  }
};
```

**3. UI Rendering**
```javascript
// Example: Render tool call in React
function ToolCallDisplay({ toolCall }) {
  return (
    <div className="tool-call">
      <div className="tool-header">
        <span className="tool-icon">{getIconForTool(toolCall.name)}</span>
        <span className="tool-name">{toolCall.name}</span>
        <span className="tool-status">{toolCall.status}</span>
      </div>
      <div className="tool-args">
        <pre>{JSON.stringify(toolCall.args, null, 2)}</pre>
      </div>
    </div>
  );
}
```

### Mobile Application Flow

**Swift (iOS Example):**
```swift
import Starscream

class WingmanClient {
  let socket = WebSocket(url: URL(string: "ws://localhost:3000/ws")!)

  func invokeAgent(name: String, prompt: String) {
    let request = [
      "type": "req",
      "id": "req-\(UUID().uuidString)",
      "method": "invoke-agent",
      "params": [
        "agentName": name,
        "prompt": prompt,
        "outputFormat": "json"
      ]
    ]

    socket.write(string: JSONSerialization.data(withJSONObject: request))
  }

  func handleMessage(_ message: String) {
    let json = try JSONDecoder().decode(GatewayMessage.self, from: message.data(using: .utf8)!)

    if json.type == "event" {
      // Render in SwiftUI
      if json.event.type == "agent-stream" {
        // Update chat UI
      }
    }
  }
}
```

---

## Technical Design

### Component Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Gateway Server                           │
│  - WebSocket server (Bun native)                            │
│  - Node registry (capabilities, metadata)                   │
│  - Request router                                            │
│  - Frame validator (JSON Schema)                            │
└────────────┬─────────────────────────────────┬──────────────┘
             │                                 │
    ┌────────▼────────┐               ┌───────▼──────────┐
    │ AgentHandler    │               │ SessionManager   │
    │ - Creates       │               │ - Shared SQLite  │
    │   OutputManager │               │ - Checkpointing  │
    │ - Creates       │               │ - Multi-client   │
    │   AgentInvoker  │               │   access         │
    │ - Streams events│               └──────────────────┘
    └─────────────────┘
             │
    ┌────────▼────────┐
    │ EventBridge     │
    │ - Wraps Output  │
    │   Events in     │
    │   Gateway msgs  │
    │ - Sends to      │
    │   requesting    │
    │   client        │
    └─────────────────┘
```

### Data Models

**Gateway Messages:**
```typescript
// Request to invoke agent
interface InvokeAgentRequest {
  type: 'req';
  id: string;              // Idempotency key
  method: 'invoke-agent';
  params: {
    agentName: string;
    prompt: string;
    sessionId?: string;    // Resume existing session
    outputFormat: 'json';  // Only JSON for gateway
  };
}

// Streaming event wrapper
interface AgentEventMessage {
  type: 'event';
  requestId: string;       // Links to original request
  event: OutputEvent;      // Original OutputManager event
}

// Final response
interface AgentInvokeResponse {
  type: 'res';
  requestId: string;
  ok: boolean;
  payload?: {
    sessionId: string;
    messageCount: number;
    result: string;
  };
  error?: string;
}

// Node capability declaration
interface NodeCapabilities {
  agents: string[];        // Which agents this node can execute
  concurrent: number;      // Max concurrent executions
  metadata: {
    location: string;      // 'local' | 'remote'
    platform: string;      // 'linux' | 'darwin' | 'windows'
  };
}
```

**Output Events (Reused from CLI):**
```typescript
interface OutputEvent {
  type: 'agent-start' | 'agent-stream' | 'agent-complete' | 'agent-error' | 'log';
  timestamp: string;
  // Type-specific fields...
}
```

### Execution Flow

```
1. Client sends invoke-agent request
     ↓
2. Gateway validates request (JSON schema)
     ↓
3. Gateway finds capable node (or executes locally)
     ↓
4. AgentHandler creates OutputManager (JSON mode)
     ↓
5. AgentHandler creates SessionManager (shared DB)
     ↓
6. AgentHandler invokes agent via AgentInvoker
     ↓
7. OutputManager emits events (agent-stream, etc.)
     ↓
8. EventBridge listens to OutputManager events
     ↓
9. EventBridge wraps each event in AgentEventMessage
     ↓
10. Gateway sends event to requesting client (WebSocket)
     ↓
11. Client receives event, parses, updates UI
     ↓
12. Repeat steps 7-11 until agent-complete
     ↓
13. Gateway sends final response with session info
```

---

## Implementation Plan

### Phase 3.1: Gateway Agent Handler (Week 1)

**New Files:**
- `wingman/src/gateway/agentHandler.ts` - Agent execution handler
- `wingman/src/gateway/eventBridge.ts` - OutputEvent → GatewayMessage wrapper
- `wingman/src/gateway/nodeRegistry.ts` - Track node capabilities

**Modified Files:**
- `wingman/src/gateway/types.ts` - Add InvokeAgentRequest, AgentEventMessage types
- `wingman/src/gateway/server.ts` - Add invoke-agent message handler

**Tasks:**
1. Create AgentHandler with OutputManager integration
2. Create EventBridge to wrap OutputEvents
3. Add invoke-agent message type to gateway protocol
4. Route invoke-agent requests to AgentHandler

### Phase 3.2: Event Streaming (Week 1)

**Modified Files:**
- `wingman/src/gateway/server.ts` - Stream events to requesting client
- `wingman/src/gateway/agentHandler.ts` - Listen to OutputManager events

**Tasks:**
1. Subscribe to OutputManager events in AgentHandler
2. Wrap each OutputEvent in AgentEventMessage
3. Send event messages to client via WebSocket
4. Handle client disconnection (cancel agent execution)

### Phase 3.3: Session Sharing (Week 2)

**Modified Files:**
- `wingman/src/cli/core/sessionManager.ts` - Ensure thread-safe for concurrent access
- `wingman/src/gateway/agentHandler.ts` - Use shared SessionManager

**Tasks:**
1. Verify SQLite WAL mode enabled (concurrent reads)
2. Test session creation from gateway
3. Test session resumption from CLI after gateway creation
4. Test vice versa (gateway resumes CLI session)

### Phase 3.4: Node Capabilities (Week 2)

**Modified Files:**
- `wingman/src/gateway/nodeRegistry.ts` - Add capability tracking
- `wingman/src/gateway/server.ts` - Handle node registration with capabilities

**Tasks:**
1. Add capabilities field to node registration
2. Track which nodes can execute which agents
3. Route invoke-agent to capable node (if remote)
4. Reject requests if no capable node available

### Phase 3.5: Testing & Documentation (Week 3)

**New Files:**
- `examples/gateway-web-client.html` - Reference web implementation
- `examples/gateway-react-app/` - React example with hooks
- `docs/gateway-client-guide.md` - Client implementation guide

**Tasks:**
1. Create reference web client (vanilla JS)
2. Create React example app with hooks
3. Write client implementation guide
4. Performance testing (10+ concurrent agents)
5. Load testing (100+ connected clients)

---

## API Reference

### WebSocket Protocol

**Endpoint:** `ws://localhost:3000/ws`

#### Node Registration
```json
{
  "type": "register",
  "nodeId": "unique-client-id",
  "capabilities": [],
  "metadata": {
    "platform": "web",
    "userAgent": "Mozilla/5.0..."
  }
}
```

#### Invoke Agent
```json
{
  "type": "req",
  "id": "req-abc123",
  "method": "invoke-agent",
  "params": {
    "agentName": "researcher",
    "prompt": "Your prompt here",
    "sessionId": "optional-session-id",
    "outputFormat": "json"
  }
}
```

#### Streaming Events (Server → Client)
```json
{
  "type": "event",
  "requestId": "req-abc123",
  "event": {
    "type": "agent-stream",
    "chunk": {
      "messages": [...]
    },
    "timestamp": "2026-01-22T14:30:00.000Z"
  }
}
```

#### Final Response (Server → Client)
```json
{
  "type": "res",
  "requestId": "req-abc123",
  "ok": true,
  "payload": {
    "sessionId": "def456",
    "messageCount": 3,
    "result": "Final response text"
  }
}
```

#### Error Response
```json
{
  "type": "res",
  "requestId": "req-abc123",
  "ok": false,
  "error": "Agent 'unknown-agent' not found"
}
```

---

## Client Libraries

### JavaScript/TypeScript

**Installation:**
```bash
npm install @wingman-ai/client
```

**Usage:**
```typescript
import { WingmanClient } from '@wingman-ai/client';

const client = new WingmanClient('ws://localhost:3000/ws');

await client.connect();

const stream = await client.invokeAgent({
  agent: 'researcher',
  prompt: 'What is TypeScript?'
});

for await (const event of stream) {
  if (event.type === 'text') {
    console.log(event.text);
  } else if (event.type === 'tool') {
    console.log('Tool:', event.toolCall.name);
  }
}
```

### React Hook

```typescript
import { useWingmanAgent } from '@wingman-ai/react';

function ChatComponent() {
  const { invoke, events, isLoading } = useWingmanAgent();

  const handleSubmit = async (prompt: string) => {
    await invoke({ agent: 'researcher', prompt });
  };

  return (
    <div>
      {events.map((event, i) => (
        <EventRenderer key={i} event={event} />
      ))}
      {isLoading && <Spinner />}
    </div>
  );
}
```

### Python

**Installation:**
```bash
pip install wingman-client
```

**Usage:**
```python
from wingman import WingmanClient

client = WingmanClient('ws://localhost:3000/ws')
await client.connect()

async for event in client.invoke_agent('researcher', 'What is TypeScript?'):
    if event.type == 'text':
        print(event.text)
    elif event.type == 'tool':
        print(f"Tool: {event.tool_call.name}")
```

---

## Security Considerations

### Phase 3 (MVP)
- **Local network only**: Gateway binds to `localhost` or `0.0.0.0` (user choice)
- **No authentication**: Trust-based (same network)
- **No encryption**: Plain WebSocket (ws://)

### Future (Post-MVP)
- **Authentication**: JWT-based or API key
- **Authorization**: Role-based access control (RBAC)
- **Encryption**: WSS (WebSocket Secure)
- **Rate limiting**: Per-user quotas
- **Audit logging**: Track all agent invocations

---

## Testing Strategy

### Unit Tests
- AgentHandler creates OutputManager correctly
- EventBridge wraps OutputEvents properly
- NodeRegistry tracks capabilities accurately
- Request validation catches invalid frames

### Integration Tests
- Gateway invokes agent and streams events
- Client receives events in correct order
- Session persistence works across CLI/gateway
- Multiple concurrent agent executions

### End-to-End Tests
- Web client connects, invokes agent, renders UI
- Mobile client (iOS simulator) full flow
- Session resumption from gateway to CLI
- Error handling (network failures, agent errors)

### Performance Tests
- 10 concurrent agent invocations
- 100 connected clients (idle)
- Large tool outputs (1MB+ results)
- Long-running agents (5+ minutes)

---

## Success Metrics

### Functional
✅ Web/mobile clients can invoke agents
✅ Events stream in real-time (<100ms latency)
✅ Session persistence works across interfaces
✅ Tool visualization data accessible to clients
✅ Error handling graceful

### Performance
- **Latency**: <100ms event delivery
- **Throughput**: 10+ concurrent agents per gateway
- **Scalability**: 100+ connected clients
- **Reliability**: 99.9%+ uptime

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| WebSocket connection drops | High | Medium | Implement reconnection with replay |
| Session database contention | Medium | Low | Use WAL mode, connection pooling |
| Memory leaks in long-running agents | High | Medium | Monitor memory, set execution limits |
| Large event payloads overwhelm clients | Medium | Medium | Implement event batching, compression |
| Security vulnerabilities (no auth) | High | High | Document as dev-only, add auth in next phase |

---

## Future Enhancements

### Post-MVP Features
- **Authentication**: JWT or API key based
- **Rate limiting**: Per-user quotas
- **Agent marketplace**: Discover and install community agents
- **Multi-node execution**: Distribute agents across multiple nodes
- **Event replay**: Resume interrupted streams
- **Compression**: Gzip for large events
- **Binary protocol**: More efficient than JSON
- **GraphQL subscriptions**: Alternative to WebSocket

---

## Related Documents

- [PRD: CLI REPL Mode](/docs/prd-cli-repl-mode.md) - Phase 2
- [Phase 1: Rich Tool Visualization](/.claude/plans/fancy-munching-codd.md) - Completed
- [Architecture: Gateway](/docs/architecture-gateway.md) - Reference
- [Client Implementation Guide](/docs/gateway-client-guide.md) - For developers

---

## Appendix: ClawdBot Architecture Reference

**Key Principles Adopted:**
1. **Coordinator/Node separation**: Gateway coordinates, nodes execute
2. **Capability declaration**: Nodes announce which agents they can run
3. **Request/Response + Events**: Hybrid synchronous + async pattern
4. **Idempotent operations**: Deduplication keys for safe retries
5. **Device-based identity**: Local nodes auto-trusted, remote require auth

**Differences from ClawdBot:**
- Wingman uses OutputManager events (not custom protocol)
- Session persistence via SQLite (not in-memory)
- Focus on agent execution (not general RPC)
- LangGraph streaming (not custom agent framework)

---

**Document Version:** 1.0
**Status:** Draft
**Next Review:** After Phase 2 (REPL) completion
