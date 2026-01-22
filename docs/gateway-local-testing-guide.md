# Wingman Gateway - Local Testing Guide

This guide will walk you through testing all the gateway features locally on your machine.

## Prerequisites

- Bun installed
- Project built (`bun install` in wingman directory)
- Three terminal windows/tabs

## Quick Start (5 minutes)

### Terminal 1: Start the Gateway

```bash
cd wingman
bun run src/cli/index.ts gateway start --discovery mdns --name "Test Gateway"
```

You should see:
```
✓ Gateway started successfully
  URL: ws://0.0.0.0:3000/ws
  Health: http://0.0.0.0:3000/health
  Logs: /path/to/logs
```

### Terminal 2: Join as Node 1

```bash
cd wingman
bun run src/cli/index.ts gateway join ws://localhost:3000/ws --name "node-1" --group "test-swarm"
```

You should see:
```
Connecting to gateway: ws://localhost:3000/ws
Node name: node-1
✓ Connected to gateway
✓ Registered as node-1 (node-xxx)
✓ Joined group: test-swarm (group-xxx)

Ready to receive messages. Press Ctrl+C to exit.
```

### Terminal 3: Join as Node 2

```bash
cd wingman
bun run src/cli/index.ts gateway join ws://localhost:3000/ws --name "node-2" --group "test-swarm"
```

You should see the same connection messages as Node 1.

### Test Broadcasting

Both Node 1 and Node 2 are now in the "test-swarm" group. When one sends a broadcast, the other will receive it.

Currently, there's no built-in CLI command to send test messages, but you can verify the connection by watching the console output.

## Detailed Testing Scenarios

### 1. Test mDNS Discovery

**Terminal 1: Start gateway with mDNS**
```bash
cd wingman
bun run src/cli/index.ts gateway start --discovery mdns --name "Local Gateway"
```

**Terminal 2: Discover the gateway**
```bash
cd wingman
bun run src/cli/index.ts gateway discover
```

Expected output:
```
Discovering gateways on local network (5000ms timeout)...

✓ Found 1 gateway(s):

  Local Gateway
    URL: ws://192.168.x.x:3000/ws
    Auth: Optional

To connect to a gateway:
  wingman gateway join <url> --name "my-node"
```

**Terminal 2: Discover with verbose mode**
```bash
bun run src/cli/index.ts gateway discover --verbose
```

Expected output includes additional details:
```
  Local Gateway
    URL: ws://192.168.x.x:3000/ws
    Auth: Optional
    Host: 192.168.x.x
    Port: 3000
    Transport: ws
    Capabilities: broadcast, direct, groups
    Version: 1.0.0
```

### 2. Test HTTP Bridge Transport

**Terminal 1: Start gateway**
```bash
cd wingman
bun run src/cli/index.ts gateway start
```

**Terminal 2: Connect via HTTP bridge**
```bash
cd wingman
bun run src/cli/index.ts gateway join http://localhost:3000 --transport http --name "http-node" --group "http-test"
```

Expected output:
```
Connecting to gateway: http://localhost:3000
Node name: http-node
Transport: http
✓ Connected to gateway
✓ Registered as http-node (node-xxx)
✓ Joined group: http-test (group-xxx)
```

**Terminal 3: Connect via WebSocket to same group**
```bash
cd wingman
bun run src/cli/index.ts gateway join ws://localhost:3000/ws --name "ws-node" --group "http-test"
```

Both nodes are now in the same group, one using HTTP bridge and one using WebSocket!

### 3. Test Auto Transport Selection

**Terminal 1: Start gateway**
```bash
cd wingman
bun run src/cli/index.ts gateway start
```

**Terminal 2: Join with auto transport (WebSocket URL)**
```bash
cd wingman
bun run src/cli/index.ts gateway join ws://localhost:3000/ws --transport auto --name "auto-ws"
```
Should use WebSocket transport.

