import { tool } from "@langchain/core/tools";
import fs, { promises } from "node:fs";
import path from "node:path";
import { baseFileSchema } from "./schemas";

export const readFileSchema = baseFileSchema.extend({
	// Additional read-specific properties would go here
});

/**
 * Creates a tool that reads file contents
 */
export const createReadFileTool = (workspace: string) => {
	return tool(
		async (input) => {
			const filePath = path.isAbsolute(input.filePath)
				? input.filePath
				: path.join(workspace, input.filePath);

			if (!fs.existsSync(filePath)) {
				return { error: "File does not exist (create if required).", filePath };
			}

			const content = await promises.readFile(filePath);

			return {
				content: content.toString(),
				filePath: path.relative(workspace, input.filePath),
				explanation: input.explanation,
			};
		},
		{
			name: "read_file",
			description:
				"Reads the contents of a specific file and includes file path in response.",
			schema: readFileSchema,
		},
	);
};
