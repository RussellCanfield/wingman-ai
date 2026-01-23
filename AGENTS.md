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

## Architecture

### Root Agent (Wingman)

The root agent is the primary orchestrator that:
- Analyzes incoming requests
- Routes tasks to appropriate specialized subagents
- Aggregates results from multiple subagents
- Maintains conversation context
- Handles simple queries directly

**System Prompt Strategy**: The root agent includes detailed delegation guidelines explaining when and how to use each subagent, enabling intelligent autonomous routing.

**Backend**: Composite backend combining StateBackend (ephemeral, in-memory) and FilesystemBackend (persistent, disk-based at `/.wingman/myagent`).

**Middleware**: Additional messages middleware injects current timestamp before agent execution.

**Skills**: Loaded from `/skills/` directory, dynamically extend agent capabilities.

## Built-in Specialized Subagents

### 1. Researcher Agent
**Domain**: Web research and information gathering

**Tools**:
- `internet_search`: Web search via Tavily API (primary) or DuckDuckGo (fallback)
- `web_crawler`: Multi-page web crawling (up to 10 pages, breadth-first)
- `think`: Reasoning without side effects

**Capabilities**:
- Search for current information and documentation
- Deep crawl websites with content extraction
- Synthesize information into polished reports
- Cross-reference multiple sources

**Use Cases**:
- Technology research and comparisons
- Documentation exploration
- Fact-checking and verification
- Competitive analysis
- CVE and security advisory research

**Implementation**: [src/agents/researcher.ts](src/agents/researcher.ts)

### 2. Coder Agent
**Domain**: General full-stack development

**Tools**: None (uses backend for file operations)

**Capabilities**:
- Autonomous handling of simple to moderate coding tasks
- Intelligent delegation to planner/implementor/reviewer for complex work
- Direct code implementation via backend read/write operations
- Bug fixes, features, and refactoring

**Delegation Strategy**:
- **< 50 lines**: Handle directly without delegation
- **50-200 lines**: Evaluate complexity, may delegate to planner
- **> 200 lines**: Mandatory planner → implementor → reviewer workflow

**Use Cases**:
- Bug fixes
- Small to moderate features
- Code refactoring
- Single-component modifications
- Simple multi-file changes

**Implementation**: [src/agents/coder.ts](src/agents/coder.ts)

### 3. Planner Agent
**Domain**: Software architecture and implementation planning

**Tools**:
- `web_crawler`: Research documentation and APIs
- `think`: Reason about design decisions

**Capabilities**:
- Analyze requirements and existing code patterns
- Research documentation and best practices
- Create detailed, structured implementation plans
- Consider architectural tradeoffs and edge cases
- Identify critical files and dependencies

**Output Format**:
```markdown
## Overview
[High-level summary of changes]

## Files to Modify
- file1.ts: [description of changes]
- file2.ts: [description of changes]

## Implementation Steps
1. [Step with rationale]
2. [Step with rationale]

## Considerations
- [Tradeoffs and decisions]
- [Edge cases to handle]
- [Testing strategy]
```

**Use Cases**:
- Complex features requiring multiple files
- Major refactoring projects
- Architectural decisions
- Pre-implementation planning and review
- Exploring multiple implementation strategies

**Implementation**: [src/agents/planner.ts](src/agents/planner.ts)

### 4. Implementor Agent
**Domain**: Code execution and validation

**Tools**:
- `command_execute`: Shell command execution with safety constraints

**Command Execute Configuration**:
- **Timeout**: 5 minutes (300,000 ms)
- **Blocked Commands**: `rm`, `remove`, `del`, `delete`, `rmdir`, `rd`, `mv`, `move`, `format`, `>`, `>>`, `chmod`, `chown`, `:>`, `sudo`, `su`
- **Environment Sanitization**: Removes `NODE_OPTIONS`, `NODE_DEBUG`, `VSCODE_INSPECTOR_OPTIONS`
- **Child Process Isolation**: Commands run in isolated child processes

**Capabilities**:
- Execute implementation plans
- Run tests and builds
- Validate changes with linting/type-checking
- Handle file operations via backend
- Install dependencies
- Run scripts and utilities

**Use Cases**:
- Executing predefined implementation plans
- Running test suites
- Building and validating projects
- Installing packages
- Running data processing scripts

