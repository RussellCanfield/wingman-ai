import { z } from "zod";
import { CodeGraph } from "../../../server/files/graph";
import { Store } from "../../../store/vector";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { VectorQuery } from "../../../server/query";

const semanticSearchSchema = z.object({
    query: z.string().describe("The query used to locate files in the codebase")
});

type SemanticSearchInput = z.infer<typeof semanticSearchSchema>;

export const semanticSearchTool = (workspace: string, codeGraph: CodeGraph, vectorStore: Store) => {
    return new DynamicStructuredTool<typeof semanticSearchSchema>({
        name: "semantic_search_codebase",
        description: "Searches the codebase for files related to a concept or feature. Use this tool to discover relevant files when you don't know the exact file paths. Do not use this for reading dependency or configuration files.",
        schema: semanticSearchSchema,
        async func(input: SemanticSearchInput) {
            const query = new VectorQuery();
            const docs = await query.retrieveDocumentsWithRelatedCodeFiles(input.query, codeGraph, vectorStore, workspace, 15);

            if (!docs?.size) {
                return "No matches found."
            }

            return Array.from(docs.entries())
                .map(([filePath, document]) => `File: ${filePath}\nContents:\n${document.getText()}`)
                .join('\n\n')
        }
    });
};