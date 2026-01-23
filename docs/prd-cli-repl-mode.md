# PRD: CLI REPL Mode

**Status:** Planning
**Priority:** P0 (High Priority)
**Target Release:** Phase 2
**Owner:** Wingman CLI Team
**Last Updated:** 2026-01-22

---

## Executive Summary

Enable multi-turn conversational interactions with Wingman agents directly in the CLI through a Read-Eval-Print Loop (REPL) mode. This allows users to maintain persistent chat sessions with full context preservation across multiple prompts, slash command support, and rich terminal UI visualization.

---

## Problem Statement

### Current Limitations
- **Single-turn only**: Current CLI executes one prompt and exits
- **No conversation continuity**: Each invocation loses previous context
- **Manual session management**: Users must manually specify `--session-id` to resume
- **No interactive commands**: Slash commands (`/sessions`, `/resume`, `/help`) only work via direct CLI flags

### User Pain Points
1. Tedious workflow for iterative tasks (debugging, exploration, refinement)
2. Loss of context requires repeating information
3. No visibility into active sessions without separate commands
4. Friction in switching between different agents mid-conversation

---

## Goals and Non-Goals

### Goals
✅ Enable multi-turn conversations within a single CLI session
✅ Automatic session persistence across turns
✅ Support all existing slash commands (`/sessions`, `/resume`, `/show`, `/help`, `/archive`, `/clear`)
✅ Maintain rich tool visualization (Phase 1 UI enhancements)
✅ Preserve conversation history on screen (scrollable)
✅ Graceful exit with session save
✅ Seamless integration with existing SessionManager and OutputManager

### Non-Goals
❌ Web-based UI (covered by Gateway mode)
❌ Multi-user collaboration (future enhancement)
❌ Voice input/output
❌ File upload/download (use existing tools)
❌ Custom keybindings (use terminal defaults)

---

## User Experience

### Entry Points

#### 1. New REPL Session
```bash
wingman agent --agent researcher --repl
```
Creates new session and enters REPL mode.

#### 2. Resume Existing Session
```bash
wingman agent --agent researcher --repl --session-id abc123
```
Resumes session `abc123` in REPL mode.

#### 3. Resume Last Session (Auto-detect)
```bash
wingman agent --agent researcher --repl
```
If last session for `researcher` agent exists, prompt user:
```
Last session: abc123 (5 messages, 2 minutes ago)
Resume? [Y/n]: _
```

### REPL Interface

```
╔════════════════════════════════════════════════════════════════╗
║ Wingman REPL                                                   ║
║ Agent: researcher | Session: abc123 | 5 messages              ║
╚════════════════════════════════════════════════════════════════╝

Type your message or use slash commands. Type /help for commands.

You> What files are in src/?

[Rich tool visualization]
┌─ 📁 Finding: glob ─────────────────────────────────────────┐
│ ● Running...                                               │
│ Arguments:                                                 │
│   pattern: src/**/*                                        │
└────────────────────────────────────────────────────────────┘

┌─ Result (0.2s) ────────────────────────────────────────────┐
│ Found 127 files in src/                                    │
└────────────────────────────────────────────────────────────┘

Agent> The src/ directory contains 127 files organized into:
- cli/ (45 files) - Command-line interface components
- gateway/ (12 files) - WebSocket gateway server
- agents/ (30 files) - Agent definitions and tools
- core/ (25 files) - Core utilities and managers
- types/ (15 files) - TypeScript type definitions

You> /sessions

╔══════════════════════════════════════════════════════════════╗
║ Active Sessions                                              ║
╠══════════════════════════════════════════════════════════════╣
║ ● abc123: researcher (5 messages, just now)                 ║
║   def456: coder (12 messages, 1 hour ago)                   ║
║   ghi789: analyst (3 messages, 2 hours ago)                 ║
╚══════════════════════════════════════════════════════════════╝

You> Can you read package.json and tell me the version?

[Tool visualization for read operation...]

Agent> The current version in package.json is 0.2.0.

You> exit
Saving session abc123...
Session saved. Use 'wingman agent --agent researcher --repl' to resume.
```

### Slash Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/help` | Show available commands | `/help` |
| `/sessions` | List all active sessions | `/sessions` |
| `/resume <id>` | Switch to different session | `/resume def456` |
| `/show` | Show current session details | `/show` |
| `/clear` | Clear current session history | `/clear` |
| `/archive` | Archive current session | `/archive` |
| `/exit` or `exit` | Exit REPL (saves session) | `exit` |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `↑` / `↓` | Navigate command history |
| `Ctrl+C` | Cancel current input (or exit if empty) |
| `Ctrl+D` | Exit REPL (saves session) |
| `Ctrl+L` | Clear screen (keeps session) |

---

