# PRD-001: Multi-Agent Architecture

**Version:** 1.2.7
**Last Updated:** 2026-02-10

## Overview
Wingman implements a hierarchical multi-agent system using LangChain's deepagents framework. The system consists of a root orchestrator agent that coordinates specialized subagents, each optimized for specific task domains.

This document covers the agent architecture shared by the gateway and local CLI execution. The gateway is the default runtime; the CLI can run locally with `--local`. For gateway routing and sessions, see [Gateway PRD](002-gateway-prd.md).

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
- Middleware for request/response processing, including confidentiality rules that prevent disclosure of machine/system details, internal file paths, or tool call IDs

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
- Execution-backed coding workflow that requires tool activity for repository-affecting turns
- Completion integrity guard: coding responses are blocked when no tool execution occurred

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
- `background_terminal`: Session-scoped background terminal control for long-running or interactive command flows (start, stdin write, output poll in one tool)

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

#### 6. Custom Domain Agents (Example: Stock Trader)
**Domain**: Specialized workflows with external data sources and stateful memory

**Capabilities**:
- Prompt-driven multi-stage funnels (seed -> filter -> validate -> output)
- External data via MCP tools with strict call budgets
- Checkpointing and resume logic to handle rate limits
- Persistent memory for caches, watchlists, and run state
- Concise, user-facing outputs that summarize signals without dumping raw tool payloads

**Tools**:
- MCP tools for domain data (e.g., Finnhub quotes/news/options); candle tools enforce conservative lookback caps (intraday default 180 days, daily default 365 days). Candle sourcing defaults to Yahoo Finance chart data (non‑premium Finnhub) and can fall back to Finnhub when configured.
- Built-in MCP multimodal tooling includes FAL AI generation tools (`generate_image_or_texture`, `generate_image_edit`, `generate_audio_or_music`, `generate_video_from_image`) plus `fal_generation_status` for queue polling, cancellation, and optional review decisions.
- MCP server entries may define `defaultToolTimeout` (milliseconds) to extend per-tool call deadlines for long-running providers (for example, FAL audio/sfx jobs).
- `think` for structured reasoning
- Optional `web_crawler` for user-supplied URLs

**Use Cases**:
- Market scans seeded by sentiment and validated by fundamentals
- Policy/theme tracking with low-call budgets
- Actionable plans with explicit "no trade" outcomes when signals are weak

## Agent Isolation and Storage

An agent is a fully scoped brain with its own workspace, agent directory, and session store. This keeps personas, credentials, and history isolated.

**Isolation rules:**
- Each agent has a dedicated workspace that acts as the default cwd; relative paths resolve inside the workspace. Sandboxing is optional and configured per agent.
- Gateway sessions may override this default via per-session `workdir`; when present, the session workdir becomes the execution root for that session's turns.
- Background terminal sessions are scoped to `agent + session` ownership. A session cannot read/write terminal processes started from a different session context.
- Each agent has a dedicated agentDir for auth profiles and per-agent config. Do not reuse agentDir across agents to avoid auth/session collisions.
- Sessions are stored per agent under the gateway state directory.

**Default paths (configurable):**
- Config: `.wingman/wingman.config.json` (workspace)
- Agent workspace: `~/wingman-<agentId>` (example)
- Agent dir: `~/.wingman/agents/<agentId>/agent`
- Sessions: `~/.wingman/agents/<agentId>/sessions`
- Session image materialization: `<stateDir>/agents/<agentId>/sessions/media/<sessionId>/`
- Auth profiles: `~/.wingman/agents/<agentId>/agent/auth-profiles.json`
- Shared skills: `~/.wingman/skills` and per-workspace `skills/`

Per-agent sandbox and tool allow/deny policies can further restrict what an agent is allowed to execute. These policies are enforced by the gateway runtime.

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
- Durable project context, decisions, and research notes (stored under `/memories/`)

**Agent Guidance**:
- Agents receive a hidden middleware note describing the memory structure and what to store.

**Deferred Semantic Recall**:
- Semantic memory retrieval (vector search over long-term memory) is deferred.
- MVP relies on explicit `/memories/` reads and agent self-management.

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

### Conversation Summarization Middleware
**Purpose**: Compress long-running conversation history to reduce context pressure and token cost.

**Configuration (`.wingman/wingman.config.json`)**:
```json
{
  "summarization": {
    "enabled": true,
    "maxTokensBeforeSummary": 12000,
    "messagesToKeep": 8
  }
}
```

**Behavior**:
- When enabled, Wingman configures DeepAgent's built-in summarization middleware to summarize older turns once the configured token threshold is crossed.
- The most recent `messagesToKeep` turns remain verbatim.
- Summarization runs with the active agent model and complements session checkpointing.

