# Wingman CLI

[Wingman-AI VSCode Extension](https://marketplace.visualstudio.com/items?itemName=WingMan.wing-man) is an open source vscode extension that empowers users with an agentic code assistant. The **CLI** now brings the same power right to your terminal!

[Wingman-AI Agent](https://www.npmjs.com/package/@wingman-ai/agent)

## Table of Contents
1. [Introduction](#introduction)
2. [Features](#features)
3. [Installation](#installation)
4. [Usage](#usage)
5. [Logging](#logging)
6. [Wingman CLI Configuration](#wingman-cli-configuration)
7. [Configuration Schema](#configuration-schema)
8. [LangChain Environment Variables](#langchain-environment-variables)
9. [Configuration Loader](#configuration-loader)
10. [Contributing](#contributing)
11. [License](#license)
12. [Contact](#contact)

## Introduction
Wingman CLI is an open source, terminal-based AI coding partner that supports the most popular frontier AI models; such as `Anthropic`, `OpenAI`, or `Google`.

## Local Storage
Wingman CLI stores all files within a `.wingman` folder of the current working directory.

## Features
- **Command Recognition**: The CLI allows users to input commands like `/file`, `/dir`, and `/clear` to manage context.
- **Context Management**: Users can add files and directories to the context or clear the context using specific commands.
- **Memory**: Wingman supports a local SQLite instance to preserve chat history. You can `/resume` and `/compact` the conversation.
- **Background Agents**: Wingman supports running tasks in the background, and can even submit pull requests! [Read the agent docs](https://www.npmjs.com/package/@wingman-ai/agent) and monitor with `/tasks`.
- **Silent by Default**: Logging is disabled by default for a clean user experience.

## Installation
To install the Wingman CLI, clone the repository and install the dependencies:

```bash
git clone https://github.com/wingman-ai/cli.git
cd cli
npm install
```

## Usage
To start using the Wingman CLI, run the following command:

```bash
npx wingman
```

This will launch the CLI, allowing you to interact with your AI coding partner directly from the terminal. You can use commands like `/file` to add files to the context or `/clear` to reset the context.

## Logging

By default, Wingman CLI runs silently with no logging output. You can enable logging using command-line arguments or environment variables.

### Command Line Arguments

Enable logging with these flags:

```bash
# Enable info-level logging
npx wingman --verbose
npx wingman -v
npx wingman --log

# Enable debug-level logging (most detailed)
npx wingman --debug
npx wingman -d
```

### Environment Variable

You can also control logging via the `WINGMAN_LOG_LEVEL` environment variable:

```bash
# Set log level via environment variable
export WINGMAN_LOG_LEVEL=debug
npx wingman

# Or inline
WINGMAN_LOG_LEVEL=info npx wingman
```

### Available Log Levels

- `silent` (default) - No logging output
- `error` - Only error messages
- `warn` - Warnings and errors
- `info` - General information, warnings, and errors
- `debug` - Detailed debugging information
- `trace` - Most verbose logging

### Log Files

When logging is enabled, log files are automatically created in `.wingman/debug-YYYY-MM-DD.log` with:
- Daily rotation
- Maximum 10MB file size
- Keeps last 5 files
- Pretty-printed console output in development

## Wingman CLI Configuration
To configure the Wingman CLI, you should place your configuration file in a `.wingman` subdirectory within your project. The configuration file should be named `wingman.config.json`. Here is an example of what the configuration might look like:

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-0"
}
```

## Configuration Schema

The Wingman CLI uses a comprehensive configuration schema that supports various AI providers and capabilities. Here's the complete configuration structure:

### Basic Configuration

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-0",
  "capabilities": {
    "language": "typescript"
  }
}
```

### Advanced Configuration

```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "capabilities": {
    "language": "typescript"
  },
  "backgroundAgentConfig": {
    "enabled": true,
    "maxConcurrentTasks": 3
  },
  "toolAbilities": {
    "blockedCommands": ["sudo", "rm", "mv"],
    "allowScriptExecution": true
  }
}
```

### Configuration Options

#### Core Settings
- **`provider`** (required): AI provider - `"anthropic"`, `"openai"`, or `"google"`
- **`model`** (required): Model name specific to the provider
- **`capabilities.language`** (optional): Primary language - `"typescript"`, `"javascript"`, `"python"`, `"csharp"`, or `"rust"`

#### Background Agent
- **`backgroundAgentConfig.enabled`** (optional): Enable background task processing
- **`backgroundAgentConfig.maxConcurrentTasks`** (optional): Maximum concurrent background tasks

#### Tool Abilities
- **`toolAbilities.blockedCommands`** (optional): Array of commands to block from execution
- **`toolAbilities.allowScriptExecution`** (optional): Allow or deny script execution (default: `true`)

### Custom Instructions

You can provide custom instructions by creating an `instructions.md` file in your `.wingman` directory:

```bash
# Create custom instructions
echo "You are a senior TypeScript developer focused on clean, maintainable code." > .wingman/instructions.md
```

## Abilities

Wingman CLI supports advanced capabilities for enhanced security and control:

### Command Blocking

Block specific commands from being executed:

```json
{
  "toolAbilities": {
    "blockedCommands": ["sudo", "rm", "mv", "chmod"]
  }
}
```

### Script Execution Control

Control whether scripts can be executed:

```json
{
  "toolAbilities": {
    "allowScriptExecution": false
  }
}
```

## LangChain Environment Variables
LangChain supports multiple AI providers. To configure these, set the following environment variables:

### OpenAI
```bash
export OPENAI_API_KEY="your-openai-api-key"
```

### Anthropic
```bash
export ANTHROPIC_API_KEY="your-anthropic-api-key"
```

### Google
```bash
export GOOGLE_API_KEY="your-google-api-key"
```

Ensure these keys are kept secure and not exposed in your source code.

## Configuration Loader

The configuration loader automatically detects and validates your configuration:

1. Looks for `.wingman/wingman.config.json` in the current directory
2. Validates the configuration against the schema
3. Provides helpful error messages for invalid configurations
4. Supports hot-reloading during development

## Contributing
We welcome contributions from the community! To contribute, please fork the repository and create a pull request with your changes. Ensure that your code adheres to our coding standards and includes tests where applicable.

## License
This project is licensed under the ISC License.

## Contact
For questions or feedback, please reach out to us at support@wingman-ai.com or visit our [GitHub repository](https://github.com/wingman-ai/cli) to open an issue.