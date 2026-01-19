# Custom Agents Configuration

Wingman allows you to define custom subagents through configuration files. This enables you to create specialized agents with custom prompts, tools, and models without modifying code.

## Configuration Location

You can configure custom agents in two ways:

### Option 1: Single Configuration File
Create a single file: `.wingman/agents.config.json`

```json
{
  "agents": [
    {
      "name": "agent-1",
      "description": "...",
      "systemPrompt": "...",
      "tools": ["internet_search", "web_crawler"]
    },
    {
      "name": "agent-2",
      "description": "...",
      "systemPrompt": "...",
      "tools": ["command_execute", "think"]
    }
  ]
}
```

### Option 2: Directory of Agent Files
Create individual files in: `.wingman/agents/`

```
.wingman/
└── agents/
    ├── data-analyst.json
    ├── security-researcher.json
    └── documentation-writer.json
```

Each file contains a single agent configuration (without the `agents` array wrapper).

## Configuration Schema

### Required Fields

- **`name`** (string): Unique agent identifier
  - Used when the root agent delegates tasks
  - Format: lowercase with hyphens (e.g., `"data-analyst"`)

- **`description`** (string): Action-oriented description of what the agent does
  - Helps the root agent decide when to delegate
  - Be specific about the agent's purpose and capabilities
  - Example: `"Analyzes data and creates visualizations using Python and pandas"`

- **`systemPrompt`** (string): Detailed instructions for the agent
  - Define the agent's personality and expertise
  - Include tool usage guidance
  - Specify output formatting requirements
  - Can be multi-line

### Optional Fields

- **`tools`** (string[]): List of available tools for this agent
  - Keep minimal and focused on the agent's purpose
  - Available tools: `"internet_search"`, `"web_crawler"`, `"command_execute"`, `"think"`
  - If omitted, agent has no tools (relies on base LLM capabilities)

- **`model`** (string): Override the default model
  - Format: `"provider:model-name"`
  - Examples: `"anthropic:claude-opus-4-5"`, `"openai:gpt-4o"`
  - Supported providers: `anthropic`, `openai`
  - If omitted, uses the system default model

- **`blockedCommands`** (string[]): Commands blocked for `command_execute` tool
  - Only applies if `command_execute` is in the tools list
  - Example: `["rm", "mv", "sudo"]`
  - Default: Common destructive commands are already blocked

- **`allowScriptExecution`** (boolean): Whether to allow script execution
  - Only applies if `command_execute` is in the tools list
  - Default: `true`

- **`commandTimeout`** (number): Command execution timeout in milliseconds
  - Only applies if `command_execute` is in the tools list
  - Default: `300000` (5 minutes)

## Available Tools

### `internet_search`
- Web search using Tavily (if API key set) or DuckDuckGo
- No additional configuration required
- Use for: Research, fact-checking, finding documentation

### `web_crawler`
- Multi-page web crawling with content extraction
- No additional configuration required
- Use for: Deep research, documentation exploration, content aggregation

### `command_execute`
- Execute shell commands in the workspace
- Configurable via `blockedCommands`, `allowScriptExecution`, `commandTimeout`
- Use for: Running tests, builds, scripts, data processing

### `think`
- Reasoning and brainstorming without external effects
- No additional configuration required
- Use for: Analysis, planning, debugging strategy

## Example Configurations

### Example 1: Data Analyst Agent

`.wingman/agents/data-analyst.json`:

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

`.wingman/agents/security-researcher.json`:

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

`.wingman/agents.config.json`:

```json
{
  "agents": [
    {
      "name": "documentation-writer",
      "description": "Creates comprehensive technical documentation, API references, and user guides. Specializes in clear, accessible writing.",
      "systemPrompt": "You are a technical documentation expert focused on creating clear, comprehensive, and user-friendly documentation.\n\nYour principles:\n- Write for your audience (developers, users, or both)\n- Use clear, concise language\n- Include practical examples\n- Structure content logically\n- Maintain consistency in style and formatting\n\nDocumentation types you create:\n- API references with code examples\n- User guides and tutorials\n- Architecture documentation\n- README files\n- Contributing guidelines\n\nFormat output in Markdown with proper headings, code blocks, and links.",
      "tools": ["web_crawler", "think"]
    }
  ]
}
```

## Best Practices

### 1. Keep Tool Sets Focused
- Only include tools the agent actually needs
- More tools = more complexity and potential confusion
- Example: A documentation writer doesn't need `command_execute`

### 2. Write Specific Descriptions
- Help the root agent make good delegation decisions
- Be action-oriented: "Analyzes data..." not "Can analyze data..."
- Distinguish similar agents clearly

### 3. Choose Appropriate Models
- Use more powerful models (Opus) for complex reasoning tasks
- Use faster models (Sonnet) for straightforward tasks
- Consider cost vs. capability tradeoffs

### 4. Test Configurations
- Start with simple configurations
- Test delegation by asking the root agent to use your custom agent
- Iterate based on results

### 5. Secure Command Execution
- Block destructive commands for agents that don't need them
- Set `allowScriptExecution: false` for research-only agents
- Use appropriate timeouts to prevent runaway processes

## How It Works

1. **Loading**: On startup, Wingman scans for agent configs in:
   - `.wingman/agents.config.json` (checked first)
   - `.wingman/agents/*.json` (checked if single file doesn't exist)

2. **Validation**: Each config is validated against the schema
   - Invalid configs are logged and skipped
   - Unknown tool names are warned but don't prevent loading

3. **Integration**: Valid agents are added to the root agent's subagents array
   - User-defined agents are added after built-in agents
   - Agents with duplicate names override earlier definitions

4. **Delegation**: The root agent can delegate to your custom agents
   - Use the agent's name in delegation
   - The root agent chooses when to delegate based on the description

## Troubleshooting

### Agent Not Loading
- Check JSON syntax (use a JSON validator)
- Verify file location (`.wingman/agents.config.json` or `.wingman/agents/`)
- Check logs for validation errors
- Ensure all required fields are present

### Tools Not Working
- Verify tool name spelling (case-sensitive)
- Check that tool is in the available tools list
- For `command_execute`: check `blockedCommands` and `allowScriptExecution`

### Model Errors
- Verify format: `"provider:model-name"`
- Ensure provider is supported (`anthropic` or `openai`)
- Check that model name is valid for the provider
- Verify API keys are set in environment

### Agent Not Being Used
- Make description more specific and action-oriented
- Test delegation explicitly: "Use the [agent-name] agent to..."
- Check that agent's capabilities match the task
- Review agent's system prompt for clarity

## Schema Reference

Full TypeScript schema:

```typescript
{
  name: string;                    // Required: unique identifier
  description: string;             // Required: what agent does
  systemPrompt: string;            // Required: agent instructions
  tools?: Array<                   // Optional: available tools
    | "internet_search"
    | "web_crawler"
    | "command_execute"
    | "think"
  >;
  model?: string;                  // Optional: "provider:model-name"
  blockedCommands?: string[];      // Optional: for command_execute
  allowScriptExecution?: boolean;  // Optional: default true
  commandTimeout?: number;         // Optional: default 300000
}
```

## Next Steps

1. Create your first custom agent config
2. Test delegation from the root agent
3. Iterate on the system prompt and tools
4. Share your agents with your team

For more information, see:
- [Available Tools Documentation](./tools.md)
- [LangChain deepagents Documentation](https://docs.langchain.com/oss/javascript/deepagents/subagents)