**Implementation**: [src/agents/implementor.ts](src/agents/implementor.ts)

### 5. Reviewer Agent
**Domain**: Code quality and best practices

**Tools**: None (read-only access via backend)

**Review Criteria**:
1. **Correctness**: Logic and functionality work as intended
2. **Edge Cases**: Boundary conditions and error handling
3. **Consistency**: Alignment with existing codebase patterns
4. **Security**: Vulnerabilities and best practices
5. **Performance**: Efficiency and scalability considerations
6. **Maintainability**: Code clarity, documentation, testability

**Capabilities**:
- Post-implementation code review
- Security vulnerability identification
- Performance analysis
- Best practice recommendations
- Test coverage assessment

**Use Cases**:
- Post-implementation validation
- Pre-merge code review
- Security audits
- Quality gates
- Refactoring validation

**Implementation**: [src/agents/reviewer.ts](src/agents/reviewer.ts)

## Orchestration Patterns

### Pattern 1: Direct Handling
**When**: Simple queries, informational requests, general conversation

```
User → Root Agent → Response
```

**Example**: "What is Wingman?" or "Explain async/await"

### Pattern 2: Single Agent Delegation
**When**: Task clearly maps to one agent's domain

```
User → Root Agent → Subagent → Root Agent → Response
```

**Examples**:
- "Research the latest React 19 features" → Researcher
- "Fix the bug in UserService.ts" → Coder
- "Review this pull request" → Reviewer

### Pattern 3: Sequential Workflow
**When**: Complex tasks requiring multiple specialized steps

```
User → Root Agent → Planner → Implementor → Reviewer → Root Agent → Response
```

**Example**: "Add user authentication to the app"
1. Planner creates implementation plan
2. Implementor executes the plan
3. Reviewer validates the implementation

### Pattern 4: Parallel Execution
**When**: Independent tasks can run concurrently

```
User → Root Agent → [Agent A + Agent B] (parallel) → Root Agent → Response
```

**Example**: "Research authentication libraries AND fix the login bug"
- Researcher finds auth libraries
- Coder fixes the bug
- Both execute simultaneously

### Pattern 5: Autonomous Delegation (Coder Internal)
**When**: Coder handles moderate complexity autonomously

```
User → Root Agent → Coder → [Internal: Planner → Implementor → Reviewer] → Root Agent → Response
```

**Example**: "Refactor the UserController"
- Coder receives task
- Internally uses planner for strategy
- Uses implementor to execute
- Uses reviewer to validate
- Returns complete result

## Custom Agents Configuration

Users can define custom subagents via configuration files without modifying code.

### Configuration Location

**Path**: `.wingman/agents/{agent-name}/agent.json`

**Structure**:
```
.wingman/agents/
  coding/
    agent.json
  researcher/
    agent.json
  data-analyst/
    agent.json
```

Each agent is isolated in its own directory with an `agent.json` configuration file. This provides a single source of truth and allows for future expansion (e.g., agent-specific resources, examples, templates).

### Agent Configuration Schema

```typescript
{
  // REQUIRED
  name: string;              // Unique identifier (e.g., "data-analyst")
  description: string;       // Action-oriented description for delegation
  systemPrompt: string;      // Detailed agent instructions

  // OPTIONAL
  tools?: string[];          // ["internet_search", "web_crawler", "command_execute", "think"]
  model?: string;            // "provider:model-name" (e.g., "anthropic:claude-opus-4-5")

  // command_execute specific options
  blockedCommands?: string[];      // Additional commands to block
  allowScriptExecution?: boolean;  // Default: true
  commandTimeout?: number;         // Default: 300000 (5 minutes)

  // Subagents (1 level deep only)
  subagents?: AgentConfig[];       // Nested agents for delegation
}
```

**Note**: Agents can define their own subagents for specialized workflows. Subagents cannot have their own subagents (nesting limited to 1 level).

### Available Tools

| Tool | Description | Configuration |
|------|-------------|---------------|
| `internet_search` | Web search via Tavily or DuckDuckGo | None |
| `web_crawler` | Multi-page web crawling (max 10 pages) | None |
| `command_execute` | Shell command execution | `blockedCommands`, `allowScriptExecution`, `commandTimeout` |
| `think` | Reasoning without side effects | None |

