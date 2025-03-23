# Model Context Protocol

[Model Context Protocol](https://modelcontextprotocol.io/introduction) is supported! MCP enables seamless integration between AI models and application contexts, providing a standardized interface for dynamic model interactions, configuration management, and context-aware reasoning across different platforms and development environments.

![](/SettingsMCP.png)

You can find examples, along with documentation on how to create your own [here](https://modelcontextprotocol.io/examples).

MCP servers run locally using a command line, or a self hosted web server.

## Adding a server

Our MCP integration is based on [LangChain's MCP adapter](https://github.com/langchain-ai/langchainjs-mcp-adapters?tab=readme-ov-file#configuration-via-json) implementation, offering compreshensive configuration options such as leveraging environment variables, HTTP headers and more!.

:::note
Wingman looks inside your project's `.wingman/mcp.json` file for MCP server configurations, these are no longer added through the IDE extension.
Simply modify the file, and open settings again - or click the refresh button in the MCP settings section to get a list of servers and tools.

If they do not appear, the integration likely isn't configured properly. Check the `Output` tab in the `Terminal` section of your extension for logs under `Wingman`
:::