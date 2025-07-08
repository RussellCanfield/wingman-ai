# @wingman-ai/agent

[![npm version](https://badge.fury.io/js/%40wingman-ai%2Fagent.svg)](https://badge.fury.io/js/%40wingman-ai%2Fagent)

The `@wingman-ai/agent` package provides a powerful and flexible agentic coding assistant that can work with various language models from providers like Anthropic, OpenAI, Google, Azure, and Ollama. It is designed to be easily integrated into your projects to provide AI-powered code generation, analysis, and automation.

## Features

- **Multi-Provider Support:** Works seamlessly with a variety of language model providers.
- **Extensible Toolset:** Comes with a rich set of built-in tools for web searching, file system operations, command execution, and more.
- **Background Agents:** Spawn autonomous agents that work in isolated git worktrees with automatic integration.
- **Pull Request Automation:** Automatically create GitHub pull requests with seamless authentication.
- **Stateful Conversations:** Maintains conversation state using a graph-based approach, allowing for complex and multi-turn interactions.
- **Configurable:** Easily configure the agent with your desired model, tools, and working directory.
- **Streaming Support:** Supports streaming of responses for real-time interactions.

## Installation

To install the `@wingman-ai/agent` package, use your favorite package manager:

```bash
npm install @wingman-ai/agent
```

```bash
yarn add @wingman-ai/agent
```

```bash
pnpm add @wingman-ai/agent
```

### Optional Dependencies

For GitHub pull request creation, install:

```bash
npm install @octokit/rest
```

## Quick Start

Here's a basic example of how to use the `WingmanAgent`:

```typescript
import { WingmanAgent } from "@wingman-ai/agent";
import { ChatAnthropic } from "@langchain/anthropic";

// 1. Initialize the language model you want to use
const model = new ChatAnthropic({
  apiKey: "YOUR_ANTHROPIC_API_KEY",
  modelName: "claude-3-opus-20240229",
});

// 2. Create a new WingmanAgent instance
const agent = new WingmanAgent({
  name: "MyWingman",
  model: model,
  workingDirectory: "/path/to/your/project",
});

// 3. Initialize the agent
await agent.initialize();

// 4. Define your request
const request = {
  input: "Read the 'package.json' file and tell me the name of the project.",
};

// 5. Stream the agent's response
for await (const output of agent.stream(request)) {
  console.log(output);
}
```

## Advanced Configuration

### Background Agents with Pull Request Integration

```typescript
import { WingmanAgent } from "@wingman-ai/agent";
import { ChatOpenAI } from "@langchain/openai";

const agent = new WingmanAgent({
  name: "Code Assistant",
  model: new ChatOpenAI({ model: "gpt-4" }),
  workingDirectory: process.cwd(),
  
  // Configure background agent behavior
  backgroundAgentConfig: {
    pushToRemote: true,           // Push branches to remote
    createPullRequest: true,      // Auto-create PRs
    pullRequestTitle: "🤖 {agentName}: {input}",
    pullRequestBody: `
## Automated Changes by {agentName}

**Task:** {input}

### Files Modified
{changedFiles}

---
*This PR was created automatically by Wingman AI*
    `.trim()
  },
  
  // Customize available tools
  tools: ["background_agent", "edit_file", "command_execute", "web_search"]
});

await agent.initialize();

// Spawn a background agent
const response = await agent.invoke({
  input: "Create a background agent called 'Feature Builder' to add a new user authentication component"
});
```

## Configuration Reference

The `WingmanAgent` can be configured with the following options:

### Core Configuration

| Option             | Type                               | Description                                                                                             |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `name`             | `string`                           | **Required.** Display name for the agent.                                                              |
| `model`            | `BaseChatModel`                    | **Required.** An instance of a LangChain chat model.                                                   |
| `prompt`           | `string` (optional)                | Custom system prompt to override the default.                                                          |
| `instructions`     | `string` (optional)                | Additional instructions that augment the system prompt.                                                 |
| `workingDirectory` | `string` (optional)                | Working directory for the agent. Defaults to `process.cwd()`.                                          |
| `mode`             | `"interactive" \| "vibe"`          | Agent interaction mode. `"vibe"` is more autonomous, `"interactive"` asks for confirmation. Default: `"vibe"`. |
| `memory`           | `BaseCheckpointSaver` (optional)   | LangChain checkpoint saver for conversation persistence. Defaults to `MemorySaver`.                    |

### Background Agent Configuration

Configure how background agents integrate their work:

```typescript
backgroundAgentConfig?: {
  /**
   * Whether to push branches to remote repository
   * - false: Local-only integration (merge directly)
   * - true: Push to remote before integration
   * @default false
   */
  pushToRemote: boolean;
  
  /**
   * Whether to create pull requests (requires pushToRemote: true)
   * When enabled, creates PR instead of direct merge
   * @default false
   */
  createPullRequest: boolean;
  
  /**
   * Template for pull request title
   * Available placeholders: {agentName}, {input}
   * @default "Background Agent: {agentName}"
   */
  pullRequestTitle: string;
  
  /**
   * Template for pull request body
   * Available placeholders: {agentName}, {input}, {changedFiles}
   */
  pullRequestBody: string;
}
```

### Tool Abilities Configuration

Control tool capabilities and security:

```typescript
toolAbilities?: {
  /**
   * Symbol retrieval for code analysis
   */
  symbolRetriever?: any;
  
  /**
   * File diagnostics for error detection
   */
  fileDiagnostics?: any;
  
  /**
   * Commands that the agent cannot execute
   * @default ["rm", "rmdir", "del", "format", "fdisk", "mkfs", "dd", "sudo rm", "sudo rmdir", "chmod 777", "chown", "passwd", "su", "sudo su"]
   */
  blockedCommands?: string[];
  
  /**
   * Whether to allow script/command execution
   * @default true
   */
  allowScriptExecution?: boolean;
}
```

### Available Tools

Control which tools the agent has access to:

```typescript
tools?: Array<
  | "background_agent"           // Spawn autonomous background agents
  | "integrate_background_work"  // Integrate completed background work
  | "web_search"                 // Search the web for information
  | "thinking"                   // Internal reasoning tool
  | "command_execute"            // Execute shell commands
  | "read_file"                  // Read file contents
  | "list_directory"             // List directory contents
  | "edit_file"                  // Create/modify files
  | "research"                   // Conduct deep research
  | "file_inspector"             // Inspect files for issues
>
```

## Background Agents

Background agents are autonomous workers that operate in isolated git worktrees, allowing parallel development without conflicts.

### Key Features

- **Isolated Worktrees:** Each background agent works in its own git worktree
- **Autonomous Operation:** No user interaction required during execution
- **Automatic Integration:** Can automatically merge changes back to main branch
- **Pull Request Creation:** Supports GitHub PR creation with multiple authentication methods
- **Conflict Detection:** Detects and reports merge conflicts
- **Event System:** Real-time status updates via event emitters

### Usage Example

```typescript
// Listen for background agent events
agent.events.on('status', (status) => {
  console.log(`Agent ${status.agentName}: ${status.status}`);
});

agent.events.on('complete', (data) => {
  console.log(`Agent completed with status: ${data.status}`);
});

// Create a background agent
await agent.invoke({
  input: "Create a background agent to implement user authentication"
});
```

### Integration Workflows

#### Local-Only Integration
```typescript
backgroundAgentConfig: {
  pushToRemote: false,        // Keep changes local
  createPullRequest: false    // Direct merge to main branch
}
```

#### Remote Integration with Direct Merge
```typescript
backgroundAgentConfig: {
  pushToRemote: true,         // Push branch to remote
  createPullRequest: false    // Merge directly after push
}
```

#### Pull Request Workflow
```typescript
backgroundAgentConfig: {
  pushToRemote: true,         // Push branch to remote
  createPullRequest: true,    // Create PR for review
  pullRequestTitle: "🚀 Feature: {agentName}",
  pullRequestBody: "Automated implementation of: {input}\n\nChanged files:\n{changedFiles}"
}
```

## GitHub Pull Request Integration

The agent supports seamless GitHub pull request creation with multiple authentication methods.

### Authentication Methods (Automatic Detection)

The system automatically detects GitHub tokens from:

1. **Environment Variables** (most common):
   ```bash
   export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
   export GH_TOKEN=ghp_xxxxxxxxxxxx
   export GITHUB_PAT=ghp_xxxxxxxxxxxx
   export GH_PAT=ghp_xxxxxxxxxxxx
   ```

2. **GitHub CLI** (if installed):
   ```bash
   gh auth login
   # Token automatically extracted via: gh auth token
   ```

3. **Git Configuration**:
   ```bash
   git config --global github.token ghp_xxxxxxxxxxxx
   ```

### Fallback System

1. **Primary**: Uses `@octokit/rest` (GitHub API client)
2. **Fallback**: Uses GitHub CLI if Octokit fails
3. **Graceful**: Continues without PR if both fail

### Benefits Over CLI-Only Approach

- ✅ **No CLI Installation Required** - Pure Node.js solution
- ✅ **Cross-Platform** - Works on all operating systems
- ✅ **Automatic Token Detection** - Uses existing authentication
- ✅ **Better Error Handling** - More reliable API access
- ✅ **Fallback Support** - Multiple authentication methods

## Tools Reference

### Core Tools

- **`background_agent`**: Spawn autonomous agents in isolated worktrees
- **`integrate_background_work`**: Integrate completed background agent work
- **`web_search`**: Search the web for information and documentation
- **`thinking`**: Internal reasoning and problem-solving tool
- **`command_execute`**: Execute shell commands with safety restrictions
- **`read_file`**: Read and analyze file contents
- **`list_directory`**: List and explore directory structures
- **`edit_file`**: Create, modify, and manage files
- **`research`**: Conduct comprehensive research on topics
- **`file_inspector`**: Inspect files for linting issues and diagnostics

### Tool Security

The agent includes built-in security measures:

```typescript
// Default blocked commands for safety
const DEFAULT_BLOCKED_COMMANDS = [
  "rm", "remove", "del", "delete", "rmdir", "rd",
  "mv", "move", "format", ">", ">>", "chmod", 
  "chown", ":>", "sudo", "su"
];
```

## Event System

Monitor background agent progress with the event system:

```typescript
// Status updates
agent.events.on('status', (status: BackgroundAgentStatus) => {
  console.log(`${status.agentName}: ${status.status}`);
  
  if (status.integration?.conflictFiles) {
    console.log('Conflicts in:', status.integration.conflictFiles);
  }
  
  if (status.integration?.pullRequestUrl) {
    console.log('PR created:', status.integration.pullRequestUrl);
  }
});

// Completion events
agent.events.on('complete', (data) => {
  console.log(`Agent ${data.threadId} completed: ${data.status}`);
});

// Error handling
agent.events.on('error', (data) => {
  console.error('Background agent error:', data.error);
});
```

## MCP Support

Support for MCP based on [LangChain's MCP adapter package](https://github.com/langchain-ai/langchainjs/tree/main/libs/langchain-mcp-adapters).

In the `.wingman` directory, create a `mcp.json` file with the following schema:

```json
{
  "mcpServers": {
    "data-processor": {
      "command": "python",
      "args": ["data_server.py"]
    }
  }
}
```

## Examples

### Basic File Operations
```typescript
const agent = new WingmanAgent({
  name: "File Manager",
  model: new ChatOpenAI({ model: "gpt-4" }),
  tools: ["read_file", "edit_file", "list_directory"]
});

await agent.initialize();

const result = await agent.invoke({
  input: "Read package.json and update the version to 2.0.0"
});
```

### Research and Development
```typescript
const agent = new WingmanAgent({
  name: "Research Assistant",
  model: new ChatAnthropic({ model: "claude-3-sonnet-20240229" }),
  tools: ["web_search", "research", "thinking", "edit_file"]
});

await agent.initialize();

const result = await agent.invoke({
  input: "Research the latest React 18 features and create a summary document"
});
```

### Autonomous Development
```typescript
const agent = new WingmanAgent({
  name: "Dev Assistant",
  model: new ChatOpenAI({ model: "gpt-4" }),
  backgroundAgentConfig: {
    pushToRemote: true,
    createPullRequest: true,
    pullRequestTitle: "🤖 Auto-implementation: {input}",
    pullRequestBody: "Automated changes by {agentName}\n\nTask: {input}\n\nFiles: {changedFiles}"
  },
  tools: ["background_agent", "edit_file", "command_execute", "file_inspector"]
});

await agent.initialize();

// This will create a background agent that works autonomously
const result = await agent.invoke({
  input: "Create a background agent to implement a REST API for user management"
});
```

## Dependencies

The `@wingman-ai/agent` package relies on several key libraries:

- **LangChain.js:** A powerful framework for building applications with language models.
- **Zod:** A TypeScript-first schema declaration and validation library.
- **@octokit/rest:** GitHub API client for pull request creation (optional).

## Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request on our [GitHub repository](https://github.com/RussellCanfield/wingman-ai).

## License

This package is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.