### Retry Middleware
**Purpose**: Improve resilience for transient model/tool failures.

**Configuration (`.wingman/wingman.config.json`)**:
```json
{
  "modelRetry": {
    "enabled": true,
    "maxRetries": 2,
    "backoffFactor": 2,
    "initialDelayMs": 1000,
    "maxDelayMs": 60000,
    "jitter": true,
    "onFailure": "continue"
  },
  "toolRetry": {
    "enabled": true,
    "maxRetries": 2,
    "backoffFactor": 2,
    "initialDelayMs": 1000,
    "maxDelayMs": 60000,
    "jitter": true,
    "onFailure": "continue",
    "tools": ["internet_search"]
  }
}
```

**Behavior**:
- `modelRetry` applies LangChain `modelRetryMiddleware`.
- `toolRetry` applies LangChain `toolRetryMiddleware`.
- `toolRetry.tools` can scope retries to specific tool names.

### Human-in-the-loop Tool Policies
**Purpose**: Require human approval for selected tools.

**Configuration (`.wingman/wingman.config.json`)**:
```json
{
  "humanInTheLoop": {
    "enabled": true,
    "interruptOn": {
      "command_execute": {
        "allowedDecisions": ["approve", "reject"],
        "description": "Command execution requires approval"
      },
      "internet_search": false
    }
  }
}
```

**Behavior**:
- Uses DeepAgent `interruptOn` routing to enable per-tool HITL decisions.
- Supports `approve`, `edit`, and `reject` decision modes where configured.
- Empty `interruptOn` maps are ignored (no runtime interruptions).

## Custom Agent Configuration

Users can define custom agents via JSON or Markdown configuration files without modifying code.

### Configuration Location
```
.wingman/agents/
  my-agent/
    agent.json
    # or
    agent.md
```

### Agent Schema (JSON)
```json
{
  "name": "my-agent",
  "description": "Action-oriented description for delegation",
  "systemPrompt": "Detailed instructions defining agent behavior",
  "tools": ["command_execute", "think"],
  "model": "anthropic:claude-sonnet-4-5",
  "promptRefinement": {
    "enabled": true,
    "instructionsPath": "/memories/agents/my-agent/instructions.md"
  },
  "voice": {
    "provider": "elevenlabs",
    "elevenlabs": { "voiceId": "voice-id" }
  },
  "blockedCommands": ["rm", "mv"],
  "allowScriptExecution": true,
  "commandTimeout": 300000,
  "subAgents": []
}
```

### Agent Schema (Markdown)
```markdown
---
name: my-agent
description: Action-oriented description for delegation
tools:
  - command_execute
  - think
model: anthropic:claude-sonnet-4-5
promptRefinement:
  enabled: true
  instructionsPath: /memories/agents/my-agent/instructions.md
voice:
  provider: elevenlabs
  elevenlabs:
    voiceId: voice-id
subAgents:
  - name: helper
    description: Focused subagent
    tools: [think]
    promptFile: ./helper.md
---

You are the main agent prompt...
```

Notes:
- `agent.md` uses YAML frontmatter with the same schema as JSON plus `promptFile` for subagents.
- `promptFile` is resolved relative to the agent directory and is inlined into `systemPrompt`.
- `subagents` (lowercase) is accepted for backward compatibility but normalized to `subAgents`.
- `voice` can override the gateway default TTS provider and settings for this agent.
- `promptRefinement` enables a per-agent instruction overlay under `/memories/` that is updated only on explicit feedback.

### Available Tools
- `internet_search`: Web search (Tavily or DuckDuckGo)
- `web_crawler`: Multi-page web crawling
- `command_execute`: Shell command execution
- `background_terminal`: Start a background terminal session, then write/poll by `session_id`
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

| Provider | Models | Authentication | Type |
|----------|--------|----------------|------|
| Anthropic | claude-opus-4-5, claude-sonnet-4-5 | `ANTHROPIC_API_KEY` (or stored) | Cloud API |
| OpenAI | gpt-4o, gpt-4-turbo | `OPENAI_API_KEY` (or stored) | Cloud API |
| OpenAI Codex | codex-mini-latest, gpt-5-codex | `CODEX_ACCESS_TOKEN`, `CHATGPT_ACCESS_TOKEN`, or Codex auth file | Subscription |
| OpenRouter | any OpenRouter model | `OPENROUTER_API_KEY` (or stored) | Cloud API |
| xAI | grok-beta | `XAI_API_KEY` (or stored) | Cloud API |
| GitHub Copilot | gpt-4o, gpt-4-turbo | `GITHUB_COPILOT_TOKEN` or `wingman provider login` | Subscription |
| LM Studio | any loaded model | Optional: `LMSTUDIO_API_KEY` | Local Server |
| Ollama | any pulled model | Optional: `OLLAMA_API_KEY` | Local Server |