**Terminal 3: Join with auto transport (HTTP URL)**
```bash
cd wingman
bun run src/cli/index.ts gateway join http://localhost:3000 --transport auto --name "auto-http"
```
Should use HTTP bridge transport.

### 4. Test Authentication

**Terminal 1: Generate token**
```bash
cd wingman
bun run src/cli/index.ts gateway token --generate
```

Copy the token from output.

**Terminal 1: Start gateway with auth**
```bash
cd wingman
bun run src/cli/index.ts gateway start --auth --token="<paste-token-here>"
```

**Terminal 2: Try to join without token (should fail)**
```bash
cd wingman
bun run src/cli/index.ts gateway join ws://localhost:3000/ws --name "unauthorized"
```
Should see an error or rejection.

**Terminal 2: Join with token (should succeed)**
```bash
cd wingman
bun run src/cli/index.ts gateway join ws://localhost:3000/ws --name "authorized" --token="<paste-token-here>"
```
Should connect successfully.

### 5. Test Gateway Status & Health

**Terminal 1: Start gateway**
```bash
cd wingman
bun run src/cli/index.ts gateway start
```

**Terminal 2: Check status**
```bash
cd wingman
bun run src/cli/index.ts gateway status
```

Expected output:
```
Gateway Status: Running
  PID: 12345
  Uptime: 0h 0m 15s
  Host: 0.0.0.0
  Port: 3000
  Auth Required: false
  Max Nodes: 1000
  Log File: /path/to/logs
```

**Terminal 2: Check health**
```bash
cd wingman
bun run src/cli/index.ts gateway health
```

Expected output:
```json
{
  "status": "healthy",
  "uptime": 30000,
  "nodes": 0,
  "groups": 0,
  "version": "1.0.0"
}
```

### 6. Test Rate Limiting

**Terminal 1: Start gateway**
```bash
cd wingman
bun run src/cli/index.ts gateway start
```

**Terminal 2: Connect a node**
```bash
cd wingman
bun run src/cli/index.ts gateway join ws://localhost:3000/ws --name "rate-test"
```

To test rate limiting, you would need to send >100 messages within 60 seconds. The gateway will start rejecting messages with "RATE_LIMITED" error.

Default limits:
- 100 messages per 60-second window
- Configurable in NodeManager constructor

### 7. Test Daemon Mode

**Terminal 1: Start as daemon**
```bash
cd wingman
bun run src/cli/index.ts gateway start --discovery mdns --name "Daemon Gateway"
```

The gateway runs in the background. You can verify it's running:

**Terminal 1: Check status**
```bash
bun run src/cli/index.ts gateway status
```

**Terminal 2: Connect to it**
```bash
cd wingman
bun run src/cli/index.ts gateway join ws://localhost:3000/ws --name "daemon-client"
```

**Stop the daemon**
```bash
cd wingman
bun run src/cli/index.ts gateway stop
```

### 8. Test SSH Tunnel (Requires SSH Access)

If you have SSH access to another machine (or localhost):

**Terminal 1: Start gateway on "remote" machine**
```bash
# On the remote machine (or in another terminal)
cd wingman
bun run src/cli/index.ts gateway start
```

**Terminal 2: Connect via SSH tunnel**
```bash
cd wingman
bun run src/cli/index.ts gateway tunnel user@localhost --name "tunnel-test" --port 3000
```

This creates an SSH tunnel and automatically connects through it.

Expected output:
```
Creating SSH tunnel to gateway...
  SSH Host: user@localhost
  Remote Port: 3000
  Local Port: 13000

✓ SSH tunnel established

Connecting to gateway through tunnel...
✓ Connected to gateway
✓ Registered as tunnel-test (node-xxx)
```

## Testing Broadcast Groups

To test message broadcasting between nodes:

**Terminal 1: Start gateway**
```bash
cd wingman
bun run src/cli/index.ts gateway start
```

**Terminal 2: Join as receiver-1**
```bash
cd wingman
bun run src/cli/index.ts gateway join ws://localhost:3000/ws --name "receiver-1" --group "chat"
```

