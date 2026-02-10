# Windows Publish Guide (Tauri Desktop Companion)

## Quick Start (Automated)

Run from repo root on a Windows machine:

```powershell
$env:WINDOWS_CERT_THUMBPRINT = "YOUR_CERT_SHA1"
bun run --cwd apps/desktop publish:windows
```

The publish script is at `apps/desktop/scripts/windows-publish.ps1` and supports:
`build`, `sign`, `verify`, and `all`.

## 1. Prerequisites

- Windows 11 build machine (x64) with Visual Studio C++ Build Tools.
- Rust toolchain with target `x86_64-pc-windows-msvc`.
- Bun installed.
- Code signing certificate available via:
  - cert store thumbprint (`WINDOWS_CERT_THUMBPRINT`), or
  - PFX file (`WINDOWS_CERT_PATH` + `WINDOWS_CERT_PASSWORD`).
- `signtool.exe` available in `PATH`.

## 2. Build Windows Artifacts

```powershell
pwsh -NoProfile -File apps/desktop/scripts/windows-publish.ps1 build
```

Expected output is under:
`apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/`

## 3. Sign Artifacts

Using certificate thumbprint:

```powershell
$env:WINDOWS_CERT_THUMBPRINT = "YOUR_CERT_SHA1"
pwsh -NoProfile -File apps/desktop/scripts/windows-publish.ps1 sign
```

Using PFX:

```powershell
$env:WINDOWS_CERT_PATH = "C:\certs\wingman.pfx"
$env:WINDOWS_CERT_PASSWORD = "YOUR_PASSWORD"
pwsh -NoProfile -File apps/desktop/scripts/windows-publish.ps1 sign
```

## 4. Verify Signatures

```powershell
pwsh -NoProfile -File apps/desktop/scripts/windows-publish.ps1 verify
```

## 5. End-to-End

```powershell
pwsh -NoProfile -File apps/desktop/scripts/windows-publish.ps1 all
```

## Notes

- Current target is Windows x64 only (`x86_64-pc-windows-msvc`).
- This workflow builds MSI and NSIS installers.
- Native Windows runtime parity (permissions/speech/deep links) is tracked in
  `docs/requirements/006-windows-app-prd.md`.
- Windows QA checklist: `apps/desktop/docs/windows-testing-checklist.md`.