**Model Selection Format:** `provider:model-name`

Examples:
- `anthropic:claude-opus-4-5`
- `openai:gpt-4o`
- `codex:codex-mini-latest`
- `openrouter:openai/gpt-4o`
- `xai:grok-beta`
- `copilot:gpt-4o`
- `lmstudio:llama-3.1-8b`
- `ollama:llama3.2`

### Planned Provider Support

To maximize adoption, Wingman will support subscription-based model providers alongside API keys and local inference:

| Provider | Type | Authentication | Status |
|----------|------|----------------|--------|
| Anthropic | API | API Key | ✅ Implemented |
| OpenAI | API | API Key | ✅ Implemented |
| OpenRouter | API | API Key | ✅ Implemented |
| xAI | API | API Key | ✅ Implemented |
| GitHub Copilot | Subscription | Token (manual) | ✅ Implemented |
| OpenAI Codex | Subscription | Codex auth token or env token | ✅ Implemented |
| LM Studio | Local | Optional API Key | ✅ Implemented |
| Ollama | Local | Optional API Key | ✅ Implemented |
| Claude Max | Subscription | OAuth | 🔄 Planned |
| Google Gemini | API | API Key | 🔄 Planned |

**Local Provider Notes:**
- **LM Studio**: Runs OpenAI-compatible API on `localhost:1234`. No authentication required by default.
- **Ollama**: Runs OpenAI-compatible API on `localhost:11434`. No authentication required by default.
- Both local providers work immediately without API keys when the server is running.

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
- Codex shortcut: reuse local Codex login state from `CODEX_HOME/auth.json` or `~/.codex/auth.json`

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

**Local Provider Example:**
```json
{
  "name": "local-dev-agent",
  "model": "ollama:llama3.2",
  "fallbackModel": "lmstudio:llama-3.1-8b"
}
```

**Fallback Chain:** If primary provider unavailable, try fallback.

---

## Gateway Integration

The gateway is the default runtime for agents, sessions, and channels. The CLI connects as a client, with `--local` available for standalone runs. For routing and session details, see [Gateway PRD](002-gateway-prd.md).

### Connection Model

```
┌─────────────────────────────────────────────────────────────┐
│                        Clients                               │
│  CLI, Control UI, Channels, Future Nodes                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket / internal adapters
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Wingman Gateway                         │
│  - Routing bindings                                           │
│  - Session store (SQLite)                                     │
│  - Agent runtime                                              │
│  - Channel adapters                                           │
└─────────────────────────────────────────────────────────────┘
```

### State Ownership

| Component | Owns |
|-----------|------|
| Gateway | Agent registry, routing bindings, session store, channel adapters |
| Agent | System prompt, tools, reasoning (hosted inside gateway) |
| CLI (client) | UI, config, optional local sessions |

**Key Principle:** Gateway is stateful. Sessions and routing live in the gateway; clients do not own conversation state unless running with `--local`.

### Message Flow

**Inbound message to agent:**
```typescript
gateway.on("inboundMessage", async (msg) => {
  const agentId = router.match(msg);
  const sessionKey = sessionKeys.for(msg, agentId);
  const agent = agentRegistry.get(agentId);
  const session = await sessionStore.load(sessionKey);

  for await (const chunk of agent.stream(msg.content, session)) {
    channelAdapter.sendStream(msg.replyTo, chunk);
  }
});
```

**CLI default invocation:**
```typescript
cli.send({
  type: "req:agent",
  payload: { content: prompt }
});
```

### Control UI Streaming UX
- Main assistant output streams directly into the chat transcript.
- Subagent output and tool activity are grouped into a collapsible "Thinking" section so users can feel progress without clutter.
- Desktop chat rendering splits streamed assistant output into distinct message cards by model run/subagent run id instead of concatenating all deltas into one card.

### Multi-Device Scenarios

**Same User, Multiple Devices:**
- Laptop sends prompt via CLI or Control UI
- Gateway runs the selected agent and streams output
- Mobile UI sees the same stream

### Offline Mode

When gateway is unavailable:
- Run locally with `wingman agent --local`
- Session state is stored locally
- Channel routing is unavailable until gateway reconnects

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
- External channel adapters and control UI expansion
- Agent marketplace

### Phase 4
- Agent training/fine-tuning
- Cross-project learning
- Agent collaboration protocols
- Real-time streaming

## References
- [Architecture Overview](000-architecture-overview.md) - System-wide architecture
- [Gateway PRD](002-gateway-prd.md) - Gateway runtime and routing
- [LangChain deepagents Documentation](https://docs.langchain.com/oss/javascript/deepagents)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraphjs/)
- [Custom Agents Configuration Guide](../custom-agents.md)
