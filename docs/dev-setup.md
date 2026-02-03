# Developer Setup

This guide is for contributors working on Wingman locally.

## Prerequisites
- Bun (required for `bun:sqlite` support).
- Node.js (only if you run tooling outside Bun).

## Install
```bash
cd /Users/russellcanfield/Projects/wingman-ai
bun install
```

## Build
```bash
cd apps/wingman
bun run build
```

## Run Gateway (with Control UI)
```bash
cd apps/wingman
./bin/wingman gateway start
```

## Run Gateway + Web UI (hot reload)
```bash
cd apps/wingman
bun run dev
```

This starts:
- Gateway (foreground run + Bun watch mode, no daemon pid)
- Web UI (Vite dev server)

## Web UI (dev mode)
```bash
cd apps/wingman
bun run webui:dev
```

## Tests
```bash
cd apps/wingman
bun run test
```

## Config
- Local config file: `apps/wingman/.wingman/wingman.config.json`
- Logs: `~/.wingman/logs/wingman.log`

## Provider Keys
Set env vars or store credentials using:
```bash
./bin/wingman provider login anthropic
./bin/wingman provider login openai
```
