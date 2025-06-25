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

## Features
- **Command Recognition**: The CLI allows users to input commands like `/file`, `/dir`, and `/clear` to manage context.
- **Context Management**: Users can add files and directories to the context or clear the context using specific commands.

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
The configuration loader is responsible for loading the Wingman CLI configuration. It looks for a `.wingman` directory in the current working directory and expects a `wingman.config.json` file and an optional `.env` file for environment variables.

- **Default Configuration**: If no configuration file is found, a default configuration is used with `provider` set to `openai` and `model` set to `gpt-4o`.
- **Environment Variables**: If a `.env` file is present, it loads environment variables from it.
- **Error Handling**: The loader uses `Zod` for schema validation. If the configuration file is invalid, it logs the errors and falls back to the default configuration.
- **Supplemental Instructions**: The loader can also incorporate supplemental instructions from an `instructions.md` file located in the `.wingman` directory. This file is intended to provide additional guidance or configuration details to the AI agent, enhancing its functionality and adaptability.
- **Configuration Schema**: The configuration schema includes a `model` which is an instance of `BaseChatModel`, and optional `capabilities` that specify the programming language capabilities such as `typescript`, `javascript`, `python`, `csharp`, or `rust`.

## Contributing
We welcome contributions from the community! To contribute, please fork the repository and create a pull request with your changes. Ensure that your code adheres to our coding standards and includes tests where applicable.

## License
This project is licensed under the ISC License.

## Contact
For questions or feedback, please reach out to us at support@wingman-ai.com or visit our [GitHub repository](https://github.com/wingman-ai/cli) to open an issue.