# PRD-006: Wingman Desktop Companion (Tauri)

**Version:** 0.2
**Status:** In Progress
**Last Updated:** 2026-02-07

---

## Overview

The Wingman Desktop Companion is a standalone Tauri app with an OS adapter
architecture. It owns native UX (tray menu, notifications, deep links,
privacy-aware permissions) and routes captured input to Wingman Gateway.

The desktop companion is not a gateway. It attaches to a local or remote
gateway and acts as a native endpoint for voice capture and OS-specific tools.

---

## Goals

1. Provide one cross-platform app shell with per-OS native adapters
2. Reach macOS feature parity first (tray, overlay, routing, permission UX)
3. Keep app settings local and persist gateway routing config
4. Support local and remote gateway attachment
5. Enforce explicit approvals for `system.run`

## Non-Goals

- Replacing the gateway runtime
- Replacing the existing web Control UI
- Replacing the existing native macOS app in the short term

---

## Product Surface

### Tray Menu
- Start/Stop recording
- Toggle overlay visibility
- Open Gateway UI
- Open Settings
- Quit app

### Recording + Overlay (MVP)
- Global hotkey toggles voice capture
- Overlay provides live transcript preview/edit before send
- Gateway send target includes optional Agent ID and Session Key

### Gateway Settings
- Gateway URL
- Gateway UI URL override (optional)
- Token/password (optional)
- Target Agent ID (optional)
- Target Session Key (optional)

### Gateway Workspace (Desktop Companion)
- Connection test against `/api/config`, `/api/health`, `/api/stats`
- WebSocket connect/disconnect using gateway `connect` handshake
- Session explorer:
  - list sessions
  - create new session by selected agent
  - open session messages
  - rename/delete session
- Agent tools:
  - list agents and available tools
  - inspect agent detail
  - create new agent from desktop UI
- Rich chat stream:
  - `req:agent` prompt send
  - streamed `event:agent` text deltas
  - tool status cards
  - thinking traces
  - structured UI blocks rendered by local SGUI registry

---

## Technical Direction

### App stack
- **Shell:** Tauri
- **Backend:** Rust (`apps/windows/src-tauri`)
- **Frontend:** React + Tailwind shell built with Vite (`apps/windows/src`)
- **Adapter model:** `platform/macos.rs`, `platform/windows.rs`, fallback adapter

### IPC
- Tauri command invoke/event channels between webview and Rust shell
- Native tray events emit app state updates to the frontend

### Persistence
- Local settings persisted per-user
- Exec approvals persisted locally per OS user profile

---

## Security + Permissions

### macOS-first privacy capabilities
- Microphone
- Speech recognition
- Notifications
- Accessibility (next)
- Screen capture (next)

### `system.run` safety model
- Default deny
- Prompt on miss
- Agent-scoped allowlist entries for resolved binary paths

---

## Deep Links

The app must support the `wingman://` URL scheme.

### `wingman://agent`
- Required query: `message`
- Optional query: `sessionKey`, `thinking`, `deliver`, `to`, `channel`, `timeoutSeconds`, `key`

Without a trusted key, the app prompts for explicit confirmation.

---

## Status

Current implementation status in this repository:
- Standalone app scaffold exists at `apps/windows`
- Frontend gateway workspace exists with session + agent + rich chat flows
- Rust tray/state scaffolding exists
- OS adapter layer exists with macOS-first implementation
- macOS overlay now applies native AppKit window behavior (screen-saver level, all-spaces, transparent window)
- macOS speech capture now launches a compiled bundled helper app (`WingmanSpeechBridge.app`) through LaunchServices so TCC permissions apply to a real app bundle context
- Native macOS permission probing is scaffolded; direct probes are not implemented yet