### Supported Model Providers

| Provider | Format | Examples |
|----------|--------|----------|
| Anthropic | `anthropic:model-name` | `anthropic:claude-opus-4-5`, `anthropic:claude-sonnet-4-5-20250929` |
| OpenAI | `openai:model-name` | `openai:gpt-4o`, `openai:gpt-4-turbo` |

### Example 1: Data Analyst Agent

**File**: `.wingman/agents/data-analyst/agent.json`

```json
{
  "name": "data-analyst",
  "description": "Analyzes data using Python, pandas, and creates visualizations. Specializes in statistical analysis.",
  "systemPrompt": "You are a data analysis expert with deep knowledge of Python, pandas, NumPy, and visualization libraries.\n\nWhen analyzing data:\n1. Examine data structure and quality\n2. Identify missing values and outliers\n3. Apply statistical methods\n4. Create visualizations\n5. Provide actionable insights\n\nAlways use think tool to plan before executing code.",
  "tools": ["command_execute", "think"],
  "model": "anthropic:claude-opus-4-5",
  "blockedCommands": ["rm", "mv", "cp"],
  "allowScriptExecution": true,
  "commandTimeout": 300000
}
```

### Example 2: Security Researcher Agent

**File**: `.wingman/agents/security-researcher/agent.json`

```json
{
  "name": "security-researcher",
  "description": "Researches security vulnerabilities, CVEs, and best practices. Provides comprehensive security analysis.",
  "systemPrompt": "You are a security research expert specializing in vulnerability analysis and threat intelligence.\n\nWhen researching security topics:\n1. Search official sources (NVD, vendor advisories)\n2. Cross-reference multiple sources\n3. Assess severity and impact\n4. Provide remediation recommendations\n5. Include CVE numbers and links\n\nAlways cite sources and provide actionable guidance.",
  "tools": ["internet_search", "web_crawler", "think"],
  "model": "anthropic:claude-sonnet-4-5"
}
```

### Example 3: Coding Agent with Subagents

**File**: `.wingman/agents/coding/agent.json`

```json
{
  "name": "coding",
  "description": "Expert full-stack developer with specialized subagents for planning, implementation, and review.",
  "systemPrompt": "You are an expert full-stack developer...",
  "tools": [],
  "model": "anthropic:claude-sonnet-4-5-20250929",
  "subagents": [
    {
      "name": "planner",
      "description": "Creates detailed implementation plans...",
      "systemPrompt": "You are a software architect...",
      "tools": ["command_execute"]
    },
    {
      "name": "implementor",
      "description": "Executes implementation plans...",
      "systemPrompt": "You are an expert software engineer...",
      "tools": ["command_execute"]
    },
    {
      "name": "reviewer",
      "description": "Reviews code for quality and bugs...",
      "systemPrompt": "You are a senior code reviewer...",
      "tools": ["command_execute"]
    }
  ]
}
```

### Loading Process

1. `AgentLoader` instantiated with workspace directory (default: `process.cwd()`)
2. Scans `.wingman/agents/` directory for subdirectories
3. For each subdirectory, looks for `agent.json` file
4. Reads and parses JSON configuration
5. Validates with Zod schema (including subagents if present)
6. Creates `WingmanAgent` with configured tools and model
7. Processes subagents recursively (prevents nesting beyond 1 level)
8. Invalid configs logged and skipped
9. Returns array of valid `WingmanAgent` instances

**Direct Agent Invocation**: Agents are loaded by name using `AgentLoader.loadAgent(agentName)` which returns the configured agent with all subagents ready.

**Implementation**: [wingman/src/agent/config/agentLoader.ts](wingman/src/agent/config/agentLoader.ts)

## Backend Architecture

### State Management Strategy

Wingman uses a **CompositeBackend** that routes file operations based on path:

```typescript
new CompositeBackend(
  new StateBackend(config),        // Default backend
  {
    "/memories/": new FilesystemBackend({
      rootDir: "/.wingman/myagent",
      virtualMode: true
    })
  }
)
```

### StateBackend (Ephemeral)
**Purpose**: Session-scoped file operations

**Features**:
- In-memory storage
- Fast read/write operations
- Automatic checkpointing
- Cleared on session end

