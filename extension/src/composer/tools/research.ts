import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { baseToolSchema } from "./schemas";
import type { AIProvider } from "../../service/base";
import { WebCrawler } from "../../server/web";
import { ToolMessage } from "@langchain/core/messages";

export const researchSchema = baseToolSchema.extend({
	query: z
		.string()
		.describe(
			"The search query to research. Should be a specific topic, not code.",
		),
	maxDepth: z
		.number()
		.optional()
		.describe("Maximum depth of research (1-3). Defaults to 2."),
});

/**
 * Creates a tool that performs deep web research on a topic
 */
export const createResearchTool = (
	workspace: string,
	aiProvider: AIProvider,
) => {
	const crawler = new WebCrawler(aiProvider);

	return tool(
		async (input, config) => {
			const { query, maxDepth } = input;

			// Validate that the query is not code
			if (
				query.includes("{") ||
				query.includes("}") ||
				query.includes("function") ||
				query.includes("=>") ||
				query.includes("class ") ||
				query.includes("import ")
			) {
				return "Research queries should be about topics, not code snippets. Please provide a topic to research.";
			}

			try {
				// Set max depth if provided
				if (maxDepth !== undefined && maxDepth >= 1 && maxDepth <= 3) {
					// Note: The WebCrawler class would need to be updated to support this parameter
					// For now, we'll just use the default depth
				}

				// Perform deep research
				const researchResults = await crawler.deepResearch(query);

				return new ToolMessage({
					id: config.callbacks._parentRunId,
					content: `# Research Results: ${query}\n\n${researchResults}\n\n---\nResearch complete.`,
					tool_call_id: config.toolCall.id,
				});
			} catch (error) {
				if (error instanceof Error) {
					return `Error performing research: ${error.message}`;
				}
				return "An unknown error occurred during research.";
			}
		},
		{
			name: "research",
			description:
				"Performs deep web research on a topic, exploring multiple relevant sources to provide comprehensive information. Use for learning about concepts, technologies, or gathering information on specific topics. Do not use for code snippets.",
			schema: researchSchema,
		},
	);
};
