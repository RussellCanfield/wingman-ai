# Wingman CLI

[Wingman-AI](https://marketplace.visualstudio.com/items?itemName=WingMan.wing-man) is an open source vscode extension that empowers users with an agentic code assistant. The **CLI** now brings the same power right to your terminal!

## Table of Contents
1. [Introduction](#introduction)
2. [Features](#features)
3. [Installation](#installation)
4. [Usage](#usage)
5. [Wingman CLI Configuration](#wingman-cli-configuration)
6. [LangChain Environment Variables](#langchain-environment-variables)
7. [Configuration Loader](#configuration-loader)
8. [Contributing](#contributing)
9. [License](#license)
10. [Contact](#contact)

## Introduction
Wingman CLI is an open source, terminal-based AI coding partner that supports the most popular frontier AI models; such as `Anthropic`, `OpenAI`, or `Google`.

## Local Storage
Wingman CLI stores all files within a `.wingman` folder of the current working directory.

## Features
- **Command Recognition**: The CLI allows users to input commands like `/file`, `/dir`, and `/clear` to manage context.
- **Context Management**: Users can add files and directories to the context or clear the context using specific commands.
- **Memory**: Wingman supports a local SQLite instance to preserve chat history. You can `/resume` and `/compact` the conversation.

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

## Wingman CLI Configuration
To configure the Wingman CLI, you should place your configuration file in a `.wingman` subdirectory within your project. The configuration file should be named `wingman.config.json`. Here is an example of what the configuration might look like:

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-0"
}
```

## Abilities

Wingman CLI will soon support advanced capabilities, much like the vscode extension does. Here are the currently available features, just add them to your `/.wingman/wingman.config.json` file.

```json
{
  toolAbilities: {
    blockedCommands: ["sudo"]
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

## Contributing
We welcome contributions from the community! To contribute, please fork the repository and create a pull request with your changes. Ensure that your code adheres to our coding standards and includes tests where applicable.

## License
This project is licensed under the ISC License.

## Contact
For questions or feedback, please reach out to us at support@wingman-ai.com or visit our [GitHub repository](https://github.com/wingman-ai/cli) to open an issue.