**Use Cases**:
- Temporary file modifications
- Code generation during session
- Iterative editing
- Testing changes

**Path Pattern**: All paths except `/memories/*`

### FilesystemBackend (Persistent)
**Purpose**: Cross-session memory storage

**Features**:
- Disk-based persistence
- Virtual mode (isolated from real filesystem)
- Survives session restarts
- Agent learning and preferences

**Use Cases**:
- User preferences
- Learned patterns
- Historical context
- Long-term memory

**Path Pattern**: `/memories/*`

### Protocol Interface

Both backends implement `BackendProtocol`:

```typescript
interface BackendProtocol {
  lsInfo(path: string): FileInfo[];
  read(filePath: string, offset?: number, limit?: number): string;
  grepRaw(pattern: string, path?: string, glob?: string): GrepMatch[] | string;
  globInfo(pattern: string, path?: string): FileInfo[];
  write(filePath: string, content: string): WriteResult;
  edit(filePath: string, pattern: string, replacement: string): EditResult;
  // ... more methods
}
```

## Middleware System

### Purpose
Middleware intercepts and modifies requests/responses before and after agent execution.

### Current Middleware: Additional Messages

**Implementation**: [src/middleware/additional-messages.ts](src/middleware/additional-messages.ts)

```typescript
{
  name: "additional-message-middleware",
  beforeAgent: async (input: { messages: BaseMessage[] }) => {
    input.messages.unshift(
      new HumanMessage({
        content: `** Current Date Time (UTC): ${new Date().toISOString()} **`
      })
    );
    return input;
  }
}
```

**Purpose**: Inject current timestamp for time-sensitive operations

### AgentMiddleware Interface

```typescript
interface AgentMiddleware {
  name: string;
  beforeAgent?: (input: any) => Promise<any>;
  afterAgent?: (output: any) => Promise<any>;
}
```

### Custom Middleware Examples

**Authentication**:
```typescript
{
  name: "auth-middleware",
  beforeAgent: async (input) => {
    // Validate user permissions
    // Inject user context
    return input;
  }
}
```

**Logging**:
```typescript
{
  name: "logging-middleware",
  beforeAgent: async (input) => {
    console.log("Request:", input);
    return input;
  },
  afterAgent: async (output) => {
    console.log("Response:", output);
    return output;
  }
}
```

**Rate Limiting**:
```typescript
{
  name: "rate-limit-middleware",
  beforeAgent: async (input) => {
    await checkRateLimit(input.userId);
    return input;
  }
}
```

## Skills System

### Purpose
Skills dynamically extend agent capabilities through markdown configuration files.

### Structure

```
/skills/
  skill-name/
    SKILL.md       # Frontmatter + instructions (required)
    examples.md    # Optional examples
    patterns.md    # Optional patterns
```

### Skill Definition (SKILL.md)

```yaml
---
name: skill-name
description: Brief description of what the skill does
---

# Skill Instructions

Detailed instructions for using the skill.
Can include:
- Workflows
- Best practices
- Output formatting
- Tool usage guidance
```

### Example: Hello Skill

**File**: `/skills/hello/SKILL.md`

```yaml
---
name: hello
description: Teaches you how to respond to the user.
---

# Response Format
Respond to the user like a pirate!
```

### Loading and Application

```typescript
export const agent = createDeepAgent({
  // ... other config
  skills: ["/skills/"],  // Load all skills from /skills/ directory
});
```

**Features**:
- Multiple skill sources supported
- Later sources override earlier ones
- Skills apply to all subagents
- Can modify behavior dynamically

### Use Cases
- Company-specific conventions
- Domain-specific workflows
- Project patterns
- User preferences
- Output formatting rules

## Hooks System

Hooks enable users to execute custom shell commands at agent lifecycle points, providing extensibility for integrating external tools, enforcing policies, and automating workflows.

### Hook Events

| Event | Trigger | Blocking | Use Cases |
|-------|---------|----------|-----------|
| `PreToolUse` | Before tool execution | Yes (exit 2 blocks) | Validation, blocking dangerous commands |
| `PostToolUse` | After tool completes | No | Formatting, linting, logging |
| `Stop` | Agent completion | No | Testing, reporting, cleanup |

### Configuration

