import { tool } from "@langchain/core/tools";
import fs, { promises } from "node:fs";
import path from "node:path";
import { baseFileSchema } from "./schemas";
import { ToolMessage } from "@langchain/core/messages";
import type { FileParser } from "../files/parser";
import { pathToFileURL } from "node:url";

export const readFileSchema = baseFileSchema.extend({
	// Additional read-specific properties would go here
});

/**
 * Creates a tool that reads file contents
 */
export const createReadFileTool = (
	workspace: string,
	fileParser?: FileParser,
) => {
	return tool(
		async (input, config) => {
			const filePath = path.isAbsolute(input.path)
				? input.path
				: path.join(workspace, input.path);

			if (!fs.existsSync(filePath)) {
				return "File does not exist (create if required).";
			}

			const imports: string[] = [];
			const exports: string[] = [];

			if (fileParser) {
				const result = await fileParser.extractFileRelationships(
					pathToFileURL(filePath).toString(),
				);
				imports.push(...result.imports);
				exports.push(...result.exports);
			}

			// return new ToolMessage({
			// 	id: config.callbacks._parentRunId,
			// 	content: JSON.stringify({
			// 		id: config.toolCall.id,
			// 		content: await promises.readFile(filePath, "utf-8"),
			// 		path: path.relative(workspace, input.path),
			// 		explanation: input.explanation,
			// 		importedBy: imports,
			// 		exportedTo: exports,
			// 	}),
			// 	tool_call_id: config.toolCall.id,
			// });

			return await promises.readFile(filePath, "utf-8");
		},
		{
			name: "read_file",
			description:
				"Reads the contents of a specific file, includes file path, files that depend on this file (imported by), and files that consume this file (exported to) in response.",
			schema: readFileSchema,
		},
	);
};
