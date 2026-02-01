# PRD-003: Wingman macOS App

**Version:** 1.0
**Status:** Planned
**Last Updated:** 2026-02-01

---

## Overview

The Wingman macOS app is a menu-bar companion that owns macOS permissions (TCC),
manages local gateway attachment, and exposes macOS-only capabilities to the
Wingman Gateway as a node. It provides native UX for status, notifications, and
secure execution of UI/TCC-sensitive tools (screen, camera, system.run).

The macOS app is part of the Wingman ecosystem alongside the Gateway and CLI.
It is not a gateway itself; it attaches to a local or remote gateway and
provides macOS capabilities on-demand.

---

## Goals

1. Provide a native menu-bar UX for gateway status and permissions
2. Own all macOS TCC prompts and permission tracking
3. Expose macOS-only tools to the gateway as a node
4. Support local and remote gateway connectivity modes
5. Enforce local exec approvals for system.run

## Non-Goals

- Replacing the gateway runtime
- Providing a full Control UI (web chat remains gateway-hosted)
- Long-term background automation without explicit user permissions

---

## Key Behaviors

### Menu-bar UX
- Shows current gateway connection status
- Displays node capability/permission status
- Surfaces notifications (system + agent) natively
- Provides quick actions (connect, disconnect, open Control UI, install CLI)

### Permissions Ownership (TCC)
The app owns TCC prompts and tracks permission status for:
- Notifications
- Accessibility
- Screen Recording
- Microphone
- Speech Recognition
- Automation / AppleScript

The node reports a permissions map so agents and the gateway can decide which
macOS tools are allowed.

---

## Local vs Remote Mode

### Local (Default)
- The app attaches to a local gateway if one is running
- If not running, the app can enable a per-user launchd service to start it
- Local mode may start/stop the gateway using launchd, not as a child process

### Remote
- The app connects to a remote gateway (SSH/Tailscale/direct)
- The app never starts a local gateway in this mode
- The app starts a local node host service so the remote gateway can reach this Mac

---

## Node Capabilities (macOS)

The macOS app presents itself as a node via a local node host service.
Capabilities include:
- Canvas: canvas.present, canvas.navigate, canvas.eval, canvas.snapshot
- Camera: camera.snap, camera.clip
- Screen: screen.record
- System: system.run, system.notify

The node must report a permissions map (granted/denied/prompt/restricted) for
each relevant TCC capability.

---

## Tool-Driven UI Prompts (Web UI MVP)

Wingman supports static generative UI via tool calls that include render hints.
In MVP, this is handled by the Web UI only. The macOS app may render the same
UI prompt schema in a future release.

Example tool: `ask.user.feedback` (agent requests user input via UI).

See `docs/requirements/002-gateway-prd.md` for the UI render schema and examples.

---

## System.run Exec Approvals

system.run requires explicit user approval and local allowlisting. The app
stores exec approvals on the Mac:

`~/.wingman/exec-approvals.json`

Example:
```json
{
  "version": 1,
  "defaults": {
    "security": "deny",
    "ask": "on-miss"
  },
  "agents": {
    "main": {
      "security": "allowlist",
      "ask": "on-miss",
      "allowlist": [{ "pattern": "/opt/homebrew/bin/rg" }]
    }
  }
}
```

Notes:
- Allowlist entries are glob patterns for resolved binary paths
- Choosing \"Always Allow\" in the prompt adds the command to the allowlist
- Environment overrides are filtered (drops PATH, DYLD_*, LD_*, NODE_OPTIONS,
  PYTHON*, PERL*, RUBYOPT) and then merged with the app's environment

---

## Launchd Control

The app manages a per-user LaunchAgent for the gateway:
- Label: `ai.wingman.gateway` (or `ai.wingman.<profile>` when using profiles)
- Start: `launchctl kickstart -k gui/$UID/ai.wingman.gateway`
- Stop: `launchctl bootout gui/$UID/ai.wingman.gateway`

If the LaunchAgent is not installed, the app can prompt the user to install it
or call `wingman gateway install`.

---

## Deep Links

The app registers the `wingman://` URL scheme for local actions.

### `wingman://agent`
Triggers a gateway agent request.

Example:
```
open 'wingman://agent?message=Hello%20from%20deep%20link'
```

Query parameters:
- `message` (required)
- `sessionKey` (optional)
- `thinking` (optional)
- `deliver` / `to` / `channel` (optional)
- `timeoutSeconds` (optional)
- `key` (optional unattended mode key)

Safety:
- Without `key`, the app prompts for confirmation
- With a valid key, the run is unattended (intended for personal automations)

---

## IPC + Node Host Service

When running in remote mode (or when the node host service is enabled), the
headless node host connects to the gateway and proxies UI/TCC tools to the
macOS app over IPC.

IPC (planned):
- UDS with token + HMAC + TTL
- Local-only socket, no TCP exposure
- system.run executes inside the app context

Diagram:
```
Gateway -> Node Host Service (WS)
                 |  IPC (UDS + token + HMAC + TTL)
                 v
             macOS App (UI + TCC + system.run)
```

---

## Remote Connection Plumbing (SSH Tunnel)

When the app runs in Remote mode, it can open an SSH tunnel so local UI
components can talk to a remote gateway as if it were on localhost.

Control tunnel (Gateway WebSocket port):
- Local port: the gateway port (default 18789), always stable
- Remote port: the same gateway port on the remote host
- Tunnel shape: `ssh -N -L <local>:127.0.0.1:<remote>` with BatchMode +
  ExitOnForwardFailure + keepalive options

Note: The SSH tunnel uses loopback, so the gateway sees node IP as 127.0.0.1.
Use direct ws/wss transport if the real client IP is required.

---

## Debug + Dev Workflow

Build/dev (native):
```
cd apps/macos && swift build
swift run WingmanMac
```

Package app:
```
scripts/package-mac-app.sh
```

Debug gateway connectivity without launching the app:
```
cd apps/macos
swift run wingman-mac connect --json
swift run wingman-mac discover --timeout 3000 --json
```

Connect options:
- `--url <ws://host:port>`: override config
- `--mode <local|remote>`: resolve from config (default: config or local)
- `--probe`: force a fresh health probe
- `--timeout <ms>`: request timeout (default: 15000)
- `--json`: structured output for diffing

Discovery options:
- `--include-local`: include gateways filtered as \"local\"
- `--timeout <ms>`: overall discovery window (default: 2000)
- `--json`: structured output for diffing

Tip: Compare against `wingman gateway discover --json` to validate parity between
app discovery and CLI discovery.

---

## Open Questions

- Final LaunchAgent label and profile naming conventions
- Exact permission reporting schema (align with node protocol spec)
- Whether the node host service is always-on or on-demand
- Whether to include Tailscale-based discovery in the app

---

## References

- Architecture Overview: `docs/requirements/000-architecture-overview.md`
- Gateway PRD: `docs/requirements/002-gateway-prd.md`
- Node Protocol Spec: `docs/requirements/004-node-protocol.md`