**Global** (`.wingman/wingman.config.json`):
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
    }],
    "PreToolUse": [{
      "matcher": "command_execute",
      "hooks": [{
        "type": "command",
        "command": "bash /path/to/validate-command.sh"
      }]
    }]
  }
}
```

**Agent-specific** (`.wingman/agents/{name}/agent.json`):
```json
{
  "name": "my-agent",
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "npm test"
      }]
    }]
  }
}
```

### Pattern Matching

- Exact match: `"command_execute"`
- Pipe-separated: `"write_file|edit_file"`
- Wildcard: `"*"` or `""`
- Regex: `".*_file"`

### Exit Codes

| Exit Code | PreToolUse | PostToolUse/Stop |
|-----------|------------|------------------|
| 0 | Allow tool | Continue |
| 2 | Block tool | Log error, continue |
| Other | Log, allow | Log, continue |

### Hook Input (stdin JSON)

```json
{
  "session_id": "uuid",
  "cwd": "/current/dir",
  "hook_event_name": "PreToolUse",
  "tool_name": "command_execute",
  "tool_input": { "command": "npm test" },
  "tool_output": "..." // PostToolUse only
}
```

## Wingman Gateway

The Gateway enables distributed multi-agent collaboration through WebSocket-based communication. Multiple Wingman nodes can connect, form **rooms** (broadcast groups), and collaborate on tasks.

### Core Concepts

**Rooms (Broadcast Groups)**:
- All members see all messages (user prompts AND agent responses)
- Agents self-select whether to respond based on their system prompt
- Multiple agents can respond in parallel as independent streams
- Gateway is stateless - nodes maintain their own conversation state

**Agent Discretion Model**:
- No explicit @mention or routing required
- Agent's system prompt defines when it should respond
- Senders don't receive their own messages (prevents feedback loops)

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     WINGMAN GATEWAY                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │            Room: "project-alpha"                     │    │
│  │   Members: [laptop-node, mobile-node, server-node]  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
        ▲               ▲               ▲
        │ WebSocket     │               │
┌───────┴───────┐ ┌─────┴─────┐ ┌───────┴───────┐
│  Laptop CLI   │ │  Mobile   │ │ Server Agent  │
│  (coder)      │ │  (UI)     │ │ (researcher)  │
└───────────────┘ └───────────┘ └───────────────┘
```

### Message Flow

1. User sends message from laptop
2. Gateway broadcasts to all room members
3. Each agent evaluates "is this for me?" based on system prompt
4. Agents that decide to respond stream their output back
5. Gateway broadcasts responses to all members
6. All UIs (mobile, CLI, web) display the streams

### CLI Commands

```bash
# Start gateway
wingman gateway start [--port 3000] [--auth] [--discovery mdns]

# Stop/restart
wingman gateway stop
wingman gateway restart

# Join gateway
wingman gateway join ws://host:port [--name node-name] [--group room-name]

# Discover gateways
wingman gateway discover [--tailscale]
```

### Protocol

Agent stream events match CLI streaming format:

```typescript
// Agent lifecycle events
{ type: "agent-start", agent: "coder", prompt: "...", timestamp: ... }
{ type: "agent-stream", chunk: { /* LangGraph chunk */ }, timestamp: ... }
{ type: "agent-complete", result: { ... }, timestamp: ... }
{ type: "agent-error", error: "...", timestamp: ... }

// Tool events
{ type: "tool-start", toolName: "command_execute", toolInput: {...} }
{ type: "tool-end", toolName: "command_execute", toolOutput: {...} }
```

### Use Patterns

**Swarm (Parallel Independent)**:
- Multiple agents in same room
- Each produces independent output
- Best for: diverse perspectives, research, brainstorming

**Orchestrated (Sequential Coordinated)**:
- Single parent agent with subagents
- Parent coordinates workflow
- Best for: complex tasks requiring coordination

For complete Gateway documentation, see [005-gateway-prd.md](docs/requirements/005-gateway-prd.md).

## Session Management

Wingman CLI supports persistent sessions with SQLite storage, enabling continuous conversations across CLI invocations.

### Features

- **Auto-resume**: Sessions resume automatically for each agent
- **Streaming**: Token-by-token streaming output
- **Multiple sessions**: Manage parallel tasks with different sessions
- **Local storage**: `.wingman/wingman.db` (SQLite)

