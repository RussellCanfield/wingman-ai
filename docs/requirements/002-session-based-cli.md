# PRD: Session-Based CLI for Wingman Agent Framework

## Overview

Transform the Wingman CLI from stateless agent invocations to a persistent session-based conversation system with SQLite storage and token-by-token streaming output. This enables users to have continuous, context-aware conversations with AI agents that resume seamlessly across CLI invocations.

## Problem Statement

Currently, the Wingman CLI is stateless - each invocation creates a fresh agent instance with no memory of previous interactions. Users cannot:
- Resume conversations from where they left off
- Build context over multiple interactions
- Review conversation history
- Switch between different ongoing tasks

This limits the CLI's usefulness for complex, multi-step workflows that span multiple terminal sessions.

## Goals

### Primary Goals
1. **Persistent Conversations**: Enable session persistence across CLI invocations
2. **Seamless UX**: Sessions work invisibly in the background with auto-resume
3. **Streaming Output**: Implement token-by-token streaming for responsive feedback
4. **Session Management**: Provide commands to manage multiple sessions

### Non-Goals (Deferred)
- Conversation branching at arbitrary checkpoints
- Multi-user session sharing
- Cloud sync of sessions
- Session export/import

## Success Metrics

- Session persistence works reliably (99.9% success rate)
- Auto-resume reduces friction (users don't need to manually specify sessions)
- Streaming improves perceived responsiveness
- Zero data loss on crashes/errors
- Performance acceptable with 100+ sessions in database

## User Stories

### Story 1: Continuous Development Work
**As a developer**, I want to work on a coding task across multiple terminal sessions, so that I can continue where I left off without losing context.

**Acceptance Criteria:**
- Running `wingman agent --agent coder "add login"` creates a session
- Exiting and running `wingman agent --agent coder "add tests"` continues the same session
- Agent has access to full conversation history
- Session persists indefinitely until explicitly cleared

### Story 2: Multiple Parallel Tasks
**As a developer**, I want to manage multiple ongoing tasks simultaneously, so that I can context-switch without losing progress.

**Acceptance Criteria:**
- Can create separate sessions for different tasks
- Can list all active sessions with metadata
- Can resume specific sessions by ID
- Sessions don't interfere with each other

### Story 3: Real-Time Feedback
**As a user**, I want to see agent responses as they're generated, so that I get faster feedback on long-running tasks.

**Acceptance Criteria:**
- Responses stream token-by-token
- Tool executions are visible in real-time
- No perceived delay compared to stateless mode
- Streaming works with session persistence

## Technical Design

### Architecture

#### Database Schema

**SQLite Database**: `.wingman/wingman.db`

Uses official `@langchain/langgraph-checkpoint-sqlite` package which creates:
- `checkpoints` table - LangGraph conversation state
- `checkpoint_writes` table - Pending operations

Custom `sessions` table for UI metadata:
```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,                    -- UUID (maps to thread_id)
    name TEXT NOT NULL,                     -- User-friendly name
    agent_name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',  -- active/archived/deleted
    message_count INTEGER DEFAULT 0,
    last_message_preview TEXT,              -- First 200 chars
    metadata TEXT                           -- JSON for extensions
);

CREATE INDEX idx_sessions_updated ON sessions(updated_at DESC);
CREATE INDEX idx_sessions_agent ON sessions(agent_name);
```

#### Core Components

**SessionManager** ([src/cli/core/sessionManager.ts](../../wingman/src/cli/core/sessionManager.ts)):
- Wraps `SqliteSaver` from `@langchain/langgraph-checkpoint-sqlite`
- Manages custom `sessions` table for metadata
- Provides CRUD operations: create, get, list, update, archive, delete
- Exposes checkpointer for DeepAgent integration

**AgentInvoker** ([src/cli/core/agentInvoker.ts](../../wingman/src/cli/core/agentInvoker.ts)):
- Accepts optional `SessionManager` parameter
- Uses `agent.stream()` instead of `invoke()` when session available
- Passes `thread_id` to link checkpoints with sessions
- Falls back to stateless mode if no session manager

**OutputManager** ([src/cli/core/outputManager.ts](../../wingman/src/cli/core/outputManager.ts)):
- `emitAgentStream(chunk: any)` forwards raw stream chunks
- Generic architecture - clients interpret chunks for presentation
- No tool-specific event methods (keep core simple)

### User Experience Flow

#### Default Behavior (Invisible Sessions)

```bash
# First invocation - creates new session
$ wingman agent --agent coder "implement login"
[streaming response...]

# Second invocation - auto-resumes session
$ wingman agent --agent coder "add tests"
[agent has full context from previous message]
```

#### Interactive Mode (Future Phase)

```bash
$ wingman
> /sessions           # List recent sessions
> /resume <id>        # Resume specific session
> /clear              # Start fresh session
> /help               # Show commands
> your prompt here    # Continue current session
```

### Session Lifecycle

1. **Creation**: Automatically on first invocation for an agent
2. **Auto-Resume**: Last active session for agent resumes by default
3. **Persistence**: Stored indefinitely in `.wingman/wingman.db`
4. **Cleanup**: Manual via `/archive` or `/delete` commands (future)

### Streaming Architecture

**Generic Core**:
- Core emits raw chunks: `{ type: 'agent-stream', chunk: any }`
- No tool-specific events (emitToolCall, emitToolResult)
- Clients parse chunks for their presentation needs

**Client Interpretation**:
- CLI (Ink UI): Parse chunks to extract text deltas, tool calls
- Mobile app: Different parsing for mobile UI
- JSON mode: Forward raw chunks unchanged

**Benefits**:
- Core stays simple and maintainable
- Easy to add new clients (mobile, web)
- Full flexibility for client presentation

### Gateway Integration (Phase 5)

**Session-Aware Gateway**:
- Nodes register with optional `sessionId`
- Message routing can filter by session
- Multi-agent workflows maintain session context
- Gateway stats show active sessions

**Use Case**: Multi-agent collaboration (coder + researcher) working on the same task within a shared session context.

## Dependencies

### New Packages
- `@langchain/langgraph-checkpoint-sqlite@^1.0.0` - Official LangGraph SQLite checkpointer
- `@types/better-sqlite3@^7.6.13` - TypeScript types (dev dependency)

### Existing Packages (No Changes)
- `deepagents@^1.5.0` - Already supports checkpointing
- `better-sqlite3` - Transitive dependency via langgraph-checkpoint-sqlite
- `ink@^5.2.1` - UI framework

## Implementation Phases

### ✅ Phase 1-2: Foundation (Complete)
- [x] Install dependencies
- [x] Create SessionManager
- [x] Integrate with AgentInvoker
- [x] Update agent command for auto-resume
- [x] Implement streaming support
- [x] Build passes

### Phase 3: Interactive Commands (Next)
- [ ] CommandHandler for `/sessions`, `/resume`, `/clear`
- [ ] SessionListDisplay UI component
- [ ] Update CLI parsing for interactive mode

### Phase 4: Enhanced UI
- [ ] Parse stream chunks for text extraction
- [ ] ToolCallDisplay component (optional)
- [ ] Session info header

### Phase 5: Gateway Integration
- [ ] Extend gateway types with sessionId
- [ ] Update node registration
- [ ] Multi-agent session workflows

### Phase 6: Testing & Polish
- [ ] Integration tests
- [ ] Error handling
- [ ] Performance optimization
- [ ] Documentation

## Testing Strategy

### Unit Tests
- SessionManager CRUD operations
- Session auto-resume logic
- Stream event handling
- Database schema creation

### Integration Tests
- End-to-end conversation flow
- Session persistence across invocations
- Streaming with checkpoints
- Multiple concurrent sessions

### Manual Testing
```bash
# Test 1: Basic session creation and resume
wingman agent --agent coder "implement login"
wingman agent --agent coder "add tests"  # Should resume

# Test 2: Multiple agents (separate sessions)
wingman agent --agent coder "fix bug"
wingman agent --agent researcher "research auth"  # Different session

# Test 3: Database verification
sqlite3 .wingman/wingman.db "SELECT * FROM sessions;"
sqlite3 .wingman/wingman.db "SELECT COUNT(*) FROM checkpoints;"
```

## Migration & Backwards Compatibility

### First-Time Users
- Database created automatically on first run
- Seamless experience - no configuration needed
- Sessions work invisibly

### Existing Users
- No breaking changes to agent configs
- Database created alongside existing `.wingman/` files
- Stateless mode still works if session manager not initialized
- Gradual rollout possible

### Configuration
Optional config in `.wingman/wingman.config.json` (future):
```json
{
  "sessions": {
    "autoResume": true,
    "maxRecentSessions": 10,
    "cleanupAfterDays": 30
  }
}
```

## Security & Privacy

- Sessions stored locally in `.wingman/wingman.db`
- No cloud sync or external transmission
- User controls all session data
- Can delete sessions anytime
- Database file is user-readable SQLite

## Performance Considerations

- Database size: ~1-5MB per 100-message session
- Query performance: Indexed by updated_at, agent_name
- Memory: Single active SessionManager per CLI invocation
- Cleanup: Manual for now, automatic in future (30-day TTL)

## Open Questions & Future Work

### Future Enhancements
1. **Conversation Branching**: Fork sessions at specific checkpoints
2. **Session Export**: Share sessions or move between machines
3. **Advanced Search**: Full-text search across session history
4. **Auto-cleanup**: Automatically archive old sessions
5. **Session Tags**: Categorize sessions by project/task

### Known Limitations
- No collaborative sessions (multi-user)
- No session sync across machines
- Raw chunk display (needs parsing for pretty output)
- No checkpoint selection UI (deferred branching)

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Database corruption | Regular backups, SQLite WAL mode, recovery tool |
| Performance with large history | Summarization via deepagents, checkpoint pruning |
| Breaking changes in LangGraph | Use official package, version pinning |
| User confusion about sessions | Clear documentation, `/help` command |

## Documentation Requirements

1. **User Guide**: How sessions work, commands, examples
2. **API Docs**: SessionManager public interface
3. **Migration Guide**: For users upgrading from stateless
4. **Architecture Docs**: Design decisions, data flow diagrams

## Approval & Sign-off

**Status**: Implementation in progress (Phase 1-2 complete)

**Next Steps**:
1. Fix any failing tests
2. Manual testing of basic flow
3. Proceed to Phase 3 (Interactive Commands)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-21
**Author**: Implementation Team
**Status**: In Progress
