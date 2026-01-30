#!/usr/bin/env bash
set -euo pipefail

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

echo "Wingman installer"

if has_cmd bun; then
  echo "Using bun..."
  bun add -g @wingman-ai/agent
elif has_cmd npm; then
  echo "Bun not found. Falling back to npm..."
  npm install -g @wingman-ai/agent
else
  echo "Neither bun nor npm found."
  echo "Install bun (https://bun.sh) or Node.js (https://nodejs.org) and re-run this script."
  exit 1
fi

if ! has_cmd wingman; then
  echo "wingman CLI not found on PATH after install."
  echo "Restart your shell and re-run: wingman init"
  exit 1
fi

echo "Launching Wingman onboarding..."
wingman init