**Terminal 3: Join as receiver-2**
```bash
cd wingman
bun run src/cli/index.ts gateway join ws://localhost:3000/ws --name "receiver-2" --group "chat"
```

**Terminal 4: Join as sender**
```bash
cd wingman
bun run src/cli/index.ts gateway join ws://localhost:3000/ws --name "sender" --group "chat"
```

Now all three nodes are in the "chat" group. Any broadcast message sent by one will be received by the others.

*Note: Currently, the CLI join command only receives messages. To send test messages, you would need to use the GatewayClient programmatically or extend the CLI.*

## Testing Multiple Agent Types

The gateway supports joining multiple agents of different types as individual nodes. Each agent can have:
- **Unique name**: Identifies the specific node
- **Capabilities**: Array of strings describing what the agent can do
- **Session ID**: Groups agents by session (optional)
- **Agent Name**: Identifies the agent type (optional)

### Programmatic Multi-Agent Setup

Create a file `multi-agent-test.ts`:

```typescript
import { GatewayClient } from "./src/gateway/client.js";

async function runMultiAgentTest() {
  const gatewayUrl = "ws://localhost:3000/ws";
  const groupName = "ai-swarm";

  // Create a research agent
  const researchAgent = new GatewayClient(gatewayUrl, "research-agent-1", {
    capabilities: ["web-search", "data-analysis", "summarization"],
    events: {
      registered: (nodeId, name) => {
        console.log(`[Research] Registered: ${name} (${nodeId})`);
        researchAgent.joinGroup(groupName);
      },
      joinedGroup: (groupId, groupName) => {
        console.log(`[Research] Joined group: ${groupName}`);
      },
      broadcast: (message: any, fromNodeId, groupId) => {
        console.log(`[Research] Received from ${fromNodeId}:`, message);

        // Research agent responds to research requests
        if (message.type === "request" && message.capability === "research") {
          console.log("[Research] Processing research request...");
          setTimeout(() => {
            researchAgent.broadcast(groupId, {
              type: "response",
              capability: "research",
              data: "Research completed: Found 10 relevant papers",
              requestId: message.requestId,
            });
          }, 1000);
        }
      },
    },
  });

  // Create a coding agent
  const codingAgent = new GatewayClient(gatewayUrl, "coding-agent-1", {
    capabilities: ["code-generation", "testing", "refactoring"],
    events: {
      registered: (nodeId, name) => {
        console.log(`[Coding] Registered: ${name} (${nodeId})`);
        codingAgent.joinGroup(groupName);
      },
      joinedGroup: (groupId, groupName) => {
        console.log(`[Coding] Joined group: ${groupName}`);
      },
      broadcast: (message: any, fromNodeId, groupId) => {
        console.log(`[Coding] Received from ${fromNodeId}:`, message);

        // Coding agent responds to code requests
        if (message.type === "request" && message.capability === "coding") {
          console.log("[Coding] Processing coding request...");
          setTimeout(() => {
            codingAgent.broadcast(groupId, {
              type: "response",
              capability: "coding",
              data: "Code generated: function example() {...}",
              requestId: message.requestId,
            });
          }, 1000);
        }
      },
    },
  });

  // Create a coordinator agent
  const coordinatorAgent = new GatewayClient(gatewayUrl, "coordinator-1", {
    capabilities: ["task-planning", "orchestration"],
    events: {
      registered: (nodeId, name) => {
        console.log(`[Coordinator] Registered: ${name} (${nodeId})`);
        coordinatorAgent.joinGroup(groupName);
      },
      joinedGroup: (groupId, groupName) => {
        console.log(`[Coordinator] Joined group: ${groupName}`);

        // Coordinator sends tasks to other agents
        console.log("[Coordinator] Sending task requests...");
        setTimeout(() => {
          coordinatorAgent.broadcast(groupId, {
            type: "request",
            capability: "research",
            task: "Find papers on AI agents",
            requestId: "req-1",
          });
        }, 2000);

        setTimeout(() => {
          coordinatorAgent.broadcast(groupId, {
            type: "request",
            capability: "coding",
            task: "Generate example function",
            requestId: "req-2",
          });
        }, 3000);
      },
      broadcast: (message: any, fromNodeId, groupId) => {
        console.log(`[Coordinator] Received from ${fromNodeId}:`, message);

        if (message.type === "response") {
          console.log(`[Coordinator] Task ${message.requestId} completed!`);
        }
      },
    },
  });

  // Connect all agents
  await Promise.all([
    researchAgent.connect(),
    codingAgent.connect(),
    coordinatorAgent.connect(),
  ]);

  console.log("\nAll agents connected! Watching for messages...\n");

  // Keep running
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // Cleanup
  researchAgent.disconnect();
  codingAgent.disconnect();
  coordinatorAgent.disconnect();

  console.log("\nTest completed!");
  process.exit(0);
}

runMultiAgentTest().catch(console.error);
```

