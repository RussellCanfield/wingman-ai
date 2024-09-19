# Configuration

Wingman has a built-in configuration window that will persist configuration locally into the vscode settings file in your repository.
In the future this may move into a specific file that you can **gitignore** separately.

![](/Config.png)

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
