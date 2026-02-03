# Wingman macOS App (WIP)

## Quick start

```bash
cd apps/macos/WingmanMac
open AppHost/Wingman/Wingman.xcodeproj
```

## Notes
- Requires macOS 13+ and Xcode command-line tools.
- Permissions: Microphone + Speech Recognition.
- Default hotkey: Caps Lock (configurable in Settings).
- Overlay appears on the active display and shows a live transcript for editing before send.
- Gateway URL + optional auth can be set in Settings (default `ws://127.0.0.1:18789/ws`).

## Packaging
This Xcode app target depends on the `WingmanMacKit` Swift package. Update `Sources/WingmanMac/Resources/AppInfo.plist` to change permission prompts and keep `Info.plist` in this folder in sync.
