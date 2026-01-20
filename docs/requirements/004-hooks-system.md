# Product Requirements Document: Hooks System

**Version:** 1.0
**Status:** Implemented
**Last Updated:** 2026-01-20
**Owner:** Wingman-AI Team

## Executive Summary

The Hooks System enables users to execute custom shell commands at specific lifecycle points during agent execution. This provides a powerful extension mechanism for integrating external tools, enforcing policies, and automating workflows without modifying the core agent codebase.

### Key Benefits
- **Extensibility**: Users can customize agent behavior without code changes
- **Integration**: Connect to external tools (linters, formatters, CI/CD)
- **Governance**: Enforce security policies and validation rules
- **Automation**: Automate repetitive post-processing tasks

### Success Metrics
- Adoption: % of users configuring at least one hook
- Use Cases: Diversity of hook implementations (formatting, testing, validation)
- Reliability: Hook execution success rate > 95%
- Performance: Hook execution adds < 5% overhead to agent runtime

## Problem Statement

### Current Limitations
1. **Manual Post-Processing**: Users must manually run formatters/linters after agent edits
2. **No Validation**: No mechanism to validate or block dangerous commands before execution
3. **Limited Integration**: Difficult to integrate with external tools and workflows
4. **Rigid Behavior**: Agent behavior cannot be customized without code changes

### User Pain Points
- "I have to remember to run prettier after every agent edit"
- "I wish I could block the agent from running dangerous commands"
- "I need to integrate with our CI/CD pipeline automatically"
- "I want to log all agent actions for compliance"

## Goals & Non-Goals

### Goals
- ✅ Enable users to execute custom commands at agent lifecycle points
- ✅ Support blocking (PreToolUse) and non-blocking (PostToolUse, Stop) execution
- ✅ Provide flexible pattern matching for tool filtering
- ✅ Follow Claude Code's hooks pattern for familiarity
- ✅ Support global and agent-specific configurations
- ✅ Maintain security through proper documentation and warnings

### Non-Goals
- ❌ Built-in library of common hooks (users create their own)
- ❌ Sandboxed execution environment (hooks run with user privileges)
- ❌ GUI for hook configuration (JSON-based only)
- ❌ Hook marketplace or sharing platform (v1)
- ❌ Cross-platform hook scripts (users handle portability)

## User Stories

### Epic 1: Code Quality Automation

**US-1.1: Auto-format After Edits**
> As a developer, I want files automatically formatted after the agent edits them, so that I don't have to manually run formatters.

**Acceptance Criteria:**
- Hook executes after `write_file` and `edit_file` tools
- Prettier/ESLint runs on modified files
- Formatting errors don't block agent execution
- Works with TypeScript, JavaScript, JSON files

**US-1.2: Lint Code Changes**
> As a developer, I want automatic linting of code changes, so that code quality standards are enforced.

**Acceptance Criteria:**
- Linter runs on all code files after modification
- Linting errors are logged but don't stop execution
- Supports multiple linters (ESLint, TSLint, Pylint)

### Epic 2: Security & Validation

**US-2.1: Block Dangerous Commands**
> As a security engineer, I want to prevent dangerous commands from executing, so that the agent cannot cause data loss.

**Acceptance Criteria:**
- Hook executes before `command_execute` tool
- Detects patterns like `rm -rf /`, `dd if=`, fork bombs
- Blocks execution and shows clear error message
- Configurable blocklist of dangerous commands

**US-2.2: Audit Tool Usage**
> As a compliance officer, I want to log all agent tool usage, so that I can maintain an audit trail.

**Acceptance Criteria:**
- Logs every tool execution with timestamp
- Includes session ID, tool name, and arguments
- Stores logs in secure, tamper-proof format
- Supports multiple log destinations

### Epic 3: Testing & CI/CD

**US-3.1: Run Tests After Changes**
> As a developer, I want tests to run automatically after the agent makes changes, so that I know if anything broke.

