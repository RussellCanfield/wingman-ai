# @wingman-ai/agent

[![npm version](https://badge.fury.io/js/%40wingman-ai%2Fagent.svg)](https://badge.fury.io/js/%40wingman-ai%2Fagent)

The `@wingman-ai/agent` package provides a powerful and flexible agentic coding assistant that can work with various language models from providers like Anthropic, OpenAI, Google, Azure, and Ollama. It is designed to be easily integrated into your projects to provide AI-powered code generation, analysis, and automation.

## Features

- **Multi-Provider Support:** Works seamlessly with a variety of language model providers.
- **Extensible Toolset:** Comes with a rich set of built-in tools for web searching, file system operations, command execution, and more.
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

## Usage

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

## Configuration

The `WingmanAgent` can be configured with the following options:

| Option             | Type                               | Description                                                                                             |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `name`             | `string`                           | The name of the agent.                                                                                  |
| `prompt`           | `string` (optional)                | A custom system prompt to override the default.                                                         |
| `instructions`     | `string` (optional)                | Additional instructions for the agent.                                                                  |
| `model`            | `BaseChatModel`                    | An instance of a LangChain chat model.                                                                  |
| `workingDirectory` | `string` (optional)                | The working directory for the agent. Defaults to the current working directory.                         |
| `mode`             | `"interactive" \| "vibe"`          | The agent's mode of operation. Defaults to `"vibe"`.                                                    |
| `memory`           | `BaseCheckpointSaver` (optional)   | A LangChain checkpoint saver for conversation memory. Defaults to `MemorySaver`.                        |
| `toolAbilities`    | `object` (optional)                | An object to extend the agent's tool capabilities, such as with a `symbolRetriever` or `fileDiagnostics`. |

## Tools

The agent comes with a variety of built-in tools:

- **Web Search:** Searches the web for information.
- **Thinking:** Allows the agent to "think" through a problem before responding.
- **Command Execution:** Executes shell commands.
- **File System:** Reads, writes, and lists files and directories.
- **Research:** Conducts in-depth research on a topic.
- **File Inspector:** Inspects files for linting issues and diagnostics.

## Dependencies

The `@wingman-ai/agent` package relies on several key libraries:

- **LangChain.js:** A powerful framework for building applications with language models.
- **Zod:** A TypeScript-first schema declaration and validation library.

## Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request on our [GitHub repository](https://github.com/RussellCanfield/wingman-ai).

## License

This package is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
