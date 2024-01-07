# WingMan - AI Coding Assistant README

This extension brings high quality AI assisted coding right to your computer. Since the current release of this extension relies on running the AI models locally, it is recommended you are on a machine with capable graphics card (Apple M series/Nvidia cards).

## Setting up Ollama

Currently this extension only runs models locally using [Ollama](https://ollama.ai/). Ollama has a number of open source models available that are capable of writing high quality code.

### Supported Models

The extension uses a separate model for chat and code completion. This is due to the fact that different types of models have different strengths, mixing and matching offers the best result.

Supported Models for _Code Completion_:

-   Deepseek-base _(tested with: deepseek-coder:6.7b-base-q4_1)_
-   Codellama-code _(tested with: codellama:7b-code-q4_K_M)_

Support Models for _Chat_:

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

## Release Notes

Users appreciate release notes as you update your extension.

### 1.0.0

Initial release of WingMan!

---

**Enjoy!**