## Technical Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         REPL Runner                         │
│  - Input loop (readline/prompts)                           │
│  - Command routing                                          │
│  - Session lifecycle management                            │
└────────────┬────────────────────────────┬──────────────────┘
             │                            │
    ┌────────▼────────┐          ┌────────▼──────────┐
    │ CommandHandler  │          │  AgentInvoker     │
    │ - Slash commands│          │  - Agent execution│
    │ - Session ops   │          │  - OutputManager  │
    └─────────────────┘          └───────────────────┘
             │                            │
    ┌────────▼────────────────────────────▼──────────────────┐
    │                   SessionManager                        │
    │  - SQLite persistence                                   │
    │  - LangGraph checkpointing                             │
    │  - Session metadata                                     │
    └─────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Input
  ↓
Check if slash command?
  ├─ YES → CommandHandler
  │         ↓
  │    Execute command (list sessions, resume, etc.)
  │         ↓
  │    Display result (Ink component or table)
  │         ↓
  │    Prompt again
  │
  └─ NO  → AgentInvoker
            ↓
       Invoke agent with prompt
            ↓
       OutputManager emits events
            ↓
       Ink components render (ToolCallDisplay, etc.)
            ↓
       SessionManager saves state
            ↓
       Prompt again
```

### State Management

```typescript
interface REPLState {
  sessionId: string;           // Current session ID
  agentName: string;          // Current agent
  messageCount: number;       // Number of messages in session
  isActive: boolean;          // REPL running?
  commandHistory: string[];   // Input history for ↑/↓
  lastActivity: Date;         // Last message timestamp
}
```

### Session Persistence

- **Auto-save**: After each turn (prompt → response)
- **Checkpoint**: LangGraph state preserved via SessionManager
- **History**: All messages stored in SQLite
- **Metadata**: Session name, agent, message count, timestamps

---

## Implementation Plan

### Phase 2.1: Core REPL Loop (Week 1)

**New Files:**
- `wingman/src/cli/repl/replRunner.ts` - Main REPL loop
- `wingman/src/cli/repl/inputHandler.ts` - Input processing and validation
- `wingman/src/cli/repl/ReplPrompt.tsx` - Input prompt component (Ink)

**Modified Files:**
- `wingman/src/cli/index.ts` - Add `--repl` flag parsing
- `wingman/src/cli/commands/agent.ts` - Add REPL mode support

**Tasks:**
1. Install `@inquirer/prompts` for input handling
2. Create basic REPL loop with input/output
3. Integrate with SessionManager for persistence
4. Add graceful exit handling (Ctrl+C, Ctrl+D, `exit`)

### Phase 2.2: Slash Commands (Week 1)

**Modified Files:**
- `wingman/src/cli/core/commandHandler.ts` - Add REPL-compatible command execution

**New Files:**
- `wingman/src/cli/repl/CommandResultDisplay.tsx` - Slash command result rendering

**Tasks:**
1. Route slash commands to CommandHandler
2. Create Ink components for command results (tables, lists)
3. Handle session switching (`/resume`)
4. Handle session operations (`/clear`, `/archive`)

### Phase 2.3: UI Integration (Week 2)

**Modified Files:**
- `wingman/src/cli/ui/App.tsx` - Support REPL mode (don't unmount between turns)
- `wingman/src/cli/ui/AgentOutput.tsx` - Support conversation history view

**New Files:**
- `wingman/src/cli/repl/SessionHeader.tsx` - Session info display
- `wingman/src/cli/repl/HistoryView.tsx` - Conversation history component

**Tasks:**
1. Modify App.tsx to support persistent rendering in REPL
2. Add session header with agent name, session ID, message count
3. Keep previous turns visible (scrollable)
4. Add visual separator between turns

### Phase 2.4: Polish & Testing (Week 2)

**Tasks:**
1. Command history (↑/↓ arrows)
2. Auto-complete for slash commands
3. Multi-line input support (Shift+Enter)
4. Error recovery (network failures, agent errors)
5. Performance testing (long sessions, many tools)
6. Documentation updates

---

## Dependencies

### New Dependencies
```json
{
  "@inquirer/prompts": "^7.0.0"
}
```

### Existing Dependencies (Reused)
- `ink` (v5.2.1) - Terminal UI
- `react` (v18.3.1) - Component model
- `ink-spinner` (v5.0.0) - Loading indicators
- `ink-box` (v2.0.0) - Bordered containers

---

## Testing Strategy

### Manual Testing Scenarios

1. **Basic REPL Flow**
   - Start REPL: `wingman agent --agent researcher --repl`
   - Send 3+ messages in sequence
   - Verify session persists across turns
   - Exit and verify session saved

2. **Session Resumption**
   - Create session in REPL
   - Exit REPL
   - Resume with `--session-id`
   - Verify conversation history preserved

3. **Slash Commands**
   - `/sessions` - list active sessions
   - `/show` - display current session details
   - `/resume <id>` - switch to different session
   - `/help` - show command help
   - `/clear` - clear session (confirm prompt)

4. **Rich UI in REPL**
   - Send prompt that triggers multiple tools
   - Verify ToolCallDisplay boxes appear
   - Verify ToolResultDisplay shows results
   - Verify status indicators update (running → complete)

5. **Error Handling**
   - Invalid slash command
   - Network failure during agent call
   - Tool execution error
   - Session database corruption

6. **Performance**
   - Long session (50+ messages)
   - Many tools in single turn (10+ tools)
   - Large tool outputs (100KB+ results)

### Automated Tests

```typescript
describe('REPL Mode', () => {
  test('creates new session on first prompt', async () => {
    // Test implementation
  });

  test('persists session across multiple turns', async () => {
    // Test implementation
  });

  test('handles slash commands correctly', async () => {
    // Test implementation
  });

  test('gracefully exits with Ctrl+C', async () => {
    // Test implementation
  });

  test('resumes existing session', async () => {
    // Test implementation
  });
});
```

---

## Success Metrics

### Qualitative
✅ Users can have natural multi-turn conversations with agents
✅ Slash commands work seamlessly within REPL
✅ Rich tool visualization maintained from Phase 1
✅ Session management is transparent (auto-save)
✅ Exit/resume workflow is intuitive

### Quantitative
- **Session continuity**: 100% of turns preserve context
- **Command success rate**: 99%+ for slash commands
- **Performance**: <100ms for prompt rendering
- **Reliability**: 99.9%+ uptime for REPL loop

---

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Input library compatibility issues | High | Low | Use well-maintained `@inquirer/prompts` |
| Session database corruption | High | Low | Add integrity checks, backups |
| Memory leaks in long sessions | Medium | Medium | Profile memory usage, clear old state |
| Poor UX with many tools | Medium | Medium | Add pagination, collapsing |
| Conflicts with terminal shortcuts | Low | Medium | Document conflicts, allow customization |

---

## Future Enhancements

### Post-MVP Features
- **Agent switching**: `/agent <name>` to switch agents mid-REPL
- **Multi-line editing**: Better support for long prompts
- **Search history**: `/search <term>` to find previous messages
- **Export conversations**: `/export <format>` to save as markdown/JSON
- **Voice input**: Optional voice-to-text integration
- **Syntax highlighting**: For code snippets in responses
- **Custom themes**: User-configurable color schemes

---

## Related Documents

- [Phase 1: Rich Tool Visualization](/.claude/plans/fancy-munching-codd.md) - Completed
- [PRD: Gateway Agent Execution](/docs/prd-gateway-agent-execution.md) - Planned
- [Architecture: SessionManager](/docs/architecture-session-manager.md) - Reference
- [Architecture: OutputManager](/docs/architecture-output-manager.md) - Reference

---

## Appendix

### Example REPL Session Transcript

```
$ wingman agent --agent coder --repl

