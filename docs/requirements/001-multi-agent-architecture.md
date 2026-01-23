# PRD-001: Multi-Agent Architecture

**Version:** 1.1
**Last Updated:** 2026-01-23

## Overview
Wingman implements a hierarchical multi-agent system using LangChain's deepagents framework. The system consists of a root orchestrator agent that coordinates specialized subagents, each optimized for specific task domains.

This document covers the agent architecture for local CLI execution. For distributed multi-agent collaboration, see [Gateway PRD](005-gateway-prd.md).

## Problem Statement
Modern AI assistants face several challenges:
- Context window limitations prevent handling complex, multi-step tasks
- Single-model approaches struggle with diverse task types requiring different expertise
- Users need both autonomous task handling and fine-grained control over workflows
- Task delegation and coordination require intelligent routing

## Goals
1. Enable efficient task decomposition and delegation
2. Minimize context usage through focused subagents
3. Provide flexible orchestration (autonomous vs. explicit control)
4. Support parallel execution of independent tasks
5. Maintain conversation continuity and state across agent transitions

## Non-Goals
- Supporting third-party agent frameworks beyond deepagents
- Cross-project memory sharing
- Real-time streaming between subagents
- Agent-to-agent direct communication (all goes through root)

## Architecture

### Root Agent (Wingman)
**Purpose**: Orchestrate task delegation and coordinate subagent interactions

**Responsibilities**:
- Analyze user requests and determine appropriate agent(s)
- Route tasks to specialized subagents
- Aggregate results from multiple subagents
- Maintain conversation context and history
- Handle simple queries directly without delegation

**Configuration**:
- System prompt with delegation guidelines
- Access to all subagents
- Backend for state management and file operations
- Middleware for request/response processing

### Specialized Subagents

#### 1. Researcher Agent
**Domain**: Web research and information gathering

**Capabilities**:
- Internet search (Tavily API or DuckDuckGo fallback)
- Multi-page web crawling with content extraction
- Report writing and information synthesis

**Tools**:
- `internet_search`: Search web for current information
- `web_crawler`: Deep crawl websites (up to 10 pages)
- `think`: Reasoning without side effects

**Use Cases**:
- Technology research and comparisons
- Documentation exploration
- Fact-checking and verification
- Competitive analysis

#### 2. Coder Agent
**Domain**: General full-stack development

**Capabilities**:
- Autonomous handling of simple to moderate coding tasks
- Intelligent delegation to planner/implementor/reviewer for complex work
- Direct code implementation without tool usage (relies on backend)

**Delegation Strategy**:
- Tasks < 50 lines: Handle directly
- Tasks 50-200 lines: Evaluate complexity, may use planner
- Tasks > 200 lines: Mandatory planner → implementor → reviewer workflow

**Use Cases**:
- Bug fixes
- Small features
- Code refactoring
- Single-component modifications

#### 3. Planner Agent
**Domain**: Software architecture and implementation planning

**Capabilities**:
- Analyze requirements and existing code patterns
- Research documentation and APIs via web crawler
- Create detailed, structured implementation plans
- Consider architectural tradeoffs

**Tools**:
- `web_crawler`: Research documentation
- `think`: Reason about design decisions

**Output Format**:
```
## Overview
[High-level summary]

## Files to Modify
- file1.ts - [changes]
- file2.ts - [changes]

## Implementation Steps
1. [Step with rationale]
2. [Step with rationale]

## Considerations
- [Tradeoffs]
- [Edge cases]
```

**Use Cases**:
- Complex features requiring multiple files
- Major refactoring projects
- Architectural decisions
- Pre-implementation planning

#### 4. Implementor Agent
**Domain**: Code execution and validation

**Capabilities**:
- Execute implementation plans
- Run tests and builds
- Validate changes
- Handle file operations and command execution

**Tools**:
- `command_execute`: Run shell commands (5-minute timeout)

**Safety Features**:
- Blocked destructive commands (rm, mv, format, sudo, etc.)
- Environment variable sanitization
- Configurable script execution permissions
- Child process isolation

**Use Cases**:
- Executing predefined plans
- Running test suites
- Building projects
- Validating implementations

#### 5. Reviewer Agent
**Domain**: Code quality and best practices

**Capabilities**:
- Review code for correctness
- Identify edge cases and bugs
- Check consistency with existing patterns
- Assess security vulnerabilities
- Evaluate performance implications
- Ensure maintainability