**Run it:**
```bash
# Terminal 1: Start gateway
cd wingman
bun run src/cli/index.ts gateway start

# Terminal 2: Run multi-agent test
cd wingman
bun run multi-agent-test.ts
```

**Expected output:**
```
[Research] Registered: research-agent-1 (node-xxx)
[Coding] Registered: coding-agent-1 (node-xxx)
[Coordinator] Registered: coordinator-1 (node-xxx)
[Research] Joined group: ai-swarm
[Coding] Joined group: ai-swarm
[Coordinator] Joined group: ai-swarm
[Coordinator] Sending task requests...
[Research] Received from node-xxx: { type: 'request', capability: 'research', ... }
[Research] Processing research request...
[Coding] Received from node-xxx: { type: 'request', capability: 'coding', ... }
[Coding] Processing coding request...
[Coordinator] Received from node-xxx: { type: 'response', ... }
[Coordinator] Task req-1 completed!
```

### Session-Based Agent Grouping

You can also group agents by session (useful for multi-user scenarios):

```typescript
import { GatewayClient } from "./src/gateway/client.js";

async function runSessionBasedTest() {
  const gatewayUrl = "ws://localhost:3000/ws";

  // Session 1: User Alice's agents
  const aliceResearch = new GatewayClient(gatewayUrl, "alice-research", {
    capabilities: ["research"],
    // Note: sessionId/agentName would need to be added to client registration
  });

  const aliceCoding = new GatewayClient(gatewayUrl, "alice-coding", {
    capabilities: ["coding"],
  });

  // Session 2: User Bob's agents
  const bobResearch = new GatewayClient(gatewayUrl, "bob-research", {
    capabilities: ["research"],
  });

  const bobCoding = new GatewayClient(gatewayUrl, "bob-coding", {
    capabilities: ["coding"],
  });

  // Alice's agents join "session-alice" group
  await aliceResearch.connect();
  await aliceCoding.connect();
  await aliceResearch.joinGroup("session-alice");
  await aliceCoding.joinGroup("session-alice");

  // Bob's agents join "session-bob" group
  await bobResearch.connect();
  await bobCoding.connect();
  await bobResearch.joinGroup("session-bob");
  await bobCoding.joinGroup("session-bob");

  console.log("Session-based agents connected!");
  console.log("- Alice's agents in group: session-alice");
  console.log("- Bob's agents in group: session-bob");
  console.log("Messages broadcast within each group stay isolated.");
}

runSessionBasedTest().catch(console.error);
```

### Real-World Use Cases

**Use Case 1: Development Team Simulation**
```typescript
// Planning agent coordinates tasks
// Research agent gathers requirements
// Coding agent implements features
// Testing agent validates code
// Documentation agent writes docs
```

**Use Case 2: Data Processing Pipeline**
```typescript
// Ingestion agent receives data
// Processing agent transforms data
// Analysis agent extracts insights
// Storage agent persists results
// Notification agent alerts users
```

