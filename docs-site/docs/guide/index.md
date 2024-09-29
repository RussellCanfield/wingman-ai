# Getting started

**Wingman-AI** is an open source VSCode extension that provides cutting edge features for multiple AI providers.

[Download our extension from the VSCode marketplace!](https://marketplace.visualstudio.com/items?itemName=WingMan.wing-man)

[Suggestion? Problem? Open a GitHub issue](https://github.com/RussellCanfield/wingman-ai)

### **Like the extension? Check out [Squadron AI](https://www.squadron-ai.com)** our GitHub AI-powered code review application.

## How to begin

Wingman must be configured before beginning, this involves choosing an AI provider, and adding the API key if applicable.
If you are running Ollama, make sure Ollama is installed, and started before running the extension, you can always reload the window after you start Ollama.

:::note
There is a UX issue around the configuration panel, where it will be condensed down to **one save button**
Currently **you must save every section individually**
:::

Once you select a provider and configure it, code completion and chat will work as expected. Please visit the other pages in the documentation to see details on configuration sections.

## Providers

We currently support 4 AI providers.

-   [Ollama](https://ollama.ai/)
-   HuggingFace
-   OpenAI
-   Anthropic

While we encourage teams to run **Ollama**, it is a challenge to support advanced features due to most machines having limited compute.
Further the models users are running can have varied context lengths and abilities such as reliable output formats.

Currently **Ollama** and **OpenAI** are supported for generating advanced code context about your project. **NOTE** Embedding and query models are separately configured in settings.
