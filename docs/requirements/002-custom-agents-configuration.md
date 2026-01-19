# PRD-002: Custom Agents Configuration System

## Overview
Enable users to define custom subagents through declarative configuration files without modifying code. Users can specify agent behavior, tools, models, and safety constraints to create specialized agents tailored to their workflows.

## Problem Statement
The built-in subagents cover general use cases, but users often need:
- Domain-specific agents (data analysis, security research, documentation)
- Company-specific workflows and conventions
- Custom tool combinations for specialized tasks
- Per-agent model selection based on complexity/cost tradeoffs
- Custom safety constraints for different execution contexts

Current limitations:
- Adding new agents requires code changes
- No way to customize agent behavior without forking
- Tool and model configuration is global
- Safety settings apply uniformly to all agents

## Goals
1. Enable users to create custom agents via configuration files
2. Support both single-file and directory-based configuration
3. Allow per-agent tool selection from available tools
4. Support per-agent model overrides
5. Provide granular safety controls (blocked commands, script execution)
6. Maintain backward compatibility with existing agents
7. Validate configurations with helpful error messages

## Non-Goals
- Supporting custom tool implementations (only built-in tools)
- Creating agents dynamically at runtime via API
- Hot-reloading of agent configurations
- Agent versioning or migration tools
- UI for agent configuration (CLI/file-based only)

## User Stories

### Story 1: Data Analyst
**As a** data scientist
**I want** a custom agent with command_execute and think tools
**So that** I can analyze datasets using Python without giving it web access

**Acceptance Criteria**:
- Agent can execute Python scripts
- Agent cannot access internet_search or web_crawler
- Agent uses more powerful model (Opus) for complex reasoning
- Destructive commands (rm, mv) are blocked

### Story 2: Security Researcher
**As a** security engineer
**I want** a research-focused agent without command execution
**So that** I can safely research vulnerabilities without accidentally running code

**Acceptance Criteria**:
- Agent has internet_search and web_crawler
- Agent cannot execute any commands
- Agent uses cost-effective model (Sonnet) for research

### Story 3: Documentation Writer
**As a** technical writer
**I want** an agent specialized in creating documentation
**So that** I can generate consistent, high-quality docs

**Acceptance Criteria**:
- Agent can crawl documentation sites
- Agent can reason about content structure (think tool)
- Agent follows company documentation standards
- Agent uses appropriate model for writing tasks

## Configuration Schema

### File Locations

#### Option 1: Single Configuration File
**Path**: `.wingman/agents.config.json`

**Structure**:
```json
{
  "agents": [
    { /* agent 1 */ },
    { /* agent 2 */ }
  ]
}
```

**Pros**:
- Single source of truth
- Easy to share entire configuration
- Simpler to version control

**Cons**:
- Large file for many agents
- Merge conflicts in team settings

#### Option 2: Directory of Agent Files
**Path**: `.wingman/agents/*.json`

**Structure**:
```
.wingman/agents/
  data-analyst.json
  security-researcher.json
  doc-writer.json
```

**Pros**:
- Modular organization
- Easier team collaboration
- Individual agent sharing

**Cons**:
- Multiple files to manage
- Less obvious configuration location

**Decision**: Support both, prioritize single file if both exist

### Agent Configuration Schema

```typescript
{
  // REQUIRED FIELDS
  name: string;                    // Unique identifier (lowercase-hyphenated)
  description: string;             // Action-oriented description for delegation
  systemPrompt: string;            // Detailed agent instructions

  // OPTIONAL FIELDS
  tools?: string[];                // Array of tool names
  model?: string;                  // Model override (format: "provider:model-name")
  blockedCommands?: string[];      // Commands to block for command_execute
  allowScriptExecution?: boolean;  // Enable/disable script execution (default: true)
  commandTimeout?: number;         // Timeout in milliseconds (default: 300000)
}
```

### Field Specifications

#### name (required)
**Type**: `string`
**Format**: Lowercase with hyphens (e.g., `"data-analyst"`)
**Purpose**: Unique identifier for agent delegation
**Validation**: Minimum 1 character, must be unique across agents
**Examples**: `"data-analyst"`, `"security-researcher"`, `"doc-writer"`

#### description (required)
**Type**: `string`
**Format**: Action-oriented sentence
**Purpose**: Help root agent decide when to delegate
**Validation**: Minimum 1 character
**Best Practices**:
- Start with action verb
- Be specific about capabilities
- Distinguish from similar agents
- Include domain expertise

