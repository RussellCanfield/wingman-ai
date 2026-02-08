---
pageType: home

hero:
  name: Wingman
  text: Command your agent fleet.
  tagline: A multi-agent system for local and distributed AI workflows, with a gateway, skills, hooks, and realtime UI.
  actions:
    - theme: brand
      text: Quickstart
      link: /getting-started/quickstart
    - theme: alt
      text: Configure Providers
      link: /configuration/providers
    - theme: alt
      text: Discord Adapter
      link: /configuration/discord-adapter
  image:
    src: /wingman_logo.webp
    alt: Wingman logo
features:
  - title: Multi-agent orchestration
    details: Define specialized agents and sub-agents, route work automatically, and keep context tight across tasks.
  - title: Gateway + Control UI
    details: Run a local gateway for sessions, state, and adapters. Use the Control Core UI to manage chats, routines, and webhooks.
  - title: Desktop Companion app
    details: Use the native desktop companion for tray controls, overlay capture, and chat workflows connected to your gateway sessions.
  - title: Extensible tools + skills
    details: Add MCP servers, install community skills, and wire hooks for pre/post tool automation.
  - title: Voice + channel adapters
    details: Speak responses with Web Speech or ElevenLabs and route agents through Discord and other channels.
---

# Welcome to Wingman

Wingman is a two-part agent ecosystem:

- **Wingman CLI** for local orchestration, config, and agent execution.
- **Wingman Gateway** for multi-agent collaboration, sessions, adapters, and the Control Core web UI.

This documentation dives deep into configuration, providers, and real-world use cases so you can ship a production-grade Wingman setup.

## What you can build

- A **multi-agent coding squad** that delegates tasks across specialized sub-agents.
- A **Discord bot** that routes mentions to specific agents and session threads.
- A **voice-enabled command center** using Web Speech or ElevenLabs.
- A **shared gateway** for cross-device collaboration and session persistence.
- A **native desktop companion** for tray controls, overlay capture, and quick chat access.

## Where to start

1. Run `wingman init` to generate a `.wingman/` workspace config.
2. Configure providers (`wingman provider login <provider>`).
3. Create or customize agents in `.wingman/agents/`.
4. Start the gateway and open the Control Core UI.

Ready to dive in? Start with the quickstart.
