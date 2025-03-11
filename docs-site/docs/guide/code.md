# Code Completion

Wingman-AI will look for natural pauses in typing to decide when to offer code suggestions (keep in mind the speed is limited by your machine). The code completion feature will also analyze comments you type and generate suggestions based on that context.

You can fine tune the amount of context code complete has by using the settings window.

[![Wingman AI code completion example](https://img.youtube.com/vi/panJL4DUGkA/0.jpg)](https://www.youtube.com/watch?v=panJL4DUGkA)

:::warning
Code completion can be very expensive with third party models such as Sonnet 3.5, consider using a lower quality model for code complete or using the hotkey and turning off code complete in the configuration.
:::

### Code Completion Disable / HotKey

We understand that sometimes the code completion feature can be too aggressive, and when using **Ollama** it may strain your system's resources during local development. To address this, we have introduced an option to disable automatic code completion. However, we also recognize the usefulness of on-demand completion. Therefore, we've implemented a hotkey that allows you to manually trigger code completion at your convenience.

When you need assistance, simply press `Shift + Ctrl + Space`. This will bring up a code completion preview right in the editor and a quick action will appear. If you're satisfied with the suggested code, you can accept it by pressing `Enter`. This provides you with the flexibility to use code completion only when you want it, without the overhead of automatic triggers.
