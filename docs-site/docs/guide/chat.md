# Chat

[Wingman](https://marketplace.visualstudio.com/items?itemName=WingMan.wing-man) uses a fully agentic flow to provide a connected experience with your project.

By default, Wingman will track files you've had open and provide that to the Agent.

If you highlight text in an editor window, it will send that to the Agent for a more focused questions.

:::note
Want a code example? Just ask for one!
:::

## Hot keys

Quickly open wingman with these shortcuts:

MacOS: Cmd + i
Windows: Control + i

![](/Chat.png)

## Multi-modal

Wingman allows you to attach an image to your message, have it fix a bug, or design a UI based on your starting point.

![](/ChatWithImage.png)

:::note
You can use browser MCP tools, or figma MCP tools as well!
:::

## Tools

Wingman is powered by a set of tools that enhance its capabilities:

### Semantic Search
Quickly finds relevant files across your codebase using natural language queries, making it easy to locate implementations or understand how code is organized. This is related to the **indexing feature.**

### Command Execution
Executes terminal commands safely, with built-in protections against potentially destructive operations.

### File Operations
Tools to read files, list directories, and write changes, all while tracking dependencies between files.

### Web Search
Retrieves content from URLs and converts it to a readable format for analysis.

**Example**: If you want to analyze a specific web page, just ask:
```
Can you take a look at https://wingman.work and tell me what it's about?
```

### Research
Performs deep research on topics by exploring multiple sources and synthesizing the information.

**Example**: When you need comprehensive information about a concept:
```
Can you research modern state management techniques in React and compare the top solutions?
```

### Thinking Tool
Allows Wingman to brainstorm and reason through complex problems without making immediate changes.

**Example**: When you want Wingman to think through a problem:
```
Can you think about different strategies for optimizing this database query before making any changes?
```

:::note
The thinking tool differs from "thinking mode" in LLMs - it's a deliberate brainstorming step where Wingman evaluates options before taking action.
:::

### Image Generation

Currently only supported using Google AI Studio as a provider, allows you to generate images.

## Constraints

Wingman can execute commands but is restricted from running destructive commands. It will try not to run long running scripts like running a web server that does not exit.

## File Editing

Wingman will edit files and with the ability to accept, reject or view diffs. This functionality is blocked until the message has completed. The main reason why is Wingman stores **thread** checkpoints on disk, and being a new feature the concurrent editing could cause issues. This is a decision of stability over the unknown.

You can also bulk accept or reject files by going to the **summary** section at the bottom of the most current message.

## Extending the prompt via rules

You can extend/inject snippets into Wingman's system prompt by creating a `.wingmanrules` file in root of your workspace. You can treat this file similar to how you would configure rules in Cursor. There are many reasons why you'd want to do this, such as giving context about a project, constraining output, attempting to increase output quality, asking Wingman to automatically update the file with knowledge about the project and asking it to recall it for edits.