╔════════════════════════════════════════════════════════════════╗
║ Wingman REPL                                                   ║
║ Agent: coder | Session: 3f8a9b2c | 0 messages                 ║
╚════════════════════════════════════════════════════════════════╝

You> Create a function to calculate fibonacci numbers

┌─ 📝 Writing: write ─────────────────────────────────────────┐
│ ✓ Complete (0.1s)                                           │
│ Arguments:                                                  │
│   file_path: src/utils/fibonacci.ts                        │
└─────────────────────────────────────────────────────────────┘

Agent> I've created a fibonacci function in src/utils/fibonacci.ts.
The function uses memoization for efficient calculation.

You> Can you add tests for it?

┌─ 📝 Writing: write ─────────────────────────────────────────┐
│ ✓ Complete (0.2s)                                           │
│ Arguments:                                                  │
│   file_path: src/utils/fibonacci.test.ts                   │
└─────────────────────────────────────────────────────────────┘

Agent> I've added comprehensive tests covering edge cases and
performance characteristics.

You> /show

╔══════════════════════════════════════════════════════════════╗
║ Session Details                                              ║
╠══════════════════════════════════════════════════════════════╣
║ ID: 3f8a9b2c-1234-5678-90ab-cdef12345678                    ║
║ Agent: coder                                                 ║
║ Messages: 4 (2 user, 2 agent)                               ║
║ Created: 2026-01-22 14:30:15                                ║
║ Last Activity: 2026-01-22 14:32:47                          ║
║ Tools Used: 2 (write x2)                                    ║
╚══════════════════════════════════════════════════════════════╝

You> exit
Saving session 3f8a9b2c...
✓ Session saved
```

---

**Document Version:** 1.0
**Status:** Draft
**Next Review:** After Phase 2.1 implementation
