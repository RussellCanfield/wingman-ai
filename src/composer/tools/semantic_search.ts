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
 * Creates a tool that reads file contents
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
				"Searches the codebase using semantic understanding to find relevant files. Returns up to 5 matching files with their paths, descriptions, and similarity scores. Use this to discover code implementing specific features or concepts. This can be more efficient than reading directories and individual files to discover integration points.",
			schema: semanticSearchSchema,
		},
	);
};
