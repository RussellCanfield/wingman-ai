# Project Name

Brief description of your project.

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
Provide a more detailed description of the project. Explain what problem it solves and why it’s useful.

## Features
- **Command Recognition**: The UserInput component supports command recognition, allowing users to input commands like `/file`, `/dir`, and `/clear` to manage context.
- **Dynamic Command Suggestions**: As users type commands, the component dynamically suggests available commands that match the input.
- **Context Management**: Users can add files and directories to the context or clear the context using specific commands.
- **Interactive Input**: The component provides an interactive input field for users to enter their commands and text, with real-time feedback and command filtering.

## Installation
Instructions on how to install and set up the project. For example:

```bash
git clone https://github.com/yourusername/yourproject.git
cd yourproject
npm install
```

## Usage
Examples of how to run or use the project. Screenshots or code snippets can be helpful.

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
Guidelines for contributing to the project. Include information on submitting issues and pull requests.

## License
Indicate what license the project is distributed under. For example, MIT, GPL, etc.

## Contact
Provide contact information for users or developers to reach out with questions or feedback.