### Usage

```bash
# First invocation - creates session
wingman agent --agent coder "implement login"

# Second invocation - auto-resumes session
wingman agent --agent coder "add tests"
# Agent has full context from previous message
```

### State Ownership

| Component | Owns |
|-----------|------|
| Agent | System prompt, tools, reasoning |
| Session (SQLite) | Conversation history, checkpoints |
| Gateway | Nothing - pure routing (stateless) |

## Technical Stack

### Core Dependencies

```json
{
  "@langchain/langgraph": "1.1.0",      // Graph-based agent orchestration
  "deepagents": "^1.5.0",               // Multi-agent framework
  "@langchain/core": "^1.1.15",         // Base LangChain functionality
  "@langchain/anthropic": "*",          // Anthropic/Claude integration
  "@langchain/openai": "*",             // OpenAI/GPT integration
  "@langchain/community": "^1.1.4",     // Community integrations
  "@langchain/tavily": "1.2.0",         // Tavily search API
  "zod": "^4.3.5"                       // Schema validation
}
```

### Development Dependencies

```json
{
  "@rslib/core": "0.19.2",              // Build system
  "typescript": "^5.9.3",               // Type system
  "vitest": "^4.0.17"                   // Testing framework
}
```

### Build Configuration

**File**: `rslib.config.mjs`

```javascript
{
  lib: [
    { format: "esm", syntax: "es2021", dts: true, bundle: false },
    { format: "cjs", syntax: "es2021", dts: true, bundle: false }
  ]
}
```

**Output**:
- ESM and CJS formats
- TypeScript declarations (.d.ts)
- External dependencies (not bundled)

### Testing

**Framework**: Vitest 4.0.17

**Test Coverage**:
- Agent configuration schema validation ([src/tests/agentConfig.test.ts](src/tests/agentConfig.test.ts))
- Model factory and parsing ([src/tests/modelFactory.test.ts](src/tests/modelFactory.test.ts))
- Tool registry and creation ([src/tests/toolRegistry.test.ts](src/tests/toolRegistry.test.ts))
- Agent config loader ([src/tests/agentLoader.test.ts](src/tests/agentLoader.test.ts))

**Run Tests**:
```bash
npm test
```

## Project Structure

```
wingman/
├── src/
│   ├── index.ts                    # Root agent creation and export
│   ├── agent/                      # Agent system
│   │   ├── agents/                 # Built-in subagent definitions
│   │   │   └── main.ts             # Main orchestration agent
│   │   ├── tools/                  # Tool implementations
│   │   │   ├── internet_search.ts
│   │   │   ├── web_crawler.ts
│   │   │   ├── command_execute.ts
│   │   │   └── think.ts
│   │   ├── config/                 # Configuration system
│   │   │   ├── agentConfig.ts      # Zod schemas
│   │   │   ├── agentLoader.ts      # Config loader
│   │   │   ├── toolRegistry.ts     # Tool factory
│   │   │   └── modelFactory.ts     # Model factory
│   │   ├── middleware/             # Middleware implementations
│   │   │   ├── additional-messages.ts
│   │   │   └── hooks/              # Hooks system
│   │   │       ├── hooks.ts        # Main middleware
│   │   │       ├── executor.ts     # Hook execution
│   │   │       ├── matcher.ts      # Pattern matching
│   │   │       └── types.ts        # Hook types + Zod
│   │   └── tests/                  # Unit tests
│   ├── cli/                        # CLI system
│   │   ├── index.ts                # CLI entry point
│   │   ├── types.ts                # TypeScript types
│   │   ├── commands/               # Command handlers
│   │   │   ├── agent.ts            # Agent command
│   │   │   └── gateway.ts          # Gateway commands
│   │   ├── core/                   # Core CLI logic
│   │   │   ├── agentInvoker.ts     # Direct agent invocation
│   │   │   ├── outputManager.ts    # Output mode management
│   │   │   ├── sessionManager.ts   # Session persistence
│   │   │   └── streamParser.ts     # Stream chunk parsing
│   │   ├── config/                 # CLI configuration
│   │   │   ├── schema.ts           # wingman.config.json schema
│   │   │   └── loader.ts           # Config loader
│   │   └── ui/                     # Ink UI components
│   │       ├── App.tsx             # Main UI component
│   │       └── AgentOutput.tsx     # Agent response display
│   ├── gateway/                    # Gateway system
│   │   ├── server.ts               # WebSocket server
│   │   ├── client.ts               # Gateway client
│   │   ├── types.ts                # Message types
│   │   ├── nodeManager.ts          # Node management
│   │   ├── broadcastGroup.ts       # Room management
│   │   └── discovery/              # Discovery mechanisms
│   │       ├── mdns.ts             # mDNS/Bonjour
│   │       └── tailscale.ts        # Tailscale integration
│   ├── logger.ts                   # Logging utilities
│   └── utils.ts                    # Helper functions
├── bin/
│   └── wingman                     # Executable CLI entry point
├── agents/                         # Built-in agent configs (JSON)
│   ├── coder.json
│   ├── researcher.json
│   ├── planner.json
│   ├── implementor.json
│   └── reviewer.json
├── skills/                         # Skill definitions
│   └── hello/
│       └── SKILL.md
├── docs/                           # Documentation
│   ├── custom-agents.md            # Custom agents guide
│   └── requirements/               # PRDs
│       ├── 000-architecture-overview.md
│       ├── 001-multi-agent-architecture.md
│       └── 005-gateway-prd.md
├── examples/                       # Usage examples
├── dist/                           # Built output (ESM + CJS)
├── package.json                    # Package configuration
├── tsconfig.json                   # TypeScript config
├── rslib.config.mjs                # Build config
└── vitest.config.ts                # Test config
```