**Acceptance Criteria:**
- Executes test suite when agent completes
- Supports multiple test runners (Jest, Pytest, Go test)
- Non-blocking (doesn't fail agent if tests fail)
- Clear pass/fail reporting

**US-3.2: Trigger CI Pipeline**
> As a DevOps engineer, I want to trigger CI/CD pipelines after agent work, so that changes are automatically deployed.

**Acceptance Criteria:**
- Calls CI/CD webhook or API after agent completion
- Includes context about what changed
- Handles API failures gracefully
- Supports GitHub Actions, GitLab CI, Jenkins

### Epic 4: Configuration & Management

**US-4.1: Global Hooks**
> As a team lead, I want to configure hooks globally, so that all agents follow team standards.

**Acceptance Criteria:**
- Hooks defined in `.wingman/wingman.config.json`
- Apply to all agents unless overridden
- Can be committed to version control
- Easy to share across team

**US-4.2: Agent-Specific Hooks**
> As a developer, I want agent-specific hooks, so that different agents can have different behaviors.

**Acceptance Criteria:**
- Hooks defined in agent config JSON
- Override or supplement global hooks
- Allow specialization per agent type
- Merge with global hooks correctly

## Functional Requirements

### FR-1: Hook Events

| Event | Trigger Point | Blocking | Use Cases |
|-------|---------------|----------|-----------|
| PreToolUse | Before tool execution | Yes | Validation, authorization, blocking |
| PostToolUse | After tool completes | No | Formatting, linting, logging |
| Stop | Agent completion | No | Testing, reporting, cleanup |

### FR-2: Pattern Matching

**Requirement:** Support flexible tool name matching

**Patterns:**
- Exact match: `"write_file"`
- Pipe-separated: `"write_file|edit_file"`
- Wildcard: `"*"` or `""`
- Regex: `".*_file"`

**Constraints:**
- Case-sensitive matching
- Invalid regex falls back to exact match
- Empty matcher matches all tools

### FR-3: Hook Input

**Requirement:** Provide context data to hooks via JSON stdin

**Common Fields:**
```typescript
{
  session_id: string,      // Unique session identifier
  cwd: string,             // Current working directory
  hook_event_name: string  // Event that triggered hook
}
```

**Tool Fields (PreToolUse/PostToolUse):**
```typescript
{
  tool_name: string,                     // Name of the tool
  tool_use_id: string,                   // Unique tool call ID
  tool_input: Record<string, unknown>,   // Tool arguments
  tool_output?: unknown                  // Output (PostToolUse only)
}
```

### FR-4: Exit Code Handling

| Exit Code | Meaning | PreToolUse | PostToolUse/Stop |
|-----------|---------|------------|------------------|
| 0 | Success | Allow tool | Continue |
| 2 | Blocking error | Block tool | Log error, continue |
| Other | Non-blocking error | Log error, allow | Log error, continue |

### FR-5: Configuration Schema

**Global Configuration** (`.wingman/wingman.config.json`):
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "string",
        "hooks": [
          {
            "type": "command",
            "command": "string",
            "timeout": number
          }
        ]
      }
    ],
    "PostToolUse": [...],
    "Stop": [
      {
        "hooks": [...]
      }
    ]
  }
}
```

**Agent Configuration** (`.wingman/agents/{name}/agent.json`):
```json
{
  "name": "agent-name",
  "hooks": {
    // Same structure as global
  }
}
```

### FR-6: Hook Merging

**Requirement:** Merge global and agent-specific hooks

**Behavior:**
- Concatenate hooks from both sources
- No deduplication (same hook can run twice)
- Global hooks execute first, then agent hooks
- Independent execution (one failure doesn't affect others)

### FR-7: Timeout Management

**Requirements:**
- Default timeout: 60 seconds
- Configurable per-hook
- Hard kill after timeout expires
- Log timeout events

**Constraints:**
- Minimum timeout: 1 second
- Maximum timeout: 600 seconds (10 minutes)
- Timeout applies to entire hook execution

### FR-8: Logging

**Requirements:**
- Debug: Pattern matching, hook discovery
- Info: Hook execution start/completion
- Warn: Non-blocking failures, timeouts
- Error: Blocking failures

**Log Fields:**
- Timestamp
- Hook event name
- Matcher pattern (if applicable)
- Command executed
- Exit code
- Execution duration
- Error messages (if any)

## Non-Functional Requirements

### NFR-1: Performance

**Requirements:**
- Hook execution adds < 5% overhead to agent runtime
- Non-blocking hooks execute asynchronously
- Pattern matching completes in < 1ms
- Hook configuration loading in < 10ms

**Testing:**
- Benchmark agent execution with/without hooks
- Measure hook discovery latency
- Profile pattern matching performance

### NFR-2: Security

**Requirements:**
- Clear documentation about security risks
- Examples of secure hook implementations
- Warnings about command injection
- Best practices for input validation

**Constraints:**
- No sandboxing (hooks run with user privileges)
- No built-in command filtering
- Users responsible for hook security
- Configuration files in version control

### NFR-3: Reliability

**Requirements:**
- Hook failures don't crash agent (except PreToolUse exit 2)
- Graceful handling of malformed JSON
- Timeout enforcement prevents runaway processes
- Comprehensive error messages

**Targets:**
- Hook execution success rate > 95%
- Zero agent crashes due to hooks
- All errors logged with context

### NFR-4: Usability

**Requirements:**
- Clear, comprehensive documentation
- Example hooks for common use cases
- Troubleshooting guide
- Error messages with actionable advice

**Documentation:**
- HOOKS.md with examples and best practices
- PRD for technical context
- Inline code comments
- Type definitions for IDE support

### NFR-5: Maintainability

**Requirements:**
- Modular architecture (executor, matcher, builder)
- Comprehensive TypeScript types
- Zod validation for configuration
- Unit tests for core logic

**Code Quality:**
- TypeScript strict mode
- ESLint/Prettier compliant
- < 200 lines per file
- Clear separation of concerns

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      AgentInvoker                           │
│  - Load global config                                       │
│  - Load agent config                                        │
│  - Merge hooks                                              │
│  - Create middleware                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  HooksMiddleware                            │
│  - Implements AgentMiddleware interface                    │
│  - wrapToolCall: PreToolUse + PostToolUse                  │
│  - afterAgent: Stop hooks                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   HookExecutor                              │
│  - executeHooksForEvent()                                   │
│  - executeStopHooks()                                       │
│  - executeHook() - single hook execution                    │
│  - runCommand() - spawn with stdin                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌─────────────┐ ┌──────────────┐
│   Matcher    │ │InputBuilder │ │   Merger     │
│  - Pattern   │ │  - Build    │ │  - Merge     │
│    matching  │ │    JSON     │ │    configs   │
└──────────────┘ └─────────────┘ └──────────────┘
```