**Examples**:
- ✅ "Analyzes data using Python, pandas, and creates visualizations"
- ❌ "Can analyze data"

#### systemPrompt (required)
**Type**: `string`
**Format**: Multi-line markdown text
**Purpose**: Detailed instructions defining agent behavior
**Validation**: Minimum 1 character
**Should Include**:
- Agent role and expertise
- Tool usage guidelines
- Output formatting requirements
- Reasoning strategies
- Example workflows

**Template**:
```markdown
You are a [role] expert with deep knowledge of [domain].

Your responsibilities:
- [Responsibility 1]
- [Responsibility 2]

When [condition]:
1. [Step 1]
2. [Step 2]

Always [behavior guideline].
```

#### tools (optional)
**Type**: `string[]`
**Available Tools**:
- `"internet_search"`: Web search (Tavily or DuckDuckGo)
- `"web_crawler"`: Multi-page web crawling
- `"command_execute"`: Shell command execution
- `"think"`: Reasoning without side effects

**Default**: Empty array (no tools)
**Validation**: All tool names must be in available tools enum
**Best Practice**: Keep minimal and focused

#### model (optional)
**Type**: `string`
**Format**: `"provider:model-name"`
**Supported Providers**:
- `anthropic`: Claude models
- `openai`: GPT models

**Examples**:
- `"anthropic:claude-opus-4-5"` - Most capable, expensive
- `"anthropic:claude-sonnet-4-5"` - Balanced, default
- `"openai:gpt-4o"` - OpenAI flagship
- `"openai:gpt-4-turbo"` - OpenAI fast

**Default**: System default model (typically Sonnet)
**Validation**: Format must be `provider:model`, provider must be supported

#### blockedCommands (optional)
**Type**: `string[]`
**Purpose**: Block specific commands for command_execute tool
**Applies To**: Only agents with `command_execute` tool
**Default**: System defaults (rm, mv, sudo, etc.)
**Examples**: `["rm", "mv", "cp", "chmod"]`

#### allowScriptExecution (optional)
**Type**: `boolean`
**Purpose**: Control script execution for command_execute
**Applies To**: Only agents with `command_execute` tool
**Default**: `true`
**Use Cases**:
- `false`: Research agents that should never run code
- `true`: Development agents that need full execution

#### commandTimeout (optional)
**Type**: `number`
**Purpose**: Command execution timeout in milliseconds
**Applies To**: Only agents with `command_execute` tool
**Default**: `300000` (5 minutes)
**Range**: 1000 - 600000 (1 second - 10 minutes)

## Implementation Architecture

### Component Overview

```
AgentConfigLoader
├── loadAgentConfigs()
│   ├── loadFromFile()          # Single file loading
│   ├── loadFromDirectory()     # Directory loading
│   └── createSubAgent()        # SubAgent creation
├── validateAgentConfig()       # Zod validation
├── ToolRegistry
│   ├── createTool()            # Single tool creation
│   └── createTools()           # Batch tool creation
└── ModelFactory
    ├── createModel()           # Parse and create model
    └── validateModelString()   # Validate format
```

### Loading Flow

```
1. AgentConfigLoader instantiated with config directory
   ↓
2. Check for .wingman/agents.config.json
   ↓
3a. If exists: loadFromFile()
   ├── Read and parse JSON
   ├── Validate with Zod schema
   ├── Create SubAgent for each agent
   └── Return SubAgent[]
   ↓
3b. If not exists: Check .wingman/agents/
   ├── List *.json files
   ├── Load and validate each file
   ├── Skip invalid files with error logs
   └── Return SubAgent[]
   ↓
4. Return empty array if neither exists (graceful fallback)
   ↓
5. Merge with built-in agents in index.ts
   ↓
6. Pass to createDeepAgent()
```

### Validation Strategy

**Level 1: Schema Validation**
- Zod validates JSON structure
- Type checking for all fields
- Required field presence
- Array/object structure

**Level 2: Business Logic Validation**
- Tool names exist in registry
- Model format is correct
- Provider is supported
- Numeric ranges (timeout, etc.)

**Level 3: Runtime Validation**
- Model creation succeeds
- Tools instantiate correctly
- Backend accessible

**Error Handling**:
- Schema errors → Detailed field-level messages
- Unknown tools → Warning, skip tool
- Invalid model → Error, use default model
- File errors → Log and skip file

### Tool Registry

**Purpose**: Map string tool names to StructuredTool instances

