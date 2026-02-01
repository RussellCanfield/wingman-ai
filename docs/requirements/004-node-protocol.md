# PRD-004: Wingman Node Protocol Specification

**Version:** 1.0
**Status:** Planned
**Last Updated:** 2026-02-01

---

## Overview

Nodes are remote tool executors that connect to the Wingman Gateway to expose
capabilities (screen, camera, system.run, etc). This spec defines the message
schema, pairing flow, and invocation lifecycle for node clients. The first
implementation target is the Wingman macOS app + node host service.

---

## Transport

- WebSocket connection to the gateway (same port as other clients)
- Client must identify itself as `clientType: "node"`
- Auth via gateway token (or pairing token after approval)

---

## Pairing + Approval (Planned)

### Flow
1. Node connects with `clientType: node` and metadata
2. Gateway checks `nodes.pairingRequired`
3. If approval is required, gateway responds with `res` + `pairingRequired`
4. User approves the node in Control UI or CLI
5. Gateway issues an approval token and persists node ID
6. Node reconnects (or resumes) using the approval token

### UX Requirements
- Show node name, platform, mode, and capabilities
- Allow one-time approval or revoke later
- Pairing requests expire after `nodes.pairingTtlSeconds`

### Gateway Config
```
"nodes": {
  "enabled": true,
  "pairingRequired": true,
  "pairingTtlSeconds": 300,
  "approved": ["node-123"]
}
```

---

## Message Envelope

All node messages use the standard gateway envelope:

```json
{
  "type": "req:node",
  "id": "node-req-1",
  "clientId": "node-123",
  "targetNodeId": "node-123",
  "payload": {},
  "timestamp": 1234567890
}
```

### Message Types
- `connect`
- `res`
- `req:node`
- `event:node`
- `error`

---

## Connect (Node)

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
    "transport": "direct",
    "capabilities": ["system.run", "system.notify", "screen.record"],
    "permissions": {
      "screen": "granted",
      "microphone": "prompt",
      "camera": "denied",
      "accessibility": "granted"
    }
  },
  "timestamp": 1234567890
}
```

### Connect Response (Pairing Required)
```json
{
  "type": "res",
  "id": "connect-2",
  "ok": false,
  "payload": {
    "code": "pairing-required",
    "pairingId": "pair-abc",
    "expiresAt": 1234567899
  },
  "timestamp": 1234567890
}
```

### Connect Response (Approved)
```json
{
  "type": "res",
  "id": "connect-2",
  "ok": true,
  "payload": {
    "nodeId": "node-123",
    "approved": true
  },
  "timestamp": 1234567890
}
```

---

## Node Invocation

### Request
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

### Stream Events
```json
{
  "type": "event:node",
  "id": "node-req-1",
  "payload": { "kind": "stdout", "chunk": "..." },
  "timestamp": 1234567890
}
```

### Completion
```json
{
  "type": "res",
  "id": "node-req-1",
  "ok": true,
  "payload": {
    "exitCode": 0,
    "durationMs": 1234
  },
  "timestamp": 1234567890
}
```

### Error
```json
{
  "type": "error",
  "id": "node-req-1",
  "payload": {
    "code": "permission-denied",
    "message": "Screen recording not granted"
  },
  "timestamp": 1234567890
}
```

---

## Permissions Map

Nodes report a permissions map so agents can decide whether to request a tool.

Valid statuses:
- `granted`
- `denied`
- `prompt`
- `restricted`

The gateway should surface this map in `/stats` and Control UI.

---

## UI Registry (Static Generative UI)

Static generative UI (SGUI) is exposed through tool calls that include UI render
hints. The gateway forwards these hints; the client (Web UI) renders components
from a local registry. The registry contract and component specs live in the
Web UI SGUI PRD: `docs/requirements/005-web-ui-sgui-prd.md`.

---

## Exec Approvals (system.run)

system.run is enforced locally by the node (macOS app). The gateway should
not bypass node policy. A `permission-denied` error must be returned if the
app rejects a command. The gateway may optionally implement its own allowlist
in the future, but node-side enforcement is authoritative.

---

## Heartbeats + Liveness (Optional)

Nodes may send periodic `event:node` heartbeats, or the gateway can rely on
WebSocket keepalive. Disconnects should remove the node from active stats.

---

## Security Considerations

- Pairing is required for first-time nodes by default
- Approvals are persisted by node ID
- IPC between node host service and macOS app must be local-only and authenticated
- system.run must be guarded by allowlists + user prompts

---

## Compatibility

- The node protocol reuses the gateway WebSocket transport
- Future nodes (Linux/Windows) should implement the same schema with platform
  and permissions fields

---

## References

- Gateway PRD: `docs/requirements/002-gateway-prd.md`
- macOS App PRD: `docs/requirements/003-macos-app-prd.md`
