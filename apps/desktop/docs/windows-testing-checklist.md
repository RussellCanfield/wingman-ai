# Windows x64 Testing Checklist (Desktop Companion)

Use this checklist on a Windows 11 x64 machine after installing a build from
`apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/`.

## 1. App Launch + Tray

- Launch app from Start menu / installer output.
- Verify tray icon appears.
- Verify tray menu actions:
  - `Start Recording` / `Stop Recording` toggles
  - `Toggle Overlay`
  - `Show Wingman Window`
  - `Open Gateway UI`
  - `Settings...`
  - `Quit Wingman AI`

## 2. Runtime Permission Panel

- Open Runtime > Permissions in app UI.
- Verify rows include:
  - Microphone
  - Speech Recognition
  - Notifications
- Click `Open Settings` for each row and confirm Windows Settings opens to:
  - `ms-settings:privacy-microphone`
  - `ms-settings:privacy-speech`
  - `ms-settings:notifications`

## 3. Notification Validation

- Click `Send Test` in Notifications row.
- Confirm a Windows toast appears.
- Disable notifications in Windows settings and retry; confirm failure feedback.

## 4. Recording + Overlay (Testing Mode)

- Start recording from UI or tray.
- Verify overlay opens and app remains in recording state.
- Confirm speech status indicates Windows testing mode.
- Type transcript manually in overlay and stop recording.
- Verify transcript remains editable/sendable in main UI.

## 5. Hotkeys

- Save `CommandOrControl+Shift+R` and `CommandOrControl+Shift+O` in Runtime.
- Verify record hotkey toggles recording.
- Verify overlay hotkey toggles overlay visibility.
- If quick-send-on-record-hotkey is enabled, verify transcript quick-send is queued on stop.

## 6. Gateway Workspace

- Configure gateway URL and connect.
- Run connection test (`/api/config`, `/api/health`, `/api/stats`).
- Load sessions and open one.
- Send a prompt and confirm streaming response appears.

## 7. Packaging + Signing

- Build: `pwsh -NoProfile -File apps/desktop/scripts/windows-publish.ps1 build`
- Sign: `pwsh -NoProfile -File apps/desktop/scripts/windows-publish.ps1 sign`
- Verify: `pwsh -NoProfile -File apps/desktop/scripts/windows-publish.ps1 verify`
- Confirm output includes signed `.msi` and `.exe` installers.
