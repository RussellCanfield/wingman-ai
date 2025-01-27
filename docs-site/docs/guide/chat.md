# Chat

Chat is the simplest and easiest way to interact with your codebase. By default chat will leverage open files for context, or you can highlight text in files to target specific context for your chat message.

Chat includes history so you can ask follow up questions, with the ability to clear out the chat history. Chat sessions are saved per workspace.

With the new **Indexing** feature, Wingman will automatically find relevant code to include in your chat messages. Unless you highlight text specifically, Wingman will use vector embeddings that are stored about your codebase. See more under the Indexing section.

[![Wingman AI chat example](https://img.youtube.com/vi/1W3h2mOdjmc/0.jpg)](https://www.youtube.com/watch?v=1W3h2mOdjmc)

[![Wingman AI chat example](https://img.youtube.com/vi/2sJZpyYi3Fc/0.jpg)](https://www.youtube.com/watch?v=2sJZpyYi3Fc)

## Commands

Wingman now features commands in chat! This is the first step towards condensing experiences and interaction points for the user. While not all interactions fit well under chat, we plan to add additional commands in the near future.
To get started with commands **type "/" in chat**.

:::note
The "review" and "commit_msg" commands rely on git being available locally
:::

We currently support the following commands:

-   **review** - Generate a summary of your local changes and allows you to perform file-by-file code reviews. Review mileage may vary based on model provider, for example **Ollama** may not provide the same results as Claude Sonnet 3.5.
-   **commit_msg** - Generate a commit message of your currently staged files.
-   **web_search** - Search the web based on a question or code snippet (beta)
