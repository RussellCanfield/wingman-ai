# WingMan - AI Coding Assistant

<p align="center" width="100%">
    <img width="33%" src="./docs/logo.jpeg">
</p>

The Wingman extension brings high quality AI assisted coding right to your computer, it's 100% free and data never leaves your machine - meaning it's completely private! Since the current release of this extension relies on running the AI models locally using [Ollama](https://ollama.ai/), it is recommended you are on a machine with capable graphics card (Apple M series/Nvidia cards) for the best performance.

## 🚀 Getting Started

-   Install this extension from the VS Code Marketplace: [Wingman-AI](https://marketplace.visualstudio.com/items?itemName=wingman.wingman)
-   Install [Ollama](https://ollama.ai/)
-   Install the supported local models by running the following command(s):
    **Example**:
    -   _ollama pull deepseek-coder:6.7b-base-q4_1_
    -   _ollama pull deepseek-coder:6.7b-instruct-q8_0_
-   That's it! This extension will validate that the models are configured correctly in it's VSCode settings upon launch.

## Features

### Code Completion

The AI will look for natural pauses in typing to decide when to offer code suggestions (keep in mind the AI is limited by your machine speed).

[![Wingman AI code completion example](https://img.youtube.com/vi/panJL4DUGkA/0.jpg)](https://www.youtube.com/watch?v=panJL4DUGkA)

### Interactive Chat

Talk to the AI naturally! It will use open files as context to answer your question, or simply select a section of code to use as context.

[![Wingman AI chat example](https://img.youtube.com/vi/1W3h2mOdjmc/0.jpg)](https://www.youtube.com/watch?v=1W3h2mOdjmc)

[![Wingman AI chat example](https://img.youtube.com/vi/2sJZpyYi3Fc/0.jpg)](https://www.youtube.com/watch?v=2sJZpyYi3Fc)

## Why Ollama?

[Ollama](https://ollama.ai/) was chosen for it's simplicity, allowing users to pull a number of models in different configurations and update them at will. Ollama will pull optimized models based on your system architecture, however if you do not have a GPU accelerated machine, models will be slower.

## Setting up Ollama

Currently this extension only runs models locally using [Ollama](https://ollama.ai/). Ollama has a number of open source models available that are capable of writing high quality code.

### Supported Models

The extension uses a separate model for chat and code completion. This is due to the fact that different types of models have different strengths, mixing and matching offers the best result.
Supported Models for _Code Completion_:

-   Deepseek-base _(tested with: deepseek-coder:6.7b-base-q4_1)_
-   Codellama-code _(tested with: codellama:7b-code-q4_K_M)_
    Supported Models for _Chat_:
-   Deepseek-Instruct _(tested with: deepseek-coder:6.7b-instruct-q8_0)_
-   Codellama-Instruct _(tested with: codellama:7b-instruct)_

## Features

Code completion based on the active code window.
Interactive chat - look for the airplane icon in the side bar.

## Troubleshooting

This extension leverages Ollama due to it's simplicity and ability to deliver the right container optimized for your running environment.
However good AI performance relies on your machine specs, so if you do not have the ability to GPU accelerate, responses may be slow.
During startup the extension will verify the models you have configured in the VSCode settings pane for this extension, the extension does have some defaults:

**Code Model** - deepseek-coder:6.7b-base-q4_1
**Chat Model** - deepseek-coder:6.7b-instruct-q8_0

The models above will require enough RAM to run them correctly, you should have at least 12GB of ram on your machine if you are running these models, if you don't have enough ram then choose a smaller model will won't perform as well.

## Release Notes

### 0.0.5

Initial pre-release of WingMan!

---

**Enjoy!**
