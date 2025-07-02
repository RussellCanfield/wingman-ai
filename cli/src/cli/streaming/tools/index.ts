import type { ToolCall } from "@langchain/core/messages/tool";

export const getToolDisplay = (toolCall: ToolCall): string => {
	switch (toolCall.name) {
		case "research":
			return `Researching: ${toolCall.args.query}`;
		case "command_execute":
			return "Thinking";
		case "list_directory":
			return `Listing directory: ${toolCall.args.directory}`;
		case "read_file":
			return `Reading file: ${toolCall.args.path}`;
		case "edit_file":
			return `Editing file: ${toolCall.args.path}`;
		case "web_search":
			return `Searching the web: ${toolCall.args.url}`;
		default:
			return "Unknown tool";
	}
};
