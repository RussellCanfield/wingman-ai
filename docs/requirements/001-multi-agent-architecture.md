# PRD-001: Multi-Agent Architecture

## Overview
Wingman implements a hierarchical multi-agent system using LangChain's deepagents framework. The system consists of a root orchestrator agent that coordinates specialized subagents, each optimized for specific task domains.

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

## Future Enhancements

### Phase 2
- Agent performance analytics
- Custom agent creation via UI
- Agent-specific conversation history
- Dynamic tool loading

### Phase 3
- Multi-modal subagents (image, audio)
- External agent integration (MCP protocol)
- Distributed agent execution
- Agent marketplace

### Phase 4
- Agent training/fine-tuning
- Cross-project learning
- Agent collaboration protocols
- Real-time streaming

## References
- [LangChain deepagents Documentation](https://docs.langchain.com/oss/javascript/deepagents)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraphjs/)
- [Custom Agents Configuration Guide](../custom-agents.md)
