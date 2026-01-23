# Wingman Documentation

Welcome to the Wingman documentation. This directory contains product requirement documents (PRDs), architecture guides, and implementation plans.

---

## Product Roadmap

### ✅ Phase 1: Rich Tool Visualization (COMPLETED)
**Status:** Shipped
**Completion Date:** 2026-01-22

Enhanced CLI experience with type-specific tool visualization, status indicators, and professional styling using Ink components.

**Key Features:**
- Type-specific tool icons and colors (Read 📖, Write ✏️, Bash ⚙️, etc.)
- Real-time status indicators (running, complete, error)
- Bordered tool displays with execution duration
- Structured ContentBlock architecture
- Tool result truncation and display

**Documentation:**
- [Implementation Plan](/.claude/plans/fancy-munching-codd.md#phase-1-implementation-plan)

---

### 🚧 Phase 2: CLI REPL Mode (IN PLANNING)
**Status:** Planning
**Target:** Week of 2026-01-27

Multi-turn conversational interface with persistent sessions and slash command support.

**Key Features:**
- Multi-turn conversations in CLI
- Automatic session persistence
- Slash commands (/sessions, /resume, /show, /help, etc.)
- Command history (↑/↓ arrows)
- Rich UI maintained from Phase 1
- Graceful exit with session save

**Documentation:**
- [PRD: CLI REPL Mode](/docs/prd-cli-repl-mode.md)

---

### 📋 Phase 3: Gateway Agent Execution (PLANNED)
**Status:** Planned
**Target:** TBD

Remote agent execution through WebSocket gateway for web and mobile UIs.

**Key Features:**
- WebSocket-based agent invocation
- Real-time event streaming (JSON)
- Session sharing between CLI and gateway
- ClawdBot-inspired coordinator/node architecture
- Client libraries (JS/TS, Python, Swift)
- Reference web UI implementation

**Documentation:**
- [PRD: Gateway Agent Execution](/docs/prd-gateway-agent-execution.md)

---

## Architecture Documents

### Core Systems

#### OutputManager
**Purpose:** Event-driven output system supporting dual modes (interactive Ink UI and JSON streaming)

**Key Concepts:**
- EventEmitter-based architecture
- Mode switching: `interactive` vs `json`
- Event types: `agent-start`, `agent-stream`, `agent-complete`, `agent-error`, `log`
- JSON mode outputs line-delimited JSON (ndjson)

**Files:**
- [src/cli/core/outputManager.ts](../wingman/src/cli/core/outputManager.ts)

#### SessionManager
**Purpose:** SQLite-backed session persistence with LangGraph checkpointing

**Key Concepts:**
- Session metadata storage (id, agent, message count, timestamps)
- LangGraph checkpoint/write storage
- Thread-safe concurrent access (WAL mode)
- Session lifecycle (create, update, resume, archive)

**Files:**
- [src/cli/core/sessionManager.ts](../wingman/src/cli/core/sessionManager.ts)
- [src/cli/core/database/](../wingman/src/cli/core/database/)

#### StreamParser
**Purpose:** Parse LangGraph streaming chunks into structured events

**Key Concepts:**
- Extracts text, tool calls, and tool results from chunks
- Handles multiple chunk formats (middleware, model_request, agent)
- Prioritizes tool calls over text content
- Generates unique IDs for tool tracking

**Files:**
- [src/cli/core/streamParser.ts](../wingman/src/cli/core/streamParser.ts)

#### Gateway
**Purpose:** WebSocket message broker for node coordination

**Key Concepts:**
- Bun native WebSocket server
- Node registry with capabilities
- Message routing (broadcast, direct)
- Session metadata tracking

**Files:**
- [src/gateway/server.ts](../wingman/src/gateway/server.ts)
- [src/gateway/types.ts](../wingman/src/gateway/types.ts)

---

## Component Architecture

### CLI UI Components (Ink/React)

**ContentBlock System:**
```typescript
ContentBlock
├─ TextBlock (streaming text content)
├─ ToolCallBlock (tool invocation with status)
└─ ToolResultBlock (tool execution output)
```

**Component Hierarchy:**
```
App.tsx
├─ LogDisplay.tsx (debug logs)
├─ AgentOutput.tsx
│   ├─ ToolCallDisplay.tsx (tool invocation UI)
│   └─ ToolResultDisplay.tsx (tool result UI)
└─ ErrorDisplay.tsx (error messages)
```

**Files:**
- [src/cli/ui/App.tsx](../wingman/src/cli/ui/App.tsx)
- [src/cli/ui/AgentOutput.tsx](../wingman/src/cli/ui/AgentOutput.tsx)
- [src/cli/ui/components/](../wingman/src/cli/ui/components/)

---

## Data Flow Diagrams

### CLI Interactive Mode (Phase 1)
```
User CLI Command
  ↓
AgentInvoker
  ↓
OutputManager (interactive mode)
  ↓ (emits events)
App.tsx (Ink UI)
  ↓ (parses chunks)
StreamParser
  ↓ (creates blocks)
ContentBlock[]
  ↓ (renders)
AgentOutput → ToolCallDisplay / ToolResultDisplay
```

### Gateway Mode (Phase 3)
```
Web/Mobile Client
  ↓ (WebSocket)
Gateway Server
  ↓ (invoke-agent request)
AgentHandler
  ↓ (creates)
OutputManager (JSON mode)
  ↓ (emits events)
EventBridge
  ↓ (wraps in GatewayMessage)
Gateway Server
  ↓ (WebSocket)
Web/Mobile Client
  ↓ (renders UI)
```

---

## Development Guides

### Adding a New Tool Type

1. **Add tool style** to [ToolCallDisplay.tsx](../wingman/src/cli/ui/components/ToolCallDisplay.tsx):
   ```typescript
   const TOOL_STYLES = {
     your_tool: { icon: '🔧', color: 'blue', label: 'Your Tool' }
   };
   ```

2. **Test tool visualization**:
   ```bash
   wingman agent --agent your-agent "trigger your tool"
   ```

### Adding a Slash Command

1. **Add command** to [CommandHandler](../wingman/src/cli/core/commandHandler.ts):
   ```typescript
   async executeCommand(command: string): Promise<CommandResult> {
     if (command === '/your-command') {
       // Implementation
     }
   }
   ```

2. **Update help text** in CommandHandler

3. **Test in REPL** (Phase 2):
   ```bash
   wingman agent --agent researcher --repl
   > /your-command
   ```

---

## Testing

### Unit Tests
```bash
bun test
```

### Integration Tests
```bash
bun test:integration
```

### Manual Testing Scenarios

**Phase 1 (Rich UI):**
1. Tool visualization with multiple tools
2. Long tool outputs (truncation)
3. Tool errors (red borders, error messages)
4. Streaming text with tools interspersed

**Phase 2 (REPL):**
1. Multi-turn conversation (5+ turns)
2. Session resumption after exit
3. Slash commands (/sessions, /resume, /show)
4. Command history (↑/↓)

**Phase 3 (Gateway):**
1. Web client invoke agent
2. Event streaming to mobile client
3. Session sharing CLI ↔ Gateway
4. Concurrent agent executions (10+)

---

## Configuration

### CLI Configuration
**Location:** `.wingman/config.json`

```json
{
  "cli": {
    "richOutput": true,
    "theme": "modern",
    "verbosity": "info"
  }
}
```

### Gateway Configuration
**Location:** `.wingman/gateway.json`

```json
{
  "gateway": {
    "port": 3000,
    "host": "0.0.0.0",
    "maxConnections": 100
  }
}
```

---

## Troubleshooting

### Tool Visualization Not Appearing

**Symptom:** Tools are called but no bordered boxes appear

**Solutions:**
1. Check streamParser is detecting tool calls: Add debug logging
2. Verify Ink UI is rendering: Check `outputMode === 'interactive'`
3. Confirm ContentBlock creation: Check blockHelpers functions

### Session Not Persisting

**Symptom:** Session lost after CLI exit

**Solutions:**
1. Check SessionManager is initialized: `await sessionManager.initialize()`
2. Verify SQLite database exists: `ls .wingman/wingman.db`
3. Check WAL mode enabled: `sqlite3 .wingman/wingman.db 'PRAGMA journal_mode;'`

### Gateway Connection Drops

**Symptom:** WebSocket disconnects during agent execution

**Solutions:**
1. Implement reconnection logic in client
2. Check gateway logs for errors
3. Verify network stability
4. Increase WebSocket timeout

---

## Contributing

### Development Workflow

1. **Create feature branch**: `git checkout -b feature/your-feature`
2. **Make changes**: Implement feature with tests
3. **Run tests**: `bun test`
4. **Update docs**: Update PRDs, architecture docs
5. **Create PR**: Submit for review

### Code Style

- **TypeScript**: Strict mode enabled
- **React/Ink**: Functional components with hooks
- **Async**: Use async/await (not callbacks)
- **Error handling**: Try/catch with specific error types

---

## Resources

### Internal Links
- [Phase 1 Implementation Plan](/.claude/plans/fancy-munching-codd.md)
- [PRD: CLI REPL Mode](/docs/prd-cli-repl-mode.md)
- [PRD: Gateway Agent Execution](/docs/prd-gateway-agent-execution.md)

### External References
- [Ink Documentation](https://github.com/vadimdemedes/ink)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [Bun WebSocket API](https://bun.sh/docs/api/websockets)
- [ClawdBot Architecture](https://github.com/anthropics/clawdbot)

---

**Last Updated:** 2026-01-22
**Maintainers:** Wingman Team