### Data Flow

**PreToolUse Flow:**
```
1. Tool requested
2. HooksMiddleware.wrapToolCall() called
3. Build context (session, tool info)
4. Find matching hooks via Matcher
5. For each hook:
   a. Build JSON input via InputBuilder
   b. Execute via HookExecutor
   c. Check exit code
   d. If exit=2, throw error (block tool)
6. If no blocks, execute tool
```

**PostToolUse Flow:**
```
1. Tool completed
2. HooksMiddleware.wrapToolCall() returns result
3. Build context (includes tool output)
4. Find matching hooks via Matcher
5. For each hook (async):
   a. Build JSON input via InputBuilder
   b. Execute via HookExecutor
   c. Log errors but continue
6. Return tool result
```

**Stop Flow:**
```
1. Agent completes
2. HooksMiddleware.afterAgent() called
3. Build context (session only)
4. For each Stop hook (async):
   a. Build JSON input
   b. Execute hook
   c. Log errors but continue
5. Return undefined
```

### File Structure

```
wingman/
├── src/
│   ├── types/
│   │   └── hooks.ts                    # Shared types
│   ├── agent/
│   │   ├── middleware/
│   │   │   ├── hooks.ts                # Main middleware
│   │   │   └── hooks/
│   │   │       ├── types.ts            # Internal types + Zod
│   │   │       ├── executor.ts         # Execution engine
│   │   │       ├── matcher.ts          # Pattern matching
│   │   │       ├── input-builder.ts    # JSON builder
│   │   │       └── merger.ts           # Config merging
│   │   └── config/
│   │       └── agentConfig.ts          # Add hooks field
│   └── cli/
│       ├── config/
│       │   └── schema.ts               # Add hooks field
│       └── core/
│           └── agentInvoker.ts         # Register middleware
├── docs/
│   └── prd/
│       └── hooks-system.md             # This document
└── HOOKS.md                             # User documentation
```

### Dependencies

**New Dependencies:**
- `uuid` - Session ID generation

**Existing Dependencies:**
- `zod` - Configuration validation
- `langchain` - Middleware interface
- `node:child_process` - Command execution

## Testing Strategy

### Unit Tests

**Matcher Tests:**
- Exact match
- Pipe-separated match
- Wildcard match
- Regex match
- Invalid regex fallback

**Input Builder Tests:**
- PreToolUse input structure
- PostToolUse input structure
- Stop input structure
- Missing fields handling

**Executor Tests:**
- Successful execution (exit 0)
- Blocking error (exit 2)
- Non-blocking error (exit 1)
- Timeout handling
- Multiple hooks execution
- Async execution

**Merger Tests:**
- Merge global + agent hooks
- Global only
- Agent only
- Neither has hooks

### Integration Tests

**Test Scenarios:**

1. **PostToolUse Hook - Format Code**
   - Create hook that runs prettier
   - Agent writes TypeScript file
   - Verify file is formatted

2. **PreToolUse Hook - Block Command**
   - Create hook that blocks `rm -rf`
   - Agent attempts dangerous command
   - Verify command blocked

3. **Stop Hook - Run Tests**
   - Create hook that runs test suite
   - Agent completes work
   - Verify tests executed

4. **Pattern Matching**
   - Hooks with different matchers
   - Verify correct hooks execute
   - Verify non-matching hooks skip

