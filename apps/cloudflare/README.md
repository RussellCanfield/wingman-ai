# Wingman on Cloudflare

This app deploys Wingman Gateway to Cloudflare Workers + Containers using the Sandbox SDK.

## Files

- `src/index.ts`: Worker entrypoint that proxies requests and WebSocket upgrades to a named sandbox container instance.
- `wrangler.jsonc`: Worker + Durable Object + container bindings.
- `Dockerfile`: Runtime image that starts Wingman Gateway in foreground mode.
- `wingman.config.json`: Default gateway configuration for cloud deployment.

## Prerequisites

- Cloudflare account with Workers enabled.
- Docker available locally (used by Wrangler to build container image).
- Bun and Node.js installed.

## Local dev

```bash
cd apps/cloudflare
bun install
bun run types
bun run dev
```

## Deploy

```bash
cd apps/cloudflare
bun run deploy
```

## Notes

- Gateway and Control UI both bind to container port `8080`.
- Default auth is `none` for bootstrap. Before production exposure, set gateway auth to `token` and configure `WINGMAN_GATEWAY_TOKEN` in your deployment.