**Implementation**: [src/config/toolRegistry.ts](../../src/config/toolRegistry.ts)

```typescript
function createTool(
  name: AvailableToolName,
  options?: ToolOptions
): StructuredTool | null {
  switch (name) {
    case "internet_search": return internetSearch;
    case "web_crawler": return webCrawler;
    case "command_execute":
      return createCommandExecuteTool(
        workspace,
        env,
        options.blockedCommands,
        options.allowScriptExecution,
        options.timeout
      );
    case "think": return createThinkingTool();
    default: return null;
  }
}
```

**Features**:
- Stateless tool creation
- Configurable command_execute tool
- Shared instances for stateless tools (internet_search, web_crawler)
- Per-agent instances for stateful tools (command_execute)

### Model Factory

**Purpose**: Parse model strings and create LangChain model instances

**Implementation**: [src/config/modelFactory.ts](../../src/config/modelFactory.ts)

```typescript
class ModelFactory {
  static createModel(modelString: string): LanguageModelLike {
    const [provider, model] = modelString.split(':');

    switch (provider.toLowerCase()) {
      case 'anthropic':
        return new ChatAnthropic({ model, temperature: 0 });
      case 'openai':
        return new ChatOpenAI({ model, temperature: 0 });
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
}
```

**Features**:
- Format validation before creation
- Case-insensitive provider names
- Consistent temperature (0 for determinism)
- Clear error messages

## Configuration Examples

### Example 1: Data Analyst Agent

**Use Case**: Python-based data analysis with safety constraints

**File**: `.wingman/agents/data-analyst.json`

```json
{
  "name": "data-analyst",
  "description": "Analyzes data using Python, pandas, and creates visualizations. Specializes in statistical analysis and data transformation.",
  "systemPrompt": "You are a data analysis expert with deep knowledge of Python, pandas, NumPy, and data visualization libraries.\n\nYour responsibilities:\n- Analyze datasets and identify patterns\n- Perform statistical analysis\n- Create clear visualizations\n- Write clean, efficient Python code\n- Explain findings in accessible language\n\nWhen analyzing data:\n1. First examine the data structure and quality\n2. Identify missing values and outliers\n3. Apply appropriate statistical methods\n4. Create visualizations to support findings\n5. Provide actionable insights\n\nAlways use the think tool to plan your analysis before executing code.",
  "tools": ["command_execute", "think"],
  "model": "anthropic:claude-opus-4-5",
  "blockedCommands": ["rm", "mv", "cp"],
  "allowScriptExecution": true,
  "commandTimeout": 300000
}
```

### Example 2: Security Researcher Agent

**Use Case**: Safe security research without command execution

**File**: `.wingman/agents/security-researcher.json`

```json
{
  "name": "security-researcher",
  "description": "Researches security vulnerabilities, CVEs, and best practices. Provides comprehensive security analysis and recommendations.",
  "systemPrompt": "You are a security research expert specializing in vulnerability analysis, threat intelligence, and security best practices.\n\nYour expertise includes:\n- CVE analysis and impact assessment\n- Security advisories and patch management\n- Threat modeling and risk analysis\n- Security frameworks (OWASP, NIST, etc.)\n- Secure coding practices\n\nWhen researching security topics:\n1. Search for official sources (NVD, vendor advisories, security blogs)\n2. Cross-reference multiple sources\n3. Assess severity and impact\n4. Provide remediation recommendations\n5. Include relevant CVE numbers and links\n\nAlways cite your sources and provide actionable security guidance.",
  "tools": ["internet_search", "web_crawler", "think"],
  "model": "anthropic:claude-sonnet-4-5"
}
```

### Example 3: Documentation Writer Agent

**Use Case**: Creating technical documentation with research

**File**: `.wingman/agents.config.json`

```json
{
  "agents": [
    {
      "name": "documentation-writer",
      "description": "Creates comprehensive technical documentation, API references, and user guides. Specializes in clear, accessible writing for developers and users.",
      "systemPrompt": "You are a technical documentation expert focused on creating clear, comprehensive, and user-friendly documentation.\n\nYour principles:\n- Write for your audience (developers, users, or both)\n- Use clear, concise language\n- Include practical examples\n- Structure content logically\n- Maintain consistency in style and formatting\n\nDocumentation types you create:\n- API references with code examples\n- User guides and tutorials\n- Architecture documentation\n- README files\n- Contributing guidelines\n\nFormat output in Markdown with proper headings, code blocks, and links.",
      "tools": ["web_crawler", "think"]
    }
  ]
}
```

