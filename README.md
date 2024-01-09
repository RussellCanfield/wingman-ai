# WingMan - AI Coding Assistant

<p align="center" width="100%">
    <img width="33%" src="./WingManLogo.jpeg">
</p>

The WingMan extension brings high quality AI assisted coding right to your computer. Since the current release of this extension relies on running the AI models locally using [Ollama](https://ollama.ai/), it is recommended you are on a machine with capable graphics card (Apple M series/Nvidia cards) for the best performance.

## Why Ollama?

[Ollama](https://ollama.ai/) was chosen for it's simplicity, allowing users to pull a number of models in different configurations and update them at will. Ollama will pull optimized models based on your system architecture, however if you do not have a GPU accelerate machine, models will be slower.

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

### Installing and setting up Ollama

-   Download and Install [Ollama](https://ollama.ai/)
-   Find a supported model above and run **ollama pull model**
-   Models do not need to be explicitly run, just exist inside ollama

## Getting started

-   npm i
-   Press F5 to run the extension.
-   Open Settings in the new window, look for "WingMan"
-   Configure the model names, reload the window _(CMD + R on mac)_

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

### 1.0.0

Initial release of WingMan!

---

**Enjoy!**
