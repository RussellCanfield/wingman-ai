# PRD-003: CLI Direct Agent Invocation

## Overview
Wingman CLI provides a command-line interface for direct agent invocation, bypassing the main orchestration agent. This enables automation, scripting, and programmatic usage of Wingman's specialized agents.

## Problem Statement
Current challenges with agent usage:
- Main orchestration agent adds overhead for simple, direct agent tasks
- No easy way to script or automate agent invocations
- Difficult to integrate Wingman into external systems (gateways, servers)
- Logging output interferes with programmatic consumption of results
- No standardized way to surface errors and events to parent processes

## Goals
1. Enable direct invocation of specific agents without orchestration overhead
2. Provide CLI with configurable verbosity for debugging
3. Support both interactive (human) and JSON (machine) output modes
4. Enable multi-process usage (gateway, socket server scenarios)
5. Maintain extensibility for future CLI commands

## Non-Goals
- Streaming real-time agent responses (future enhancement)
- Web-based UI (separate project)
- Agent creation/configuration via CLI (use config files)
- Integration with CI/CD pipelines (user responsibility)

## Architecture

### CLI Entry Point
**File**: `wingman/bin/wingman`

**Purpose**: Executable script that loads and runs the CLI

**Implementation**:
```bash
#!/usr/bin/env node
import('../dist/cli/index.js');
```

### Main CLI Module
**File**: `wingman/src/cli/index.ts`

**Responsibilities**:
- Parse command-line arguments
- Detect output mode (TTY vs piped)
- Load configuration from `.wingman/wingman.config.json`
- Route to command handlers
- Handle global help and errors

**Argument Parsing**:
- Command: First positional argument (`agent`, `chat`, etc.)
- Flags: `--agent <name>`, `-v`, `-vv`, `--verbose=<level>`, `--help`
- Prompt: All remaining arguments

### Command System

#### Agent Command
**File**: `wingman/src/cli/commands/agent.ts`

**Purpose**: Handle `wingman agent` command

**Usage**:
```bash
wingman agent --agent <name> [options] <prompt>
```

**Options**:
- `--agent <name>`: Agent to invoke (required)
- `-v`: Info level logging
- `-vv`: Debug level logging
- `--verbose=<level>`: Explicit log level (debug|info|warn|error|silent)

**Behavior**:
- If no agent specified: List available agents and exit
- If agent specified: Invoke agent with prompt
- Route output through OutputManager

**Future Commands** (placeholder for extensibility):
- `wingman chat`: General conversation mode
- `wingman plan`: Create implementation plans
- `wingman review`: Code review mode

### Core Components

#### AgentInvoker
**File**: `wingman/src/cli/core/agentInvoker.ts`

**Purpose**: Direct agent invocation bypassing main orchestration

**Key Methods**:
```typescript
class AgentInvoker {
  getAvailableAgents(): SubAgent[]
  findAgent(name: string): SubAgent | undefined
  invokeAgent(agentName: string, prompt: string): Promise<any>
  listAgents(): Array<{ name: string; description: string }>
}
```

**Implementation**:
- Uses `AgentConfigLoader` to load all agents
- Creates standalone DeepAgent for target agent
- No subagents, no delegation - direct invocation only
- Emits events via OutputManager during execution

#### OutputManager
**File**: `wingman/src/cli/core/outputManager.ts`

**Purpose**: Manage output mode and event emission

**Output Modes**:
- **Interactive**: Human-readable UI via Ink (React components)
- **JSON**: Structured events to stdout (for piping/parsing)

**Mode Detection**:
```typescript
static detectMode(): OutputMode {
  return process.stdout.isTTY ? 'interactive' : 'json';
}
```

**Event Types**:
```typescript
type OutputEvent =
  | LogEvent              // Logger output
  | AgentStartEvent       // Agent invocation started
  | AgentStreamEvent      // Streaming content (future)
  | AgentCompleteEvent    // Agent finished successfully
  | AgentErrorEvent;      // Agent error occurred
```

