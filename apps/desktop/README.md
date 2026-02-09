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

## Shipping

- macOS publishing guide: `apps/desktop/docs/macos-publish.md`
- Automated macOS publish script: `apps/desktop/scripts/macos-publish.sh`
