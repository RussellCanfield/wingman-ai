import { tool } from "@langchain/core/tools";
import { ToolMessage } from "@langchain/core/messages";
import { z } from "zod";

export const readFileSchema = z.object({
	thought: z.object({
		type: z.string(),
		description: z.string().describe("Your thoughts in plain text"),
	}),
});

/**
 * Creates a tool that reads file contents
 */
export const createThinkingTool = () => {
	return tool(
		async (input, config) => {
			return new ToolMessage({
				id: config.callbacks._parentRunId,
				content: JSON.stringify({
					input,
				}),
				tool_call_id: config.toolCall.id,
			});
		},
		{
			name: "think",
			description:
				"Use the tool to think about something. It will not obtain new information or make any changes to the repository, but just log the thought. Use it when complex reasoning or brainstorming is needed. For example, if you explore the repo and discover the source of a bug, call this tool to brainstorm several unique ways of fixing the bug, and assess which change(s) are likely to be simplest and most effective. Alternatively, if you receive some test results, call this tool to brainstorm ways to fix the failing tests.",
			schema: readFileSchema,
		},
	);
};