**JSON Event Format**:
```json
{"type":"log","level":"info","message":"Invoking agent: researcher","timestamp":"2026-01-19T12:00:00.000Z"}
{"type":"agent-start","agent":"researcher","prompt":"what is TypeScript","timestamp":"2026-01-19T12:00:00.100Z"}
{"type":"agent-complete","result":{...},"timestamp":"2026-01-19T12:00:05.200Z"}
```

#### LoggerBridge
**File**: `wingman/src/cli/core/loggerBridge.ts`

**Purpose**: Bridge WingmanLogger to OutputManager events

**Implementation**:
```typescript
function createBridgedLogger(
  outputManager: OutputManager,
  level: LogLevel = 'info'
): Logger
```

**Behavior**:
- Creates `EventLogger` (extended logger type)
- Routes log calls to OutputManager
- OutputManager handles mode-specific output (Ink UI vs JSON)
- Logs go to stderr in interactive mode, stdout as JSON in pipe mode

### Configuration

#### Schema
**File**: `wingman/src/cli/config/schema.ts`

**Configuration File**: `.wingman/wingman.config.json`

**Schema**:
```typescript
{
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'silent';  // Default: 'info'
  defaultAgent?: string;                                       // Default agent name
  cli?: {
    theme?: string;                          // Default: 'default' (future use)
    outputMode?: 'auto' | 'interactive' | 'json';  // Default: 'auto'
  };
}
```

**Example Configuration**:
```json
{
  "logLevel": "info",
  "defaultAgent": "coder",
  "cli": {
    "theme": "default",
    "outputMode": "auto"
  }
}
```

#### Loader
**File**: `wingman/src/cli/config/loader.ts`

**Purpose**: Load and validate configuration

