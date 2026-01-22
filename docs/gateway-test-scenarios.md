# Gateway Test Scenarios

Simple test scenarios for the Wingman Gateway.

## Prerequisites

```bash
cd wingman
bun install
```

---

## Scenario 1: Basic Gateway Startup

**Start the gateway:**
```bash
bun run src/cli/index.ts gateway start
```

**Expected output:**
```
Gateway daemon started with PID 12345
✓ Gateway started successfully
  URL: ws://0.0.0.0:3000/ws
  Health: http://0.0.0.0:3000/health
```

**Check health:**
```bash
curl http://localhost:3000/health
```

**Stop the gateway:**
```bash
bun run src/cli/index.ts gateway stop
```

---

## Scenario 2: Gateway with mDNS Discovery

**Start gateway with discovery:**
```bash
bun run src/cli/index.ts gateway start --discovery mdns --name "Test Gateway"
```

**Discover gateways (in another terminal):**
```bash
bun run src/cli/index.ts gateway discover --verbose
```

**Expected output:**
```
✓ Found 1 gateway(s):

  Test Gateway
    URL: ws://192.168.x.x:3000/ws
    Host: 192.168.x.x
    Port: 3000
```

---

## Scenario 3: Single Node Connection

**Terminal 1 - Start gateway:**
```bash
bun run src/cli/index.ts gateway start
```

**Terminal 2 - Join as a node:**
```bash
bun run src/cli/index.ts gateway join ws://localhost:3000/ws --name "test-node"
```

**Expected output:**
```
✓ Connected to gateway
  Node ID: abc123...
  Node Name: test-node
  Groups: (none)

Listening for messages...
```

---

## Scenario 4: Broadcast Group Testing

**Terminal 1 - Start gateway:**
```bash
bun run src/cli/index.ts gateway start
```

**Terminal 2 - Join group as node-1:**
```bash
bun run src/cli/index.ts gateway join ws://localhost:3000/ws --name "node-1" --group "team-alpha"
```

**Terminal 3 - Join group as node-2:**
```bash
bun run src/cli/index.ts gateway join ws://localhost:3000/ws --name "node-2" --group "team-alpha"
```

**Terminal 4 - Join group as node-3:**
```bash
bun run src/cli/index.ts gateway join ws://localhost:3000/ws --name "node-3" --group "team-alpha"
```

All nodes in "team-alpha" will receive broadcasts from each other.

---

## Scenario 5: Multiple Agent Types (Programmatic)

**Terminal 1 - Start gateway:**
```bash
bun run src/cli/index.ts gateway start
```

**Terminal 2 - Run multi-agent example:**
```bash
bun run examples/gateway-example.ts
```

**What it demonstrates:**
- 3 agents with different capabilities connect
- All join the same broadcast group "project-alpha"
- Agents broadcast messages to the group
- Agents send direct messages to each other
- Health check shows gateway stats

---

## Scenario 6: Custom Multi-Agent Script

Create `test-agents.ts`:

```typescript
import { GatewayClient } from "./src/gateway/client.js";

async function run() {
  // Research agent
  const research = new GatewayClient("ws://localhost:3000/ws", "research-bot", {
    capabilities: ["search", "analyze"],
    events: {
      registered: (id) => {
        console.log(`Research bot registered: ${id}`);
        research.joinGroup("my-team");
      },
      broadcast: (msg, from) => console.log(`Research received:`, msg),
    },
  });

  // Coding agent
  const coder = new GatewayClient("ws://localhost:3000/ws", "coding-bot", {
    capabilities: ["code", "test"],
    events: {
      registered: (id) => {
        console.log(`Coding bot registered: ${id}`);
        coder.joinGroup("my-team");
      },
      broadcast: (msg, from) => console.log(`Coder received:`, msg),
    },
  });

  await research.connect();
  await coder.connect();

  // Send a message after 2 seconds
  setTimeout(() => {
    research.broadcast("my-team", {
      type: "task",
      text: "Need code review"
    });
  }, 2000);

  // Keep running
  await new Promise(() => {});
}

run();
```

**Run it:**
```bash
bun run test-agents.ts
```

---

## Scenario 7: Gateway Status Check

**Check if gateway is running:**
```bash
bun run src/cli/index.ts gateway status
```

**Expected output (running):**
```
✓ Gateway is running
  PID: 12345
  Uptime: 5m 23s
  Config: /Users/you/.wingman/gateway.json
  Logs: /Users/you/.wingman/gateway.log
```

**Expected output (not running):**
```
Gateway is not running
```

---

## Scenario 8: View Gateway Logs

**Tail logs in real-time:**
```bash
tail -f ~/.wingman/gateway.log
```

**View last 50 lines:**
```bash
tail -50 ~/.wingman/gateway.log
```

---

## Troubleshooting

**Gateway won't start:**
```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill existing process if needed
kill -9 <PID>

# Remove stale PID file
rm ~/.wingman/gateway.pid
```

**Discovery not finding gateway:**
```bash
# Check gateway logs
cat ~/.wingman/gateway.log | grep mDNS

# Verify discovery is enabled in config
cat ~/.wingman/gateway.json
```

**Node can't connect:**
```bash
# Test gateway is reachable
curl http://localhost:3000/health

# Try explicit localhost instead of 0.0.0.0
bun run src/cli/index.ts gateway join ws://127.0.0.1:3000/ws --name "test"
```

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `gateway start` | Start gateway daemon |
| `gateway start --discovery mdns --name "X"` | Start with mDNS |
| `gateway stop` | Stop gateway daemon |
| `gateway status` | Check gateway status |
| `gateway discover` | Find gateways on network |
| `gateway join <url> --name "X"` | Join as node |
| `gateway join <url> --name "X" --group "Y"` | Join and auto-join group |

---

## Configuration Files

- **PID file:** `~/.wingman/gateway.pid`
- **Config:** `~/.wingman/gateway.json`
- **Logs:** `~/.wingman/gateway.log`
