# Configuration

[Wingman](https://marketplace.visualstudio.com/items?itemName=WingMan.wing-man) has a built-in configuration window that will persist configuration locally into the vscode settings file in your repository.
In the future this may move into a specific file that you can **gitignore** separately.

![](/Config.png)

## Storage

[Wingman](https://marketplace.visualstudio.com/items?itemName=WingMan.wing-man) only stores data on your machine. In previous extension versions (prior to v0.7.0), configuration used to be stored in your repository. The new storage location contains Wingman configuration, project specific embeddings and more.

**Storage Location:**

/Home Directory/.wingman

**Example on macOS:**

/Users/username/.wingman

## Supported Models

We aim to support the best models available. We allow the user to configure separate models for chat and code completion, this is especially helpful when running AI models locally. Here is a list of which models we support for each provider:

### [Anthropic](https://docs.anthropic.com/en/docs/welcome)

You can use the following models:

-   Claude 3.5 Sonnet
-   Claude 3 Opus

**NOTE** - Unlike using Ollama, your data is not private and will not be sanitized prior to being sent.

### [OpenAI](https://platform.openai.com/docs/models/continuous-model-upgrades)

You can use the following models:

-   GPT4-o
-   GPT4-Turbo
-   GPT4
-   GPT 1o

**NOTE** - Unlike using Ollama, your data is not private and will not be sanitized prior to being sent.

### [Ollama](https://ollama.com/)

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

-   Qwen2.5 Coder Instruct [qwen2.5-coder](https://ollama.com/library/qwen2.5-coder)
-   Deepseek Coder v2-instruct _(tested with: [deepseek-coder-v2:16b-lite-instruct-q4_0](https://ollama.com/library/deepseek-coder-v2:16b-lite-instruct-q4_0))_
-   Deepseek-Instruct _(tested with: [deepseek-coder:6.7b-instruct-q8_0](https://ollama.ai/library/deepseek-coder:6.7b-instruct-q8_0))_
-   Codellama-Instruct _(tested with: [codellama:7b-instruct](https://ollama.ai/library/codellama:7b-instruct))_
-   Phind-CodeLlama - _(tested with: [phind-codellama:34b-v2-q2_K](https://ollama.ai/library/phind-codellama:34b-v2-q2_K))_
-   Magicoder-DS _(tested with [wojtek/magicoder:6.7b-s-ds-q8_0](https://ollama.com/wojtek/magicoder:6.7b-s-ds-q8_0))_
-   Llama3-Instruct _(tested with [llama3:8b-instruct-q6_K](https://ollama.com/library/llama3:8b-instruct-q6_K))_
-   CodeQwen1.5-Code _(tested with [codeqwen:7b-chat-v1.5-q8_0](https://ollama.com/library/codeqwen:7b-code-v1.5-q8_0))_
-   Codestral _(tested with [codestral:22b-v0.1-q5_K_M](https://ollama.com/library/codestral:22b-v0.1-q5_K_M))_

### [Hugging Face](https://huggingface.co/)

Supported Models for _Code Completion_:

-   CodeLlama _(tested with: [codellama/CodeLlama-7b-hf](https://huggingface.co/codellama/CodeLlama-7b-hf))_
-   Starcoder2 _(tested with [bigcode/starcoder2-15b](https://huggingface.co/bigcode/starcoder2-15b))_

Supported Models for _Chat_:

-   Mixtral v0.1 _(tested with [mistralai/Mixtral-8x7B-Instruct-v0.1](https://huggingface.co/mistralai/Mixtral-8x7B-Instruct-v0.1))_
-   Mistral v0.2 _(tested with: [mistralai/Mistral-7B-Instruct-v0.2](https://huggingface.co/mistralai/Mistral-7B-Instruct-v0.2))_

**NOTE** - Unlike using Ollama, your data is not private and will not be sanitized prior to being sent.

## Settings

Settings for the extension are broken down into 3 categories.

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

#### Chat context window

When using chat, chat will pull code from the current open file around the current cursor position. This controls how many tokens it will include around the cursor. See our features guide for advanced use cases.

#### Chat max tokens

Controls the maximum about of tokens the AI provider will return.
