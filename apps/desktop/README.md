# Wingman Desktop Companion (Tauri)

This is the standalone desktop companion app for Wingman. It is separate from
the gateway Web UI and uses an OS adapter model (macOS-first parity work).

## Scope (current implementation)

- Dedicated app root at `apps/desktop`
- Native backend scaffold at `apps/desktop/src-tauri`
- OS-agnostic adapter layer with macOS-first implementation
- Tray-first command model and shared app state
- Desktop Gateway workspace with:
  - gateway connection test + websocket connect/disconnect
  - node mode enable/revoke for this device via gateway `/api/nodes`
  - node execution handlers for `system.notify` and `system.run`
  - session list + session load/create/rename/delete
  - cross-client session mirroring with the gateway web UI for shared sessions
  - agent list + agent detail fetch
  - agent creation form (via `/api/agents`)
  - provider credential management (including voice providers)
  - gateway voice configuration (provider + defaults)
  - rich chat stream rendering (text, tool status, thinking notes, dynamic UI blocks)
  - chat attachments (file upload + image paste)
  - chat voice playback (manual play/stop + per-session auto-speak policy)
- Overlay voice capture/transcript UI remains native-runtime aware
- Unit tests for gateway config, tray model, platform normalization, sync signature, stream parsing, and gateway API helpers

## Local commands

```bash
# from repo root
bun run --cwd apps/desktop test
bun run --cwd apps/desktop build:web
bun run --cwd apps/desktop dev:web
```

## Native Tauri commands

```bash
# requires @tauri-apps/cli + Rust crates available
bun run --cwd apps/desktop tauri:dev
bun run --cwd apps/desktop tauri:build
```

## Notes

- This repository environment may not have external network access to fetch
  Tauri crates/CLI dependencies. If so, run native commands on a networked
  development machine with Rust + Bun installed.
- The tray, global hotkeys, toast notifications, and deep link registration
  are designed in the Rust shell and can be expanded per-OS adapter.

## Node Mode (macOS)

Current desktop node flow:
- Connect the desktop app to your gateway.
- In Gateway settings, toggle `Enable this device as a node`.
- Optionally set `Node Name` in Gateway quick controls to label this device.
- The app is approved through `/api/nodes/:clientId` and registers node capabilities.

Note:
- Changing `Node Name` updates local desktop preferences immediately, but the gateway-visible node name updates on the next node registration event (toggle node mode off/on, or reconnect while node mode is enabled).

Current node capabilities in desktop app:
- `system.notify` (used by `node_notify`)
- `system.run` (used by `node_run`)

Revocation:
- Turn off `Enable this device as a node` in desktop settings, or
- call `DELETE /api/nodes/:clientId` from gateway API/CLI tooling.

## Shipping

- macOS publishing guide: `apps/desktop/docs/macos-publish.md`
- Automated macOS publish script: `apps/desktop/scripts/macos-publish.sh`
- Windows publishing guide: `apps/desktop/docs/windows-publish.md`
- Automated Windows publish script: `apps/desktop/scripts/windows-publish.ps1`
- Windows QA checklist: `apps/desktop/docs/windows-testing-checklist.md`
