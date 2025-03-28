import { tool } from "@langchain/core/tools";
import { baseToolSchema } from "./schemas";
import { z } from "zod";
import type { VectorStore } from "../../server/files/vector";
import type { Settings } from "@shared/types/Settings";
import { CreateEmbeddingProvider } from "../../service/utils/models";
import { loggingProvider } from "../../server/loggingProvider";
import { ToolMessage } from "@langchain/core/messages";

export const semanticSearchSchema = baseToolSchema.extend({
	query: z
		.string()
		.describe(
			"A natural language query to find relevant code files. Be specific about concepts, functionality, or implementation details you're looking for.",
		),
});

/**
 * Creates a tool that performs semantic searches against a vector database
 */
export const createSemanticSearchTool = (
	settings: Settings,
	vectorStore: VectorStore,
) => {
	const provider = CreateEmbeddingProvider(settings, loggingProvider);

	return tool(
		async (input, config) => {
			const results = await vectorStore.search(
				await provider.getEmbedder().embedQuery(input.query),
				5,
			);

			return new ToolMessage({
				id: config.callbacks._parentRunId,
				content: JSON.stringify(
					results.map((r) => ({
						filePath: r.file_path,
						description: r.summary,
						similarity: r.similarity,
					})) ?? [],
				),
				tool_call_id: config.toolCall.id,
			});
		},
		{
			name: "semantic_search",
			description:
				"Quickly find relevant files across the entire codebase without knowing file locations. Ideal as your first search step when looking for implementation details, features, or understanding how code is organized. Simply describe what you're looking for in natural language, and get back the most relevant files with descriptions and paths. Use this before browsing directories for maximum efficiency.",
			schema: semanticSearchSchema,
		},
	);
};