## User Experience

### Success Flow

1. **Create Configuration**
   ```bash
   mkdir -p .wingman/agents
   cat > .wingman/agents/my-agent.json << EOF
   {
     "name": "my-agent",
     "description": "Does something specific",
     "systemPrompt": "You are...",
     "tools": ["think"]
   }
   EOF
   ```

2. **Agent Auto-Loaded**
   - On startup, AgentConfigLoader scans for configs
   - Valid agents logged: `"Loaded 1 custom agent(s): my-agent"`
   - Invalid agents logged with errors

3. **Use Custom Agent**
   - Root agent now aware of custom agent
   - Can delegate: "Use my-agent to..."
   - Agent appears in agent lists

### Error Scenarios

#### Invalid JSON
```
Error: Invalid JSON in my-agent.json: Expected property name or '}' at position 15
```

#### Missing Required Field
```
Error: Failed to validate my-agent.json:
Invalid agent configuration:
  - description: Invalid input: expected string, received undefined
  - systemPrompt: Invalid input: expected string, received undefined
```

#### Invalid Tool Name
```
Warning: Unknown tool name in my-agent.json: "invalid_tool"
Info: Loaded custom agent: my-agent (skipped 1 invalid tool)
```

#### Invalid Model Format
```
Error: Invalid model format: "claude-opus". Expected format: "provider:model-name"
Info: Agent "my-agent" will use default model
```

## Testing Strategy

### Unit Tests

**Test File**: [src/tests/agentConfig.test.ts](../../src/tests/agentConfig.test.ts)
- Schema validation (valid and invalid configs)
- Default value application
- Tool name validation
- Model format validation
- **Coverage**: 10 tests

**Test File**: [src/tests/toolRegistry.test.ts](../../src/tests/toolRegistry.test.ts)
- Tool creation for all tool types
- Tool options passing
- Unknown tool handling
- Batch tool creation
- **Coverage**: 13 tests

**Test File**: [src/tests/modelFactory.test.ts](../../src/tests/modelFactory.test.ts)
- Model creation for all providers
- Format validation
- Error handling
- Case insensitivity
- **Coverage**: 13 tests

**Test File**: [src/tests/agentLoader.test.ts](../../src/tests/agentLoader.test.ts)
- Single file loading
- Directory loading
- Priority handling
- Invalid config skipping
- Model and tool integration
- **Coverage**: 9 tests

**Total Test Coverage**: 45 tests

### Integration Tests

**Scenario 1**: Load and use custom agent
1. Create config with custom agent
2. Start system
3. Verify agent in subagents list
4. Delegate task to custom agent
5. Verify correct tools used

**Scenario 2**: Tool restrictions enforced
1. Create agent with limited tools
2. Verify only specified tools available
3. Confirm restricted tools inaccessible

**Scenario 3**: Model override works
1. Create agent with model override
2. Verify correct model used
3. Check model-specific behavior

### Manual Testing

**Test Case 1**: Create data analyst agent
```bash
# Create config
cat > .wingman/agents/data-analyst.json << 'EOF'
{
  "name": "data-analyst",
  "description": "Analyzes data using Python",
  "systemPrompt": "You are a data analyst...",
  "tools": ["command_execute", "think"],
  "model": "anthropic:claude-opus-4-5"
}
EOF

# Start and test
npm start
# Ask: "Use data-analyst to analyze dataset.csv"
```

**Expected Results**:
- Agent loads successfully
- Uses Opus model
- Has command_execute and think tools
- Can run Python scripts
- Provides analysis

## Documentation Requirements

### User Documentation
- [Custom Agents Configuration Guide](../custom-agents.md) ✅
- Configuration format reference ✅
- Available tools guide ✅
- Model selection guide ✅
- Example configurations ✅
- Troubleshooting guide ✅

### Developer Documentation
- Architecture overview (in [AGENTS.md](../../AGENTS.md)) ✅
- Extension points ✅
- Testing custom agents ✅
- Code documentation in TypeScript files ✅

## Success Metrics

### Adoption
- % of users creating custom agents (target: >30%)
- Average number of custom agents per user (target: 2-5)
- Most common tool combinations

### Quality
- % of configs valid on first try (target: >80%)
- Average time to create working agent (target: <5 minutes)
- Error recovery rate (target: >90%)

### Performance
- Config loading time (target: <100ms)
- Validation time (target: <10ms)
- Agent initialization time (target: <500ms)

