# Wingman Multi-Agent System

## Project Overview

Wingman is a two-part AI agent ecosystem:

1. **Wingman CLI** - A local AI agent framework that runs on your machine, supporting multiple model providers and customizable agent configurations
2. **Wingman Gateway** - A distributed communication hub that enables multi-agent collaboration across devices, allowing AI agents to communicate as a team

**Key Features**:
- Intelligent task delegation and orchestration
- Context-efficient subagent specialization
- User-configurable custom agents
- Flexible autonomous and explicit control modes
- State management with persistent and ephemeral backends
- Extensible middleware, hooks, and skills system
- Gateway for distributed multi-agent collaboration
- Session persistence with SQLite storage

## Verify Changes
Test coverage is essential, always add tests for new functionality.
After you've finished making changes, ensure all tests and builds pass.

## Docs-site Updates
Keep major feature descriptions in `docs-site` updated when you ship or change significant capabilities.
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

**Version**: 1.2.1
**Last Updated**: 2026-02-02
**Maintainer**: Russell Canfield (rcanfield86@gmail.com)