5. **Timeout Handling**
   - Create slow hook (sleep 100)
   - Set timeout to 5 seconds
   - Verify hook killed after timeout

### Manual Testing

**Test Cases:**

1. **Basic Functionality**
   - Configure simple PostToolUse hook
   - Run agent that writes file
   - Verify hook executes and logs output

2. **Error Handling**
   - Create hook that exits with 2
   - Verify tool blocked
   - Verify error message shown

3. **Multiple Hooks**
   - Configure 3 hooks for same event
   - Verify all execute in order
   - Verify independent failures

4. **Global + Agent Hooks**
   - Configure global hook
   - Configure agent hook
   - Verify both execute

## Migration & Rollout

### Phase 1: Internal Testing (Week 1)
- Core team tests hooks system
- Validate common use cases
- Identify edge cases

### Phase 2: Beta Release (Week 2-3)
- Release to select beta users
- Gather feedback on usability
- Monitor for issues

### Phase 3: Documentation (Week 4)
- Finalize HOOKS.md
- Create example hooks repository
- Record demo video

### Phase 4: General Availability (Week 5)
- Announce hooks system
- Publish blog post
- Update main README

### Rollback Plan
- Hooks are opt-in (no risk if unused)
- Can disable by removing config
- No data migration required

## Risks & Mitigations

### Risk 1: Security Vulnerabilities
**Impact:** High
**Probability:** Medium

**Description:** Users may create insecure hooks vulnerable to command injection

**Mitigation:**
- Comprehensive security documentation
- Examples of secure implementations
- Warnings about command injection
- Best practices guide

### Risk 2: Performance Degradation
**Impact:** Medium
**Probability:** Low

**Description:** Hooks may slow down agent execution

**Mitigation:**
- Async execution for non-blocking hooks
- Timeout enforcement
- Performance benchmarking
- Optimization guidance

### Risk 3: User Confusion
**Impact:** Medium
**Probability:** Medium

**Description:** Users may struggle to configure hooks correctly

**Mitigation:**
- Clear documentation with examples
- Troubleshooting guide
- Example hooks for common cases
- Helpful error messages

### Risk 4: Breaking Changes
**Impact:** Low
**Probability:** Low

**Description:** Future changes might break existing hooks

**Mitigation:**
- Stable JSON input format
- Version hooks system (future)
- Document breaking changes clearly
- Provide migration guides

## Success Criteria

### Launch Criteria
- ✅ All functional requirements implemented
- ✅ Unit tests with >80% coverage
- ✅ Integration tests passing
- ✅ Documentation complete
- ✅ Code review approved
- ✅ Performance benchmarks acceptable

### Post-Launch Metrics

**Week 1:**
- 0 critical bugs
- At least 5 users configure hooks
- Positive feedback on usability

**Month 1:**
- 20% of active users using hooks
- Hook execution success rate >95%
- Average hook execution time <2s

**Quarter 1:**
- 40% of active users using hooks
- 5+ community-shared hook examples
- < 0.1% hooks causing agent failures

## Future Enhancements

### V2 Features (Planned)
- Prompt-type hooks (LLM-based decisions)
- Hook output to modify tool inputs
- SessionStart/SessionEnd hooks
- UserPromptSubmit hooks
- Environment variable persistence

### V3 Features (Possible)
- Hook marketplace/sharing platform
- GUI for hook configuration
- Built-in common hooks library
- Hook testing framework
- Sandboxed execution (Docker)

## Appendix

### A. Example Configurations

See [HOOKS.md](../HOOKS.md) for comprehensive examples.

### B. API Reference

**HooksConfig Type:**
```typescript
interface HooksConfig {
  PreToolUse?: HookMatcher[];
  PostToolUse?: HookMatcher[];
  Stop?: StopHook[];
}

interface HookMatcher {
  matcher?: string;
  hooks: Hook[];
}

interface Hook {
  type: "command";
  command: string;
  timeout?: number;
}

interface StopHook {
  hooks: Hook[];
}
```

**HookInput Type:**
```typescript
interface HookInput {
  session_id: string;
  cwd: string;
  hook_event_name: "PreToolUse" | "PostToolUse" | "Stop";
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_use_id?: string;
  tool_output?: unknown;
}
```

### C. References

- [Claude Code Hooks Documentation](https://code.claude.com/docs/en/hooks)
- [Deepagent Middleware API](https://docs.langchain.com/oss/javascript/deepagents/middleware)
- [User Documentation](../HOOKS.md)

### D. Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-20 | Initial release - PRD created after implementation |

---

**Document Owner:** Wingman-AI Team
**Reviewers:** TBD
**Status:** ✅ Implemented