### User Satisfaction
- Net Promoter Score (target: >50)
- Feature usage rate (target: >40% of active users)
- Support ticket volume related to custom agents (target: <5%)

## Security Considerations

### Configuration Validation
- All user input validated with Zod schemas
- Whitelisted tool names only
- Blocked command lists enforced
- Timeout limits enforced

### Command Execution Safety
- Default blocked commands list
- User-specified additional blocks
- Environment variable sanitization
- No arbitrary code execution in config

### File System Access
- Virtual mode for filesystem backend
- Isolated from real filesystem by default
- Read-only backend for reviewer agent
- Configurable workspace restrictions

### API Key Management
- API keys never in config files
- Environment variables only
- No logging of sensitive data
- Secure model instantiation

## Migration and Compatibility

### Backward Compatibility
- Built-in agents unchanged
- No breaking changes to existing APIs
- Graceful fallback when no config exists
- All new fields optional

### Version Management
- Schema version not required (single version)
- Future versions will use `schemaVersion` field
- Forward compatibility through optional fields
- Deprecation warnings for future changes

### Configuration Migration
No migration needed for v1.0 → v1.1 as custom agents are a new feature.

Future migrations (if needed):
```typescript
// Example migration helper (future)
function migrateConfig(config: any, fromVersion: string, toVersion: string) {
  // Handle version-specific migrations
}
```

## Future Enhancements

### Phase 2 (Short-term)
- **Agent templates**: Pre-built agent configurations
  - Data analyst template
  - Security researcher template
  - Documentation writer template
- **Configuration validation CLI**: `wingman validate-agents`
- **Agent export/import**: Share agents between projects
- **Agent versioning**: Track config changes over time

### Phase 3 (Medium-term)
- **Visual agent builder UI**: Web-based agent configuration
- **Agent marketplace**: Share and discover community agents
- **Dynamic tool configuration**: Per-agent tool settings beyond command_execute
- **Custom tool plugins**: User-defined tools via plugins

### Phase 4 (Long-term)
- **Agent analytics dashboard**: Performance metrics and usage stats
- **A/B testing framework**: Compare agent configurations
- **Agent optimization suggestions**: AI-powered config improvements
- **Automatic agent tuning**: Learn from usage patterns
- **Agent composition**: Combine multiple agents into workflows
- **Conditional logic in configs**: Dynamic behavior based on context

## Open Questions

None at this time. All requirements clearly defined and implemented.

## Appendix

### A. Complete Type Definitions

```typescript
// From src/config/agentConfig.ts
export type AvailableToolName =
  | "internet_search"
  | "web_crawler"
  | "command_execute"
  | "think";

export interface UserAgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  tools?: AvailableToolName[];
  model?: string;
  blockedCommands?: string[];
  allowScriptExecution?: boolean;
  commandTimeout?: number;
}

export interface AgentsConfigFile {
  agents: UserAgentConfig[];
}
```

### B. Error Message Reference

| Error Code | Message | Resolution |
|------------|---------|------------|
| SCHEMA_001 | Missing required field | Add required field to config |
| SCHEMA_002 | Invalid tool name | Use valid tool from available list |
| SCHEMA_003 | Invalid model format | Use "provider:model-name" format |
| FILE_001 | JSON parse error | Fix JSON syntax |
| FILE_002 | File not found | Check file path and permissions |
| RUNTIME_001 | Model creation failed | Verify API key and model name |
| RUNTIME_002 | Tool creation failed | Check tool configuration |

### C. Performance Benchmarks

Based on testing with typical configurations:

| Operation | Time | Notes |
|-----------|------|-------|
| Load single agent | 5ms | From .wingman/agents.config.json |
| Load 10 agents from directory | 15ms | From .wingman/agents/*.json |
| Validate agent config | 1ms | Zod schema validation |
| Create tool instance | <1ms | Cached for stateless tools |
| Create model instance | 10ms | API client initialization |
| Full initialization | 50ms | Including all agents and tools |

### D. Related Documents

- [PRD-001: Multi-Agent Architecture](001-multi-agent-architecture.md)
- [Custom Agents User Guide](../custom-agents.md)
- [AGENTS.md: Complete System Documentation](../../AGENTS.md)
- [Tool Implementations](../../src/tools/)
- [Agent Implementations](../../src/agents/)

---

**Document Version**: 1.0
**Created**: 2026-01-19
**Last Updated**: 2026-01-19
**Author**: Russell Canfield
**Status**: Implemented ✅
