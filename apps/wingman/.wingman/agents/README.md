# Wingman Agents

This directory contains the agent configurations for Wingman. All agents are now dynamically loaded from JSON configuration files, eliminating the need for hardcoded agent definitions.

## Agent Configuration Files

Each JSON file in this directory defines a specialized agent with its own capabilities:

- **[researcher.json](./researcher.json)** - Web research and information gathering
- **[coder.json](./coder.json)** - Full-stack development with autonomous workflow management
- **[planner.json](./planner.json)** - Software architecture and implementation planning
- **[implementor.json](./implementor.json)** - Code execution and validation
- **[reviewer.json](./reviewer.json)** - Code quality and best practices review

## Configuration Schema

Each agent configuration file follows this schema:

```json
{
  "name": "agent-name",
  "description": "Brief description of what the agent does",
  "systemPrompt": "Detailed instructions for the agent...",
  "tools": ["tool1", "tool2"],
  "model": "provider:model-name",
  "subagents": [
    {
      "name": "subagent-1",
      "description": "Description of subagent",
      "systemPrompt": "Instructions for subagent...",
      "tools": ["tool1"],
      "model": "provider:model-name"
    }
  ]
}
```

### Required Fields

- **name**: Unique identifier for the agent (e.g., "researcher", "coding")
- **description**: Action-oriented description used for agent delegation
- **systemPrompt**: Detailed instructions and guidelines for the agent's behavior

### Optional Fields

- **tools**: Array of tool names the agent can use
  - Available tools: `internet_search`, `web_crawler`, `command_execute`, `think`, `code_search`, `git_status`
- **model**: Override the default model (format: `provider:model-name`)
  - Anthropic: `anthropic:claude-opus-4-5`, `anthropic:claude-sonnet-4-5-20250929`
  - OpenAI: `openai:gpt-4o`, `openai:gpt-4-turbo`
- **subagents**: Array of subagent configurations (see [Hierarchical Agents](#hierarchical-agents) below)
  - Subagents may also set their own `model` to override the parent/default model

### Tool-Specific Options

For agents using `command_execute`, you can add:

```json
{
  "tools": ["command_execute"],
  "blockedCommands": ["rm", "mv", "cp"],
  "allowScriptExecution": true,
  "commandTimeout": 300000
}
```

## Adding New Agents

To add a new agent:

1. Create a new JSON file in this directory (e.g., `my-agent.json`)
2. Follow the configuration schema above
3. The agent will be automatically loaded on next startup

### Example: Custom Data Analyst Agent

```json
{
  "name": "data-analyst",
  "description": "Analyzes data using Python, pandas, and creates visualizations",
  "systemPrompt": "You are a data analysis expert...",
  "tools": ["command_execute", "think"],
  "model": "anthropic:claude-opus-4-5"
}
```

## Custom Agents Location

Users can also define custom agents in the `.wingman/` directory:

- **Single file**: `.wingman/agents.config.json`
- **Directory**: `.wingman/agents/*.json`

Custom agents are loaded in addition to the built-in agents defined here.

## Loading Priority

Agents are loaded in this order:

1. Built-in agents from `agents/` (this directory)
2. Custom agents from `.wingman/agents.config.json`
3. Custom agents from `.wingman/agents/*.json`

## Hierarchical Agents

Agents can have their own subagents, allowing you to create hierarchical agent structures. This enables complex workflows where a parent agent can delegate to specialized subagents.

### Important Constraints

- **Maximum nesting level: 1** - Only top-level agents can have subagents
- **Subagents cannot have their own subagents** - This prevents excessive nesting and keeps the architecture manageable

### Example: Agent with Subagents

```json
{
  "name": "coding-orchestrator",
  "description": "Orchestrates coding tasks by delegating to specialized subagents",
  "systemPrompt": "You coordinate coding tasks and delegate to specialized subagents...",
  "tools": ["think"],
  "subagents": [
    {
      "name": "planner",
      "description": "Creates implementation plans",
      "systemPrompt": "You create detailed implementation plans...",
      "tools": ["web_crawler"]
    },
    {
      "name": "implementor",
      "description": "Implements code based on plans",
      "systemPrompt": "You implement code following plans...",
      "tools": ["command_execute"]
    },
    {
      "name": "reviewer",
      "description": "Reviews code quality",
      "systemPrompt": "You review code for quality and correctness...",
      "tools": []
    }
  ]
}
```

### When to Use Subagents

Use subagents when you need:
- **Workflow orchestration**: A parent agent coordinates multiple specialized agents
- **Complex delegation**: Different subtasks require different tools or expertise
- **Modular design**: Break down complex agents into smaller, focused components

## Architecture

All agents are dynamically loaded by the `AgentConfigLoader` class at runtime. This eliminates hardcoded agent definitions and makes it easy to:

- Add new agents without modifying code
- Customize agent behavior via configuration
- Share agent configurations across projects
- Test different agent configurations
- Create hierarchical agent structures with subagents

For more details, see the [AgentConfigLoader implementation](../src/agent/config/agentLoader.ts).
