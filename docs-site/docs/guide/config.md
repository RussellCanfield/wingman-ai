# Configuration

[Wingman](https://marketplace.visualstudio.com/items?itemName=WingMan.wing-man) has a built-in configuration window that will persist configuration locally into a settings file on your machine.

Settings can be accessed from the side panel, or under the `Wingman` option in the terminal pane.

![](/Settings.png)

## Storage

The [Wingman](https://marketplace.visualstudio.com/items?itemName=WingMan.wing-man) storage location is shown below:

**Storage Location:**

/Home Directory/.wingman

**Example on macOS:**

/Users/username/.wingman

## Supported Models

We aim to support the best models available. We allow the user to configure separate models for chat and code completion, this is especially helpful when running AI models locally. Here is a list of which models we support for each provider:

### [Anthropic](https://docs.anthropic.com/en/docs/welcome)

You can use the following models:

-   Claude 3.7 Sonnet
-   Claude 3.5 Haiku
-   Claude 3.5 Sonnet
-   Claude 3 Opus

:::note
Sonnet 3.7 is a pretty aggressive model, you can enable thinking mode (2048 token budget) or **spark** mode which will remove specific focus constraints on 3.7. Spark mode is the raw model output without the prompt restricting it.
:::

**Anthropic [prompt caching](https://www.anthropic.com/news/prompt-caching) is used for optimization reasons**

**NOTE** - Unlike using Ollama, your data is not private and will not be sanitized prior to being sent to Anthropic.

### [OpenAI](https://platform.openai.com/docs/models/continuous-model-upgrades)

You can use the following models:

-   o1
-   o3-mini (medium reasoning)
-   GPT-4o
-   GPT-4o-mini
-   GPT-4-Turbo

**NOTE** - Unlike using Ollama, your data is not private and will not be sanitized prior to being sent to OpenAI

### [AzureAI](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models?tabs=python-secure#gpt-4o-and-gpt-4-turbo)

**NOTE** - AzureAI has general latency due to content filters on models by default. This can cause delays in responses and may require additional configuration to disable content filters.

You can use the following models:

-   o1
-   o3-mini (medium reasoning)
-   GPT-4o
-   GPT-4o-mini
-   GPT-4-Turbo
-   GPT4
-   GPT-1o

**NOTE** - Unlike using Ollama, your data is not private and will not be sanitized prior to being sent Azure OpenAI.

### [Ollama](https://ollama.com/)

Wingman uses a full agentic flow. You must use an Ollama model that supports tools. If you would like to add a model, please open an issue in [Github](https://github.com/RussellCanfield/wingman-ai).

**NOTE - You can use any quantization for a supported model, you are not limited.**

**Example: deepseek-coder:6.7b-instruct-q4_0**

Supported Models for _Code Completion_:

-   Qwen2.5 Coder Base [qwen2.5-coder](https://ollama.com/library/qwen2.5-coder)
-   Deepseek Coder v2-base _(tested with: [deepseek-coder-v2:16b-lite-base-q4_0](https://ollama.com/library/deepseek-coder-v2:16b-lite-base-q4_0))_
-   Deepseek-base _(tested with: [deepseek-coder:6.7b-base-q8_0](https://ollama.ai/library/deepseek-coder:6.7b-base-q8_0))_
-   Codellama-code _(tested with: [codellama:7b-code-q4_K_M](https://ollama.ai/library/codellama:7b-code-q4_K_M))_
-   Magicoder-DS _(tested with [wojtek/magicoder:6.7b-s-ds-q8_0](https://ollama.com/wojtek/magicoder:6.7b-s-ds-q8_0))_
-   CodeQwen1.5 _(tested with [codeqwen:7b-code-v1.5-q5_1](https://ollama.com/library/codeqwen:7b-code-v1.5-q5_1))_
-   Codestral _(tested with [codestral:22b-v0.1-q5_K_M](https://ollama.com/library/codestral:22b-v0.1-q5_K_M))_

Supported Models for _Chat_:

-   [Qwen2.5 Coder Instruct](https://ollama.com/library/qwen2.5-coder)
-   [Llama 3.3](https://ollama.com/library/llama3.3)

### [Hugging Face](https://huggingface.co/)

**NOTE - These are out of date**

Supported Models for _Code Completion_:

-   CodeLlama _(tested with: [codellama/CodeLlama-7b-hf](https://huggingface.co/codellama/CodeLlama-7b-hf))_
-   Starcoder2 _(tested with [bigcode/starcoder2-15b](https://huggingface.co/bigcode/starcoder2-15b))_

Supported Models for _Chat_:

-   Mixtral v0.1 _(tested with [mistralai/Mixtral-8x7B-Instruct-v0.1](https://huggingface.co/mistralai/Mixtral-8x7B-Instruct-v0.1))_
-   Mistral v0.2 _(tested with: [mistralai/Mistral-7B-Instruct-v0.2](https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.2))_

**NOTE** - Unlike using Ollama, your data is not private and will not be sanitized prior to being sent.

## Settings

Settings for the extension are broken down into 4 categories.

- AI Provider
- Interaction Settings
- Validation Command
- MCP Tools

### AI Provider

Provider settings will include which model to use, endpoints and the API key to use. These will save per provider allowing you to switch on the fly.

### Extension Settings

General extension settings are persisted separately from the AI provider, here is a breakdown of the general settings:

#### Code completion enabled

Code completion can run automatically triggered by line returns, spaces and tabs. Or can by hotkeying the "Wingman: Code Complete" command.

#### Code streaming

This is an experimental version of code complete that attempts to return results faster, allowing the user to see incremental changes as they accept.

#### Code context window

During code completion, this controls the amount of surrounding text passed to the AI provider, giving better auto completion results.

#### Code max tokens

The maximum amount of tokens the code models can generate during code completion.

#### Chat max tokens

Controls the maximum about of tokens the AI provider will return.