**Behavior**:
- Looks for `.wingman/wingman.config.json`
- Returns default config if file doesn't exist
- Validates with Zod schema
- Logs warnings for invalid config (doesn't fail)

**Priority**:
1. CLI flags (highest priority)
2. Configuration file
3. Default values (lowest priority)

### UI Components (Ink)

#### App Component
**File**: `wingman/src/cli/ui/App.tsx`

**Purpose**: Main UI shell for interactive mode

**Features**:
- Displays agent name and status
- Shows log events with color coding
- Displays agent output
- Handles errors with stack traces
- Shows completion status

**State Management**:
- Listens to OutputManager events
- Updates state reactively
- Renders based on event type

#### AgentOutput Component
**File**: `wingman/src/cli/ui/AgentOutput.tsx`

**Purpose**: Display agent response content

**Features**:
- Markdown-aware rendering (future enhancement)
- Streaming indicator
- Formatted code blocks

#### LogDisplay Component
**File**: `wingman/src/cli/ui/LogDisplay.tsx`

**Purpose**: Display log events

**Features**:
- Color-coded by log level (debug=gray, info=blue, warn=yellow, error=red)
- Scrolling with max logs limit
- Timestamp display
- Arg expansion

#### ErrorDisplay Component
**File**: `wingman/src/cli/ui/ErrorDisplay.tsx`

**Purpose**: Format error messages

**Features**:
- Bold error header
- Error message in red
- Optional stack trace (debug mode)

### Logger Extensions

**File**: `wingman/src/logger.ts`

**New Class**: `EventLogger`

**Purpose**: Logger that emits events instead of writing to streams

**Implementation**:
```typescript
class EventLogger implements Logger {
  constructor(
    private callback: LogEventCallback,
    private level: LogLevel = 'info'
  ) {}

  debug(message: string, ...args: any[]): void
  info(message: string, ...args: any[]): void
  warn(message: string, ...args: any[]): void
  error(message: string, ...args: any[]): void
}
```

**Factory Function**:
```typescript
function createEventLogger(
  callback: LogEventCallback,
  level: LogLevel = 'info'
): Logger
```

**Usage**:
- CLI creates EventLogger with OutputManager callback
- All log calls route through OutputManager
- OutputManager decides how to render (Ink UI or JSON)

## User Flows

### Flow 1: List Available Agents
```bash
$ wingman agent
```

**Expected Output** (Interactive):
```
Available agents:
  coding: General full-stack development
  researcher: Web research and information gathering
  planner: Software architecture and implementation planning
  implementor: Code execution and validation
  reviewer: Code quality and best practices

Usage: wingman agent --agent <name> "your prompt here"
```

**Expected Output** (JSON):
```json
{"type":"agent-error","error":"No agent specified","timestamp":"..."}
```

### Flow 2: Invoke Agent (Interactive)
```bash
$ wingman agent --agent researcher "what is TypeScript"
```

**Expected Output**:
```
Wingman CLI

Agent: researcher

[INFO] Invoking agent: researcher
[INFO] Agent completed successfully

Agent Response:
TypeScript is a programming language developed by Microsoft...

✓ Complete
```

### Flow 3: Invoke Agent (JSON Mode)
```bash
$ wingman agent --agent researcher "what is TypeScript" | jq .
```

**Expected Output**:
```json
{"type":"log","level":"info","message":"Invoking agent: researcher","timestamp":"..."}
{"type":"agent-start","agent":"researcher","prompt":"what is TypeScript","timestamp":"..."}
{"type":"log","level":"info","message":"Agent completed successfully","timestamp":"..."}
{"type":"agent-complete","result":{...},"timestamp":"..."}
```

### Flow 4: Multi-Process Usage
```javascript
const { spawn } = require('child_process');

const child = spawn('wingman', ['agent', '--agent', 'coder', 'test prompt']);

child.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(l => l);

  for (const line of lines) {
    const event = JSON.parse(line);

    switch(event.type) {
      case 'log':
        console.log(`[${event.level}] ${event.message}`);
        break;
      case 'agent-start':
        console.log(`Agent ${event.agent} started`);
        break;
      case 'agent-complete':
        console.log('Result:', event.result);
        break;
      case 'agent-error':
        console.error('Error:', event.error);
        break;
    }
  }
});

child.stderr.on('data', (data) => {
  console.error('stderr:', data.toString());
});

child.on('close', (code) => {
  console.log(`Process exited with code ${code}`);
});
```

### Flow 5: Verbosity Control
```bash
# Info level (default)
$ wingman agent --agent coder -v "add function"

# Debug level (verbose)
$ wingman agent --agent coder -vv "add function"

# Explicit level
$ wingman agent --agent coder --verbose=debug "add function"

# Silent (errors only)
$ wingman agent --agent coder --verbose=silent "add function"
```

### Flow 6: Configuration File
```bash
# Create config
$ mkdir -p .wingman
$ cat > .wingman/wingman.config.json <<EOF
{
  "logLevel": "debug",
  "defaultAgent": "coder",
  "cli": {
    "outputMode": "auto"
  }
}
EOF

# Use default agent from config
$ wingman agent "add a function"  # Uses 'coder' agent
```

## Technical Requirements

### Dependencies
```json
{
  "ink": "^5.2.1",          // React-based terminal UI
  "react": "^18.3.1",       // Required for Ink
  "zod": "^4.3.5"           // Configuration validation
}
```

### TypeScript Configuration
```json
{
  "jsx": "react",           // Enable JSX for Ink components
  "module": "esnext",
  "target": "esnext"
}
```

### Build Configuration
- No special rslib configuration needed
- CLI code included in standard ESM/CJS build
- `bin/wingman` script made executable with chmod +x

### Package.json
```json
{
  "bin": {
    "wingman": "./bin/wingman"
  },
  "files": ["dist", "bin"],
  "scripts": {
    "cli": "./bin/wingman",
    "cli:help": "./bin/wingman --help",
    "cli:list": "./bin/wingman agent"
  }
}
```

## Performance Characteristics

### Direct Invocation Benefits
- **Faster**: No orchestration overhead (~50-100ms saved)
- **Simpler**: Direct agent execution path
- **Predictable**: No delegation decision-making

### Output Mode Performance
- **Interactive**: Slight overhead from React rendering (~10-20ms)
- **JSON**: Minimal overhead, direct stdout writes

### Memory Usage
- **Interactive**: ~30-50MB for Ink runtime
- **JSON**: ~10-20MB baseline Node.js

## Security Considerations

### Command Injection
- All user input sanitized before agent invocation
- No direct shell execution of user prompts
- Agent tools have built-in command blocking

### Environment Variables
- API keys not exposed in logs or output
- Sanitized in `command_execute` tool
- Never included in JSON events

### File System Access
- CLI respects agent tool permissions
- `command_execute` blocked commands enforced
- No elevated privileges required

## Success Metrics

### Usage Metrics
- CLI invocations per day
- Most commonly used agents
- Interactive vs JSON mode usage ratio
- Average verbosity level usage

### Performance Metrics
- CLI startup time (target: <500ms)
- Agent invocation latency (target: <200ms overhead)
- JSON parsing success rate (target: 100%)

### Quality Metrics
- Error rate (target: <1%)
- JSON event malformation rate (target: 0%)
- User-reported issues (track via GitHub)

## Testing Strategy

### Unit Tests
- Argument parsing logic
- Output mode detection
- Configuration loading
- Logger bridging

### Integration Tests
- Full CLI invocation with mock agents
- JSON output validation
- Interactive mode rendering
- Multi-process communication

### End-to-End Tests
- Real agent invocations
- Verbosity levels
- Configuration file loading
- Error handling

## Migration Path

### Phase 1 (Current - v1.2.0)
- ✅ Core CLI infrastructure
- ✅ Direct agent invocation
- ✅ Verbosity control
- ✅ JSON output mode
- ✅ Configuration file support
- ✅ Ink UI components

### Phase 2 (v1.3.0)
- Streaming agent responses in real-time
- Progress indicators for long-running tasks
- Enhanced Ink UI with markdown rendering
- CLI command history and autocomplete

### Phase 3 (v1.4.0)
- Additional trigger commands (chat, plan, review)
- Interactive agent selection (fuzzy finder)
- Multi-agent invocation (parallel execution)
- Output formatting options (table, tree, etc.)

### Phase 4 (v1.5.0)
- Web UI mode (launches local server)
- Desktop UI mode (Electron wrapper)
- Remote agent execution (API mode)
- Agent marketplace integration

## Error Handling

### Invalid Agent Name
**Error**:
```
Error: Agent "nonexistent" not found. Available agents: coding, researcher, planner, implementor, reviewer
```

**Exit Code**: 1

### No Agent Specified
**Interactive**:
```
Available agents:
  coding: General full-stack development
  ...

Usage: wingman agent --agent <name> "your prompt here"
```

**JSON**:
```json
{"type":"agent-error","error":"No agent specified","timestamp":"..."}
```

**Exit Code**: 1

### Agent Invocation Failure
**Interactive**:
```
Error: Failed to invoke agent: Connection timeout
```

**JSON**:
```json
{"type":"agent-error","error":"Failed to invoke agent","stack":"...","timestamp":"..."}
```

**Exit Code**: 1

### Configuration Error
**Warning** (non-fatal):
```
Warning: Invalid wingman.config.json: logLevel: Invalid enum value
Using default configuration
```

**Exit Code**: 0 (continues with defaults)

## Future Enhancements

### Streaming Support
- Real-time agent response streaming
- Progress indicators for long operations
- Incremental JSON events

### Advanced UI
- Syntax highlighting in Ink UI
- Markdown rendering
- Interactive prompts and menus
- Split-pane layouts

### Additional Commands
- `wingman chat`: Conversational mode with history
- `wingman plan`: Planning-only mode
- `wingman review`: Code review mode
- `wingman config`: Configuration management

### Multi-Agent Support
- Invoke multiple agents in parallel
- Agent chaining (pipe output to next agent)
- Agent workflows (YAML-defined sequences)

### Remote Execution
- API server mode
- WebSocket support for real-time streaming
- HTTP endpoints for programmatic access
- Authentication and rate limiting

## References
- [AGENTS.md](../../AGENTS.md) - Main architecture documentation
- [Custom Agents Guide](../custom-agents.md) - Agent configuration
- [Ink Documentation](https://github.com/vadimdemedes/ink) - Terminal UI framework
- [PRD-001: Multi-Agent Architecture](./001-multi-agent-architecture.md)
- [PRD-002: Custom Agents Configuration](./002-custom-agents-configuration.md)

---

**Version**: 1.2.0
**Status**: Implemented
**Last Updated**: 2026-01-19
**Author**: Russell Canfield (rcanfield86@gmail.com)