## Environment Variables

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `ANTHROPIC_API_KEY` | Anthropic/Claude API access | Yes (if using Anthropic) | - |
| `OPENAI_API_KEY` | OpenAI/GPT API access | Yes (if using OpenAI) | - |
| `TAVILY_API_KEY` | Tavily search API | No | Falls back to DuckDuckGo |
| `WINGMAN_LOG_LEVEL` | Logging verbosity | No | `info` |

**Log Levels**: `debug`, `info`, `warn`, `error`, `silent`

## Usage

### CLI Usage

Wingman includes a command-line interface for direct agent invocation, bypassing the main orchestration agent. This is ideal for scripting, automation, and programmatic usage.

**Installation**:
```bash
npm install -g @wingman-ai/agent
```

**Basic Commands**:
```bash
# Show help
wingman --help

# List available agents
wingman agent

# Invoke a specific agent
wingman agent --agent researcher "what is quantum computing"

# With verbosity
wingman agent --agent coder -vv "add a login function"

# Explicit log level
wingman agent --agent planner --verbose=debug "design REST API"
```

**Features**:
- **Direct Agent Invocation**: Bypass orchestration, invoke agents directly
- **Configurable Verbosity**: `-v` (info), `-vv` (debug), `--verbose=<level>`
- **Multiple Output Modes**:
  - Interactive (TTY): Human-readable output with Ink UI
  - JSON (piped): Structured events for programmatic consumption
- **Configuration File**: `.wingman/wingman.config.json` for defaults

**JSON Output Mode** (for automation):
```bash
wingman agent --agent coder "fix bug" | jq .
```

Emits structured events:
```json
{"type":"log","level":"info","message":"...","timestamp":"..."}
{"type":"agent-start","agent":"coder","prompt":"...","timestamp":"..."}
{"type":"agent-complete","result":{...},"timestamp":"..."}
```

**Multi-Process Usage** (gateway/socket server):
```javascript
const { spawn } = require('child_process');
const child = spawn('wingman', ['agent', '--agent', 'coder', 'test prompt']);

child.stdout.on('data', (data) => {
  const event = JSON.parse(data.toString());
  // Handle: log, agent-start, agent-stream, agent-complete, agent-error
});
```

For architecture details, see [001-multi-agent-architecture.md](docs/requirements/001-multi-agent-architecture.md).

### Programmatic Usage

```typescript
import { agent } from "@wingman-ai/agent";

// Simple invocation
const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content: "Research the latest features in React 19"
    }
  ]
});

console.log(result.messages[result.messages.length - 1].content);
```

