# Indexing

Wingman includes a vector database built in that allows you to configure inclusion and exclusion filters for files to be embedded using the embedding provider of your choice. Once you configure your embeddings provider, you can choose to run a **full index** of your codebase from the Indexer view, or Wingman will index your files as your save them.

![](/Indexer.png)

:::info
The indexing filter is what is used to determine if files should be indexed. This supports glob patterns.
:::

:::note
Wingman will use cheaper models for indexing code files, for **Anthropic** it will use Claude-3.5-Haiku, and for **OpenAI** it will use gpt-4o-mini
:::

Wingman is the only code assistant that not only embeds files, but creates a comprehensive graph of your entire codebase. Allowing Wingman to leverage file to file relationships. Use the **Output** tab -> **Wingman Language Server** to see more logs around embedding files. Files are debounced as you actively edit them.

**Embeddings are stored locally.**
