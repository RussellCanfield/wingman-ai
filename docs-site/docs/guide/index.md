# Getting started

**Wingman-AI** is an open source VSCode extension that provides cutting edge features for multiple AI providers.

[Download our extension from the VSCode marketplace!](https://marketplace.visualstudio.com/items?itemName=WingMan.wing-man)

[Suggestion? Problem? Open a GitHub issue](https://github.com/RussellCanfield/wingman-ai)

## How to begin

Wingman must be configured before beginning, this involves choosing an AI provider, and adding the API key if applicable.
If you are running Ollama, make sure Ollama is installed, and started before running the extension, you can always reload the window after you start Ollama.

Once you select a provider and configure it, code completion and chat will work as expected. Please visit the other pages in the documentation to see details on configuration sections.

## Providers

We currently support 4 AI providers.

-   [Ollama](https://ollama.ai/)
-   HuggingFace
-   OpenAI
-   Anthropic
-   AzureAI

While we encourage teams to run **Ollama**, it is a challenge to support advanced features due to most machines having limited compute.
Further the models users are running can have varied context lengths and abilities such as reliable output formats.

Currently **Ollama** and **OpenAI** are supported for generating advanced code context about your project. **NOTE** Embedding and query models are separately configured in settings.

## Indexing

Indexing needs to be configured for Wingman to start generating code context, visit the [indexing section]('./indexing') to learn how to configure it.