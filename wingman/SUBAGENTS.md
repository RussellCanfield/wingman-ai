# Hierarchical Agent Support

This document describes the hierarchical agent support in Wingman, allowing agents to have their own specialized subagents.

## Overview

Wingman now supports hierarchical agent structures where a parent agent can delegate work to specialized subagents. This enables complex workflows and modular agent design.

## Key Features

- **One-level nesting**: Agents can have subagents, but subagents cannot have their own subagents
- **Automatic validation**: The system enforces the nesting constraint at configuration validation time
- **Dynamic loading**: Subagents are loaded automatically from JSON configuration files
- **Full configuration support**: Subagents support all the same configuration options as top-level agents

## Architecture

### Nesting Constraint

The system enforces a **maximum nesting level of 1**:

```
Root Agent (Wingman)
└── Agent 1 ✓
    ├── Subagent 1.1 ✓
    │   └── Subagent 1.1.1 ✗ (NOT ALLOWED)
    └── Subagent 1.2 ✓
└── Agent 2 ✓
    └── Subagent 2.1 ✓
```

This constraint:
- Keeps the architecture manageable and understandable
- Prevents excessive delegation chains
- Ensures predictable performance characteristics
- Simplifies debugging and monitoring

### Configuration Schema

#### Top-Level Agent with Subagents

```json
{
  "name": "parent-agent",
  "description": "Parent agent that delegates to subagents",
  "systemPrompt": "You coordinate tasks and delegate to specialized subagents...",
  "tools": ["think"],
  "subagents": [
    {
      "name": "subagent-1",
      "description": "First specialized subagent",
      "systemPrompt": "You handle specific tasks...",
      "tools": ["web_crawler"]
    },
    {
      "name": "subagent-2",
      "description": "Second specialized subagent",
      "systemPrompt": "You handle different tasks...",
      "tools": ["command_execute"],
      "model": "anthropic:claude-opus-4-5"
    }
  ]
}
```

#### Subagent Schema

Subagents use the same configuration schema as regular agents, except they **cannot** have a `subagents` field:

```typescript
interface SubAgentConfig {
  name: string;              // Required
  description: string;       // Required
  systemPrompt: string;      // Required
  tools?: string[];          // Optional
  model?: string;            // Optional
  blockedCommands?: string[]; // Optional (for command_execute)
  allowScriptExecution?: boolean; // Optional (for command_execute)
  commandTimeout?: number;   // Optional (for command_execute)
  // subagents?: ...  ← NOT ALLOWED
}
```

### Validation

The system validates configurations at load time:

1. **Schema validation**: Zod validates the structure
2. **Nesting validation**: Rejects subagents with `subagents` field
3. **Load-time enforcement**: Invalid configurations are rejected with clear error messages

Example error:

```
Failed to validate agent.json:
Invalid agent configuration:
  - subagents.0: Unrecognized key: "subagents"
```

## Use Cases

### 1. Workflow Orchestration

A parent agent coordinates a multi-step workflow:

```json
{
  "name": "workflow-orchestrator",
  "description": "Orchestrates complex workflows",
  "systemPrompt": "You coordinate multi-step workflows...",
  "tools": ["think"],
  "subagents": [
    {
      "name": "planner",
      "description": "Creates execution plans",
      "systemPrompt": "You analyze requirements and create plans...",
      "tools": ["web_crawler"]
    },
    {
      "name": "executor",
      "description": "Executes plans",
      "systemPrompt": "You execute plans step by step...",
      "tools": ["command_execute"]
    },
    {
      "name": "validator",
      "description": "Validates results",
      "systemPrompt": "You verify execution results...",
      "tools": []
    }
  ]
}
```

### 2. Domain-Specific Delegation

A general agent delegates to domain experts:

```json
{
  "name": "full-stack-developer",
  "description": "Full-stack development with specialized subagents",
  "systemPrompt": "You handle full-stack development tasks...",
  "tools": ["think"],
  "subagents": [
    {
      "name": "frontend-expert",
      "description": "Frontend development specialist",
      "systemPrompt": "You specialize in React, TypeScript, and CSS...",
      "tools": ["web_crawler"]
    },
    {
      "name": "backend-expert",
      "description": "Backend development specialist",
      "systemPrompt": "You specialize in Node.js, databases, and APIs...",
      "tools": ["command_execute"]
    },
    {
      "name": "devops-expert",
      "description": "DevOps and deployment specialist",
      "systemPrompt": "You handle CI/CD, containers, and deployment...",
      "tools": ["command_execute"]
    }
  ]
}
```

### 3. Sequential Processing Pipeline

A parent agent manages a processing pipeline:

```json
{
  "name": "data-processor",
  "description": "Processes data through multiple stages",
  "systemPrompt": "You coordinate data processing pipelines...",
  "tools": ["think"],
  "subagents": [
    {
      "name": "collector",
      "description": "Collects and validates input data",
      "systemPrompt": "You collect data from various sources...",
      "tools": ["internet_search", "web_crawler"]
    },
    {
      "name": "transformer",
      "description": "Transforms and cleans data",
      "systemPrompt": "You transform and normalize data...",
      "tools": ["command_execute"]
    },
    {
      "name": "analyzer",
      "description": "Analyzes processed data",
      "systemPrompt": "You perform statistical analysis...",
      "tools": ["command_execute", "think"]
    }
  ]
}
```

## Implementation Details

### Loading Process

1. **Parse configuration**: Read JSON and validate schema
2. **Create parent agent**: Convert config to SubAgent instance
3. **Process subagents**: For each subagent config:
   - Validate it doesn't have subagents
   - Create SubAgent instance with tools and model
   - Add to parent's subagents array
4. **Return agent**: Return complete agent with subagents

### Code Example

From [agentLoader.ts](src/agent/config/agentLoader.ts):

```typescript
private createSubAgent(
  config: UserAgentConfig,
  isSubagent = false,
): SubAgent & { subagents?: SubAgent[] } {
  const subAgent: SubAgent & { subagents?: SubAgent[] } = {
    name: config.name,
    description: config.description,
    systemPrompt: config.systemPrompt,
  };

  // Add tools, model, etc...

  // Add subagents if specified (only for top-level agents)
  if (!isSubagent && config.subagents && config.subagents.length > 0) {
    subAgent.subagents = config.subagents.map((subagentConfig) => {
      return this.createSubAgent(subagentConfig as any, true);
    });
  }

  return subAgent;
}
```

## Testing

Comprehensive tests ensure the system works correctly:

### Test 1: Valid Subagents

```json
{
  "name": "parent",
  "description": "Parent with subagents",
  "systemPrompt": "...",
  "subagents": [
    { "name": "child-1", "description": "...", "systemPrompt": "..." },
    { "name": "child-2", "description": "...", "systemPrompt": "..." }
  ]
}
```

✅ **Expected**: Agent loads successfully with 2 subagents

### Test 2: Invalid Nesting

```json
{
  "name": "parent",
  "description": "Parent with nested subagents",
  "systemPrompt": "...",
  "subagents": [
    {
      "name": "child",
      "description": "...",
      "systemPrompt": "...",
      "subagents": [
        { "name": "grandchild", "description": "...", "systemPrompt": "..." }
      ]
    }
  ]
}
```

❌ **Expected**: Validation error - "Unrecognized key: 'subagents'"

## Benefits

1. **Modularity**: Break complex agents into focused subagents
2. **Reusability**: Subagents can be reused across different parent agents
3. **Clarity**: Clear separation of responsibilities
4. **Maintainability**: Easier to update individual subagents
5. **Testability**: Test subagents independently

## Best Practices

### 1. Keep Subagents Focused

Each subagent should have a single, well-defined responsibility:

```json
{
  "name": "researcher",  // ✓ Focused
  "description": "Searches and analyzes information",
  ...
}
```

### 2. Minimize Subagent Count

Aim for 2-5 subagents per parent. Too many subagents increase complexity:

```json
{
  "subagents": [
    { "name": "planner", ... },
    { "name": "implementor", ... },
    { "name": "reviewer", ... }
  ]
}
```

### 3. Choose Appropriate Tools

Give each subagent only the tools it needs:

```json
{
  "name": "readonly-analyzer",
  "tools": [],  // No tools - read-only via backend
  ...
},
{
  "name": "executor",
  "tools": ["command_execute"],  // Only execution tool
  ...
}
```

### 4. Document Delegation Strategy

Explain in the parent's systemPrompt when to use each subagent:

```
"You coordinate coding tasks. Delegate as follows:
- Use 'planner' for creating implementation plans
- Use 'implementor' for executing code changes
- Use 'reviewer' for quality checks"
```

## Limitations

1. **Maximum nesting: 1 level** - No nested subagents allowed
2. **Static configuration**: Subagents defined at load time, not runtime
3. **Shared backend**: All subagents share the same backend with parent
4. **No dynamic subagent creation**: Cannot create subagents on-the-fly

## Future Enhancements

Potential improvements for future versions:

- **Dynamic subagent registration**: Add/remove subagents at runtime
- **Subagent templates**: Reusable subagent configurations
- **Inter-subagent communication**: Direct communication between subagents
- **Conditional subagents**: Load subagents based on conditions
- **Subagent pooling**: Reuse subagent instances across invocations

## Summary

Hierarchical agent support in Wingman provides a powerful way to structure complex agent systems while maintaining simplicity through a strict one-level nesting constraint. The feature is fully integrated with the dynamic agent loading system and enforces constraints through comprehensive validation.

For examples, see:
- [agents/README.md](agents/README.md) - Configuration examples
- [src/agent/tests/test-subagent-loading.ts](src/agent/tests/test-subagent-loading.ts) - Test cases
- [src/agent/config/agentConfig.ts](src/agent/config/agentConfig.ts) - Schema definitions
- [src/agent/config/agentLoader.ts](src/agent/config/agentLoader.ts) - Loading implementation