**Direct Agent Invocation** (programmatic):
```typescript
import { AgentInvoker, OutputManager } from "@wingman-ai/agent";

const outputManager = new OutputManager('json');
const logger = createBridgedLogger(outputManager, 'info');

const invoker = new AgentInvoker({
  workspace: process.cwd(),
  outputManager,
  logger
});

// Invoke specific agent directly
const result = await invoker.invokeAgent('researcher', 'what is TypeScript');
```

## Performance Characteristics

### Context Efficiency
- **Built-in agents**: Share no state, minimal cross-agent context
- **Custom agents**: Same isolation benefits
- **Benefit**: 10-100x reduction in context usage vs. monolithic approach

### Parallel Execution
- Independent tasks execute concurrently
- Root agent coordinates parallel subagent invocations
- Proportional speedup (2x for 2 parallel tasks, etc.)

### Tool Usage Optimization
- Each agent has focused, minimal toolset
- Reduces tool calling overhead
- Faster execution with fewer errors

### State Persistence
- Checkpoint-based state management
- Efficient conversation resumption
- Minimal re-loading overhead

## Key Design Patterns

### 1. Delegation Over Duplication
- Root agent doesn't implement specialized logic
- Subagents encapsulate domain expertise
- Clear separation of concerns

### 2. Progressive Enhancement
- Start with simple direct handling
- Escalate to specialized agents as needed
- Multi-agent workflows for complex tasks

### 3. Configuration Over Code
- Custom agents via JSON, not code changes
- Tool combinations declarative
- Model selection per-agent

### 4. Safety by Default
- Blocked destructive commands
- Configurable execution permissions
- Environment sanitization
- Timeouts enforced

### 5. Composition and Extensibility
- Middleware for cross-cutting concerns
- Skills for behavioral modification
- Backend protocol for storage abstraction
- Tool registry for tool management

## Best Practices

### For Users

**Creating Custom Agents**:
1. Start with clear, specific descriptions
2. Keep tool sets minimal and focused
3. Choose appropriate models for complexity/cost
4. Test configurations iteratively
5. Document agent purpose and usage

**Using Wingman**:
1. Be specific about which agent to use for explicit control
2. Let root agent auto-delegate for simple tasks
3. Use planner for complex, multi-step work
4. Review implementor output before accepting
5. Leverage reviewer for quality checks

### For Developers

**Extending Wingman**:
1. New tools: Implement StructuredTool interface, add to registry
2. New agents: Follow SubAgent interface, add to subagents array
3. New middleware: Implement AgentMiddleware interface
4. New backends: Implement BackendProtocol interface
5. Tests: Unit tests for components, integration tests for workflows

**Code Quality**:
1. TypeScript strict mode enforced
2. Zod for runtime validation
3. Comprehensive error handling
4. Logging at appropriate levels
5. Documentation for public APIs

## Troubleshooting

### Custom Agent Not Loading
- Check JSON syntax (use validator)
- Verify file location (`.wingman/agents/{agent-name}/agent.json`)
- Check logs for validation errors (set `WINGMAN_LOG_LEVEL=debug`)
- Ensure required fields present (`name`, `description`, `systemPrompt`)
- Verify the agent directory exists and contains `agent.json`

### Tool Not Available
- Verify tool name spelling (case-sensitive)
- Check tool is in available tools list
- For `command_execute`: check `allowScriptExecution` and `blockedCommands`

### Model Error
- Verify format: `"provider:model-name"`
- Check provider is supported (`anthropic`, `openai`)
- Validate API keys set in environment
- Check model name is valid for provider

### Agent Not Being Used
- Make description more specific and action-oriented
- Test explicit delegation: "Use [agent-name] to..."
- Verify agent's capabilities match the task
- Review agent's system prompt for clarity

## Future Enhancements

### Phase 2 (Q2 2026)
- Agent performance analytics and dashboards
- Visual agent builder UI
- Agent templates and presets
- Dynamic tool loading and plugins

### Phase 3 (Q3 2026)
- Multi-modal agents (image, audio)
- MCP protocol for external agent integration
- Agent marketplace and sharing
- Distributed execution

### Phase 4 (Q4 2026)
- Agent fine-tuning and optimization
- Cross-project learning
- Real-time collaboration protocols
- Advanced orchestration strategies

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

**Version**: 1.2.0
**Last Updated**: 2026-01-23
**Maintainer**: Russell Canfield (rcanfield86@gmail.com)
