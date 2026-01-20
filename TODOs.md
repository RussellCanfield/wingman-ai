# Wingman Gateway
Develop a gateway that mimics [ClawdBot's](https://docs.clawd.bot/cli/gateway) with the ability to host it:

- Locally, accessible over LAN/tailscale
- Hosted remotely in Cloudflare
- Simple/easy auth support
- Support [daemon](https://docs.clawd.bot/cli/daemon)
- Health endpoint
- Give the user a CLI command to join the gateway
- Give the user a CLI command to join a node to the gateway
- Supports [broadcast groups](https://docs.clawd.bot/broadcast-groups)
- Using native Bun web server

The gateway should allow subscribing multiple nodes just like Clawdbots so allow AI agent swarming. An example is the user spinning up 2-3 Wingmans and starting a group chat.

# Gateway Channel Integration
Develop methods to communicate with Wingman and view outputs. Allow users the most flexibility when interacting with a Wingman agent.
The idea is simple, the user may not always want to use the CLI. They may be away from their machine but need to delegate to an agent running back at home, through their gateway.

Integration channels:
- Some sort of remote SSH? Scenario: I'm on my phone away from the house, use tailscale and some phone client?
- Discord
- Microsoft Teams
- React Native App using Expo? What are the limitations we may hit with Expo? Can we use module federation with Expo - [read this re-pack plugin](https://re-pack.dev/docs/guides/expo-modules). Is there an easy way to distribute the app without an official app store publish?

# Onboarding workflow
Develop an onboarding set of CLI commands to:

- Get information about the user in the form of "memories"
- Setup LLM providers such as Anthropic, OpenAI, OpenRouter, LLMStudio
- Configure and setup the gateway
- Give usage examples, etc.

# Resiliency
Ensure that retries, timeouts and circuit breaker patterns can be used effectively with LLM providers