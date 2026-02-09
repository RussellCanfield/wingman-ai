# Wingman Multi-Agent System

## Project Overview

Wingman is a three-part AI agent ecosystem:

1. **Wingman CLI** - A local AI agent framework that runs on your machine, supporting multiple model providers and customizable agent configurations
2. **Wingman Gateway** - A distributed communication hub that enables multi-agent collaboration across devices, allowing AI agents to communicate as a team
3. **Wingman Desktop** - A native desktop application for managing and interacting with Wingman locally, including tray and voice integrations

**Key Features**:
- Intelligent task delegation and orchestration
- Context-efficient subagent specialization
- User-configurable custom agents
- Flexible autonomous and explicit control modes
- State management with persistent and ephemeral backends
- Extensible middleware, hooks, and skills system
- Gateway for distributed multi-agent collaboration
- Session persistence with SQLite storage
- Desktop app support with native OS integration

## Verify Changes
Test coverage is essential, always add tests for new functionality.
After you've finished making changes, ensure all tests and builds pass.

## Maintainable Code Standards
- Keep files from growing too large; split code into focused modules/components before files become difficult to navigate.
- Always ensure there are no TypeScript errors.
- Always lint and format code after changes.
- Always ensure builds and tests pass before considering work complete.

## Docs-site Updates
Keep major feature descriptions in `./apps/docs-website` updated when you ship or change significant capabilities.
The docs-site is legacy for requirements (see below), but it should still reflect the current product surface.

## Product Requirements

All PRD documents can be found under `./docs/requirements/`:

| Document | Description |
|----------|-------------|
| [000-architecture-overview.md](docs/requirements/000-architecture-overview.md) | System-wide architecture and vision |
| [001-multi-agent-architecture.md](docs/requirements/001-multi-agent-architecture.md) | Agent hierarchy, custom agents, hooks, providers |
| [005-gateway-prd.md](docs/requirements/005-gateway-prd.md) | Gateway rooms, protocol, consumer patterns |

**Critical: Keep these PRDs up to date when modifying the project.**

## Legacy Docs
**Do not consume docs from docs-site, these are legacy!**

## References

### Project Documentation
- [Architecture Overview](docs/requirements/000-architecture-overview.md) - System-wide vision
- [Multi-Agent Architecture PRD](docs/requirements/001-multi-agent-architecture.md) - Agent system, providers, hooks
- [Gateway PRD](docs/requirements/005-gateway-prd.md) - Distributed collaboration
- [Custom Agents Guide](docs/custom-agents.md)

### External Documentation
- [LangChain deepagents Documentation](https://docs.langchain.com/oss/javascript/deepagents)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraphjs/)
- [Zod Schema Validation](https://zod.dev/)

### Repository
- [Project Repository](https://github.com/RussellCanfield/wingman-ai)

---

**Version**: 1.2.2
**Last Updated**: 2026-02-09
**Maintainer**: Russell Canfield (rcanfield86@gmail.com)