**Use Case 3: Customer Support System**
```typescript
// Triage agent categorizes requests
// Knowledge agent searches documentation
// Response agent drafts replies
// Escalation agent handles complex cases
// Follow-up agent checks satisfaction
```

## Programmatic Testing (TypeScript)

Create a test file `test-gateway.ts`:

```typescript
import { GatewayClient } from "./src/gateway/client.js";

async function testBroadcast() {
  // Create two clients
  const client1 = new GatewayClient("ws://localhost:3000/ws", "client-1", {
    events: {
      registered: (nodeId, name) => {
        console.log(`[Client 1] Registered: ${name} (${nodeId})`);
        // Join group
        client1.joinGroup("test-group");
      },
      joinedGroup: (groupId, groupName) => {
        console.log(`[Client 1] Joined group: ${groupName}`);
        // Send broadcast after 1 second
        setTimeout(() => {
          console.log("[Client 1] Sending broadcast...");
          client1.broadcast(groupId, { message: "Hello from client 1!" });
        }, 1000);
      },
      broadcast: (message, fromNodeId) => {
        console.log(`[Client 1] Received broadcast from ${fromNodeId}:`, message);
      },
    },
  });

  const client2 = new GatewayClient("ws://localhost:3000/ws", "client-2", {
    events: {
      registered: (nodeId, name) => {
        console.log(`[Client 2] Registered: ${name} (${nodeId})`);
        client2.joinGroup("test-group");
      },
      joinedGroup: (groupId, groupName) => {
        console.log(`[Client 2] Joined group: ${groupName}`);
      },
      broadcast: (message, fromNodeId) => {
        console.log(`[Client 2] Received broadcast from ${fromNodeId}:`, message);
        // Send reply
        client2.broadcast(groupId, { message: "Hello from client 2!" });
      },
    },
  });

  // Connect both clients
  await client1.connect();
  await client2.connect();

  // Keep running
  await new Promise(() => {});
}

testBroadcast().catch(console.error);
```

Run it:
```bash
cd wingman
bun run test-gateway.ts
```

## Troubleshooting

### Gateway won't start
- Check if port 3000 is already in use: `lsof -i :3000`
- Try a different port: `--port 3001`

### mDNS discovery not working
- Ensure both devices are on same network
- Check firewall allows mDNS (UDP 5353)
- On macOS, mDNS should work out of the box
- On Linux, ensure Avahi is running: `systemctl status avahi-daemon`

### SSH tunnel fails
- Verify SSH works: `ssh user@host`
- Check SSH key authentication is set up
- Try with verbose SSH: add `-v` to the tunnel command debug

### Nodes don't receive broadcasts
- Verify both nodes are in the same group
- Check gateway logs for errors
- Ensure WebSocket connection is stable

### HTTP bridge seems slow
- Long-polling has 30s timeout (expected)
- First message may take up to 30s
- Subsequent messages are faster due to queuing
- For low latency, use WebSocket transport

## Quick Validation Checklist

✅ Gateway starts successfully
✅ Can discover gateway via mDNS
✅ Can join via WebSocket
✅ Can join via HTTP bridge
✅ Multiple nodes can join same group
✅ Status command shows running gateway
✅ Health endpoint returns valid JSON
✅ Can stop gateway gracefully
✅ Authentication blocks unauthorized clients
✅ SSH tunnel establishes and connects

## Next Steps

Once you've verified local functionality:

1. Test on different machines on same LAN (mDNS discovery)
2. Test over Tailscale VPN (if you have Tailscale set up)
3. Test HTTP bridge through a firewall
4. Test SSH tunnel to remote machine
5. Build integration tests for your use case

## Support

If you encounter issues:
1. Check the gateway logs (path shown on start)
2. Verify Bun version: `bun --version`
3. Check TypeScript compilation: `bun build src/gateway/server.ts`
4. Review the implementation summary: `docs/gateway-implementation-summary.md`
