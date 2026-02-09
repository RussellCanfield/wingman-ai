# macOS Publish Guide (Tauri Desktop Companion)

## Quick Start (Automated)

Run from repo root:

```bash
IDENTITY="Developer ID Application: Your Company (TEAMID)" \
NOTARY_PROFILE="wingman-notary" \
bun run --cwd apps/desktop publish:macos
```

The publish script is at `apps/desktop/scripts/macos-publish.sh` and supports:
`build`, `sign`, `notarize`, `verify`, and `all`.

## 1. Prerequisites

- Apple Developer account + Team ID.
- A valid **Developer ID Application** certificate installed in Keychain.
- Xcode command-line tools installed.
- Rust + Bun installed.

## 2. Configure Build Metadata

1. Update version in `apps/desktop/src-tauri/tauri.conf.json`.
2. Confirm macOS permission strings in `apps/desktop/src-tauri/Info.plist`.
3. Ensure icons are present in `apps/desktop/src-tauri/icons`.

## 3. Enable Bundling

Set `bundle.active` to `true` in `apps/desktop/src-tauri/tauri.conf.json` for release builds.

## 4. Build Signed macOS Artifact

Run from repo root:

```bash
bash apps/desktop/scripts/macos-publish.sh build
```

Expected output is under `apps/desktop/src-tauri/target/release/bundle/macos/`.

## 5. Notarize + Staple

```bash
IDENTITY="Developer ID Application: Your Company (TEAMID)" \
bash apps/desktop/scripts/macos-publish.sh sign

NOTARY_PROFILE="wingman-notary" \
bash apps/desktop/scripts/macos-publish.sh notarize
```

## 6. Verify Before Release

- Open app on a clean macOS machine.
- Validate first-run permissions (mic, speech, notifications).
- Confirm tray, overlay, hotkeys, gateway connect, and chat send/stream.
- Confirm attachment flows: file upload + image paste.
- Run artifact verification:

```bash
bash apps/desktop/scripts/macos-publish.sh verify
```
