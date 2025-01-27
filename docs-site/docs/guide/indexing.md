# Indexing

Wingman includes a vector database built in that allows you to configure inclusion and exclusion filters for files to be embedded using the embedding provider of your choice. Once you configure your embeddings provider, you can choose to run a **full index** of your codebase from the Indexer view, or Wingman will index your files as your save them.

![](/Indexer.png)

The indexing filter is what is used to determine if files should be indexed. This supports glob patterns.
Files that meet this criteria will be included in code context.

Use the Developer **OUTPUT** window, under "Wingman Language Server" to view files that are being indexed or being excluded based on your matching glob pattern.

Example:

```bash
Processing 1 documents
Adding document to graph: file:///Users/russellcanfield/Projects/wingman-ai/src/providers/chatViewProvider.ts
File already indexed: file:///Users/russellcanfield/Projects/wingman-ai/src/providers/terminalProvider.ts
File already indexed: file:///Users/russellcanfield/Projects/wingman-ai/src/providers/loggingProvider.ts
File already indexed: file:///Users/russellcanfield/Projects/wingman-ai/src/providers/loggingProvider.ts
File already indexed: file:///Users/russellcanfield/Projects/wingman-ai/src/providers/utilities.ts
File already indexed: file:///Users/russellcanfield/Projects/wingman-ai/src/providers/utilities.ts
Skipping shared/src/types/Message.ts - does not match inclusion pattern
Skipping shared/src/types/Indexer.ts - does not match inclusion pattern
Skipping shared/src/types/Composer.ts - does not match inclusion pattern
```

:::note
Wingman will use cheaper models for indexing code files, for **Anthropic** it will use Claude-3.5-Haiku, and for **OpenAI** it will use gpt-4o-mini
:::

Wingman is the only code assistant that not only embeds files, but creates a comprehensive graph of your entire codebase. Allowing Wingman to leverage file to file relationships. Use the **Output** tab -> **Wingman Language Server** to see more logs around embedding files. Files are debounced as you actively edit them.

**Embeddings are stored locally.**
