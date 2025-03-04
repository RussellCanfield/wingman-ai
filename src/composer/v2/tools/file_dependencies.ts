import { tool } from "@langchain/core/tools";
import fs from "node:fs";
import path from "node:path";
import { baseFileSchema } from "./schemas";
import type { CodeParser } from "../../../server/files/parser";
import { getTextDocumentFromPath } from "../../../server/files/utils";

export const fileDependenciesSchema = baseFileSchema.extend({
	// Additional read-specific properties would go here
});

/**
 * Creates a tool that finds external references in a file
 */
export const createFindFileDependenciesTool = (
	workspace: string,
	codeParser: CodeParser,
) => {
	return tool(
		async (input) => {
			const filePath = path.isAbsolute(input.filePath)
				? input.filePath
				: path.join(workspace, input.filePath);

			if (!fs.existsSync(filePath)) {
				return "File does not exist (create if required).";
			}

			const textDocument = await getTextDocumentFromPath(filePath);

			if (!textDocument) {
				return "Unable to read file contents. Text document could not be created.";
			}

			const { importEdges, exportEdges } =
				await codeParser.createNodesFromDocument(textDocument);

			return {
				importEdges: Array.from(importEdges),
				exportEdges: Array.from(exportEdges),
				filePath: filePath,
				explanation: input.explanation,
			};
		},
		{
			name: "find_file_dependencies",
			description:
				"Finds external symbols directly referenced from the file provided. Uses an AST to find the references. Useful to determine file relationships, dependencies between modules, import/export patterns, and identifying potential refactoring opportunities. Returns both import and export edges to help understand the file's position in the codebase dependency graph.",
			schema: fileDependenciesSchema,
		},
	);
};
