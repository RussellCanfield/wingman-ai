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

## Constraints

Wingman can execute commands but is restricted from running destructive commands. It will try not to run long running scripts like running a web server that does not exit.

## File Editing

Wingman will edit files and with the ability to accept, reject or view diffs. This functionality is blocked until the message has completed. The main reason why is Wingman stores **thread** checkpoints on disk, and being a new feature the concurrent editing could cause issues. This is a decision of stability over the unknown.

You can also bulk accept or reject files by going to the **summary** section at the bottom of the most current message.

## Extending the prompt via rules

You can extend/inject snippets into Wingman's system prompt by creating a `.wingmanrules` file in root of your workspace. You can treat this file similar to how you would configure rules in Cursor. There are many reasons why you'd want to do this, such as giving context about a project, constraining output, attempting to increase output quality, asking Wingman to automatically update the file with knowledge about the project and asking it to recall it for edits.