**Review Criteria**:
1. Correctness: Logic and functionality
2. Edge cases: Boundary conditions and error handling
3. Consistency: Alignment with codebase patterns
4. Security: Vulnerabilities and best practices
5. Performance: Efficiency and scalability
6. Maintainability: Code clarity and documentation

**Use Cases**:
- Post-implementation validation
- Pre-merge code review
- Security audits
- Quality gates

## Orchestration Patterns

### Pattern 1: Direct Handling
**When**: Simple queries, informational requests
```
User → Root Agent → Response
```

### Pattern 2: Single Agent Delegation
**When**: Task clearly maps to one agent's domain
```
User → Root Agent → Subagent → Root Agent → Response
```

### Pattern 3: Sequential Workflow
**When**: Complex tasks requiring multiple steps
```
User → Root Agent → Planner → Implementor → Reviewer → Root Agent → Response
```

### Pattern 4: Parallel Execution
**When**: Independent tasks can run concurrently
```
User → Root Agent → [Researcher + Coder] (parallel) → Root Agent → Response
```

### Pattern 5: Autonomous Delegation
**When**: Coder handles moderate complexity autonomously
```
User → Root Agent → Coder → [Internal: Planner → Implementor → Reviewer] → Root Agent → Response
```

## Backend Architecture

### State Management
**StateBackend**: In-memory file operations within conversation context

**Features**:
- Fast read/write operations
- Automatic checkpointing
- Session-scoped persistence

**Use Cases**:
- Temporary file modifications
- Code generation
- Iterative editing

### Persistent Storage
**FilesystemBackend**: Disk-based storage for agent memories

**Configuration**:
- Root directory: `/.wingman/myagent`
- Virtual mode: Isolated from real filesystem
- Path prefix: `/memories/`

**Features**:
- Cross-session persistence
- Agent memory storage
- Long-term context

**Use Cases**:
- User preferences
- Learned patterns
- Historical context

### Composite Backend
**Strategy**: Route operations based on path prefix

```typescript
CompositeBackend(StateBackend, {
  "/memories/": FilesystemBackend
})
```

**Routing**:
- `/memories/*` → FilesystemBackend (persistent)
- All other paths → StateBackend (session)

## Middleware System

### Additional Messages Middleware
**Purpose**: Inject contextual information before agent execution

**Implementation**:
```typescript
beforeAgent: (input) => {
  input.messages.unshift(
    new HumanMessage({
      content: `** Current Date Time (UTC): ${timestamp} **`
    })
  );
  return input;
}
```

**Use Cases**:
- Time-sensitive operations
- Context enrichment
- Request preprocessing

### Extensibility
**AgentMiddleware Interface**:
- `beforeAgent`: Pre-processing hook
- `afterAgent`: Post-processing hook
- `name`: Identifier for debugging

**Custom Middleware Examples**:
- Authentication/authorization
- Rate limiting
- Request logging
- Response formatting
- Error handling

## Custom Agent Configuration

Users can define custom agents via JSON configuration files without modifying code.

### Configuration Location
```
.wingman/agents/
  my-agent/
    agent.json
```

### Agent Schema
```json
{
  "name": "my-agent",
  "description": "Action-oriented description for delegation",
  "systemPrompt": "Detailed instructions defining agent behavior",
  "tools": ["command_execute", "think"],
  "model": "anthropic:claude-sonnet-4-5",
  "blockedCommands": ["rm", "mv"],
  "allowScriptExecution": true,
  "commandTimeout": 300000,
  "subagents": []
}
```

### Available Tools
- `internet_search`: Web search (Tavily or DuckDuckGo)
- `web_crawler`: Multi-page web crawling
- `command_execute`: Shell command execution
- `think`: Reasoning without side effects

### Subagent Nesting
Agents can define subagents for delegation (1 level deep only). This enables workflows like `coder → [planner, implementor, reviewer]`.

---

## Hooks System

Hooks enable users to execute custom shell commands at agent lifecycle points.

### Hook Events
| Event | Trigger | Blocking |
|-------|---------|----------|
| `PreToolUse` | Before tool execution | Yes (exit 2 blocks) |
| `PostToolUse` | After tool completes | No |
| `Stop` | Agent completion | No |

### Configuration
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "command_execute",
      "hooks": [{
        "type": "command",
        "command": "prettier --write $FILE",
        "timeout": 60000
      }]
    }]
  }
}
```

### Use Cases
- Auto-format code after edits
- Block dangerous commands
- Run tests after changes
- Audit logging

---

## Skills System

### Purpose
Dynamically extend agent capabilities through markdown files

### Structure
```
/skills/
  skill-name/
    SKILL.md       # Frontmatter + instructions
    examples.md    # Optional examples
    patterns.md    # Optional patterns
```

### Skill Definition (SKILL.md)
```yaml
---
name: skill-name
description: What the skill does
---

# Skill Instructions
[Detailed instructions for using the skill]
```

### Loading Strategy
- Skills loaded from filesystem paths: `["/skills/"]`
- Multiple sources supported
- Later sources override earlier ones
- Applied to all subagents

### Use Cases
- Domain-specific workflows
- Company conventions
- Project-specific patterns
- User preferences

## Performance Considerations

### Context Management
- **Problem**: Large context windows expensive and slow
- **Solution**: Focused subagents with minimal context
- **Benefit**: 10-100x reduction in context usage

### Parallel Execution
- **Problem**: Sequential workflows are slow
- **Solution**: Independent tasks run in parallel
- **Benefit**: Proportional speedup (2x, 3x, etc.)

### Tool Usage Optimization
- **Problem**: Excessive tool calls increase latency
- **Solution**: Subagents have minimal, focused toolsets
- **Benefit**: Faster execution, fewer errors

### State Persistence
- **Problem**: Re-loading context is expensive
- **Solution**: Checkpoint-based state management
- **Benefit**: Resume conversations efficiently

## Success Metrics

### Task Completion
- % of tasks completed successfully
- % requiring user intervention
- Average task completion time

### Agent Utilization
- Delegation patterns (which agents used)
- Average delegation depth
- Parallel vs. sequential execution ratio

### Quality
- Code correctness (test pass rate)
- Review feedback incorporation rate
- User satisfaction scores

### Performance
- Average response latency
- Context tokens used per task
- Tool call efficiency

## Technical Requirements

### Dependencies
- `deepagents ^1.5.0`: Multi-agent framework
- `@langchain/langgraph ^1.1.0`: Graph-based orchestration
- `@langchain/core`: Base LangChain functionality
- `zod ^4.3.5`: Schema validation

### Model Requirements
- Support for Claude models (Anthropic)
- Support for GPT models (OpenAI)
- Tool calling capability
- Streaming support

### Runtime Requirements
- Node.js >= 18
- Environment variables for API keys
- File system access for backend
- Network access for web tools

---

## Provider Abstraction

### Current Implementation

Wingman currently supports multiple model providers via API keys and stored tokens:

| Provider | Models | Authentication |
|----------|--------|----------------|
| Anthropic | claude-opus-4-5, claude-sonnet-4-5 | `ANTHROPIC_API_KEY` (or stored) |
| OpenAI | gpt-4o, gpt-4-turbo | `OPENAI_API_KEY` (or stored) |
| OpenRouter | any OpenRouter model | `OPENROUTER_API_KEY` (or stored) |
| GitHub Copilot | gpt-4o, gpt-4-turbo | `GITHUB_COPILOT_TOKEN` or `wingman provider login` |

**Model Selection Format:** `provider:model-name`

Examples:
- `anthropic:claude-opus-4-5`
- `openai:gpt-4o`
- `openrouter:openai/gpt-4o`
- `copilot:gpt-4o`

### Planned Provider Support

To maximize adoption, Wingman will support subscription-based model providers alongside API keys:

| Provider | Type | Authentication | Status |
|----------|------|----------------|--------|
| Anthropic | API | API Key | ✅ Implemented |
| OpenAI | API | API Key | ✅ Implemented |
| OpenRouter | API | API Key | ✅ Implemented |
| GitHub Copilot | Subscription | Token (manual) | ✅ Implemented |
| OpenAI Codex | Subscription | OAuth | 🔄 Planned |
| Claude Max | Subscription | OAuth | 🔄 Planned |
| Google Gemini | API | API Key | 🔄 Planned |

### Provider Interface

```typescript
interface ModelProvider {
  name: string;
  type: 'api-key' | 'oauth';

  // Check if provider is configured
  isConfigured(): boolean;

  // Get available models for this provider
  getAvailableModels(): string[];

  // Create a model instance
  createModel(modelName: string, options?: ModelOptions): LanguageModelLike;

  // For OAuth providers: initiate auth flow
  authenticate?(): Promise<void>;

  // For OAuth providers: check token validity
  isAuthenticated?(): boolean;
}

