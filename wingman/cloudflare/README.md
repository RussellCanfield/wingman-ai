# Wingman Gateway - Cloudflare Deployment

Deploy the Wingman Gateway to Cloudflare Workers for global edge network access.

## Prerequisites

1. Install Wrangler CLI:
```bash
npm install -g wrangler
# or
bun add -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

## Deployment

### Development

Deploy to development environment:
```bash
cd cloudflare
wrangler deploy --env development
```

### Production

Deploy to production environment:
```bash
cd cloudflare
wrangler deploy --env production
```

## Configuration

Edit `wrangler.toml` to configure:
- Worker name
- Environment variables
- Durable Objects settings

## Usage

After deployment, you'll get a URL like:
```
https://wingman-gateway.your-subdomain.workers.dev
```

Connect to the gateway:
```bash
wingman gateway join wss://wingman-gateway.your-subdomain.workers.dev/ws --name="agent-1"
```

## Features

- **Global Edge Network**: Low latency worldwide
- **Durable Objects**: Persistent state across connections
- **WebSocket Support**: Real-time communication
- **Auto-scaling**: Handles traffic spikes automatically

## Monitoring

Check gateway health:
```bash
curl https://wingman-gateway.your-subdomain.workers.dev/health
```

View statistics:
```bash
curl https://wingman-gateway.your-subdomain.workers.dev/stats
```

## Limitations

- Cloudflare Workers have a 128MB memory limit
- WebSocket connections are limited to 1 minute of CPU time
- Durable Objects have storage limits based on your plan

## Custom Domain

To use a custom domain:

1. Add your domain to Cloudflare
2. Update `wrangler.toml`:
```toml
routes = [
  { pattern = "gateway.yourdomain.com/*", zone_name = "yourdomain.com" }
]
```
3. Deploy again

## Troubleshooting

### Connection Issues

Check if the worker is running:
```bash
wrangler tail
```

### Debugging

View logs in real-time:
```bash
wrangler tail --env production
```

## Cost

Cloudflare Workers pricing:
- Free tier: 100,000 requests/day
- Paid tier: $5/month for 10 million requests
- Durable Objects: $0.15 per million requests

See [Cloudflare pricing](https://workers.cloudflare.com/pricing) for details.