interface ModelOptions {
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
}
```

### OAuth Flow (Planned)

For subscription providers like Copilot, users will authenticate via browser once OAuth is available:

```
1. User runs: wingman provider login copilot
2. CLI opens browser for OAuth consent
3. User authorizes Wingman
4. CLI receives token, stores securely
5. Future invocations use stored credentials
```

**Token Storage:**
- Location: `~/.wingman/credentials.json` (encryption planned)
- Rotation: Automatic refresh when tokens expire
- Revocation: `wingman provider logout copilot`

OAuth flows will require provider-specific client configuration and redirect URIs.

### Configuration

Users specify providers in agent configuration:

```json
{
  "name": "my-agent",
  "model": "copilot:gpt-4",
  "fallbackModel": "anthropic:claude-sonnet-4-5"
}
```

**Fallback Chain:** If primary provider unavailable, try fallback.

---

## Gateway Integration

When connected to a [Wingman Gateway](005-gateway-prd.md), agents can participate in distributed collaboration.

### Connection Model

```
┌─────────────────────────────────────────────────────────────┐
│                     Local CLI                                │
│  ┌─────────────┐                                            │
│  │   Agent     │                                            │
│  │  (coder)    │◀────────────────────┐                      │
│  └─────────────┘                     │                      │
│        │                             │                      │
│        ▼                             │                      │
│  ┌─────────────┐              ┌──────┴──────┐              │
│  │  Session    │              │   Gateway   │              │
│  │  (SQLite)   │              │   Client    │              │
│  │  (Local)    │              │             │              │
│  └─────────────┘              └──────┬──────┘              │
│                                      │                      │
└──────────────────────────────────────┼──────────────────────┘
                                       │
                                       │ WebSocket
                                       ▼
                              ┌─────────────────┐
                              │  Wingman Gateway │
                              │  (Remote/LAN)   │
                              └─────────────────┘
```

### State Ownership

| Component | Owns |
|-----------|------|
| Agent | System prompt, tools, reasoning |
| Session (SQLite) | Conversation history, checkpoints |
| Gateway | Nothing - pure routing |

**Key Principle:** Gateway is stateless. Agents maintain full conversation context locally. This enables:
- Offline operation (agent works without gateway)
- State persistence across gateway restarts
- Independent agent sessions (no shared state corruption)

### Message Flow

**Receiving from Gateway:**
```typescript
gatewayClient.on('message', async (msg) => {
  // Skip own messages (sender exclusion)
  if (msg.fromNodeId === gatewayClient.nodeId) return;

  // Agent decides whether to respond (discretion model)
  const shouldRespond = await agent.shouldHandle(msg.payload.content);
  if (!shouldRespond) return;

  // Process and stream response
  for await (const chunk of agent.stream(msg.payload.content)) {
    gatewayClient.broadcast({
      type: 'agent-stream',
      chunk
    });
  }
});
```

**Sending to Gateway:**
```typescript
// User input flows through gateway
outputManager.on('user-prompt', (prompt) => {
  gatewayClient.broadcast({
    type: 'user-message',
    content: prompt
  });
});

// Agent responses flow through gateway
outputManager.on('agent-stream', (chunk) => {
  gatewayClient.broadcast({
    type: 'agent-stream',
    chunk
  });
});
```

### Multi-Device Scenarios

**Same User, Multiple Devices:**
- Laptop sends prompt
- Desktop agent processes
- Mobile sees both prompt and response

**Team Collaboration:**
- Team member A's coder agent joins room
- Team member B's researcher agent joins room
- Shared prompts processed by both agents
- All team members see all outputs

### Offline Mode

When gateway is unavailable:
- Agent continues normal CLI operation
- Session state preserved locally
- Reconnection syncs presence only (not history)

## Future Enhancements

### Phase 2
- Agent performance analytics
- Custom agent creation via UI
- Agent-specific conversation history
- Dynamic tool loading
- **Provider expansion** (Copilot, Codex, Gemini)

### Phase 3
- Multi-modal subagents (image, audio)
- External agent integration (MCP protocol)
- **Full gateway integration** (distributed collaboration)
- Agent marketplace

### Phase 4
- Agent training/fine-tuning
- Cross-project learning
- Agent collaboration protocols
- Real-time streaming

## References
- [Architecture Overview](000-architecture-overview.md) - System-wide architecture
- [Gateway PRD](005-gateway-prd.md) - Distributed agent collaboration
- [LangChain deepagents Documentation](https://docs.langchain.com/oss/javascript/deepagents)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraphjs/)
- [Custom Agents Configuration Guide](../custom-agents.md)
