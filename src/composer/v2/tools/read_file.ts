import { tool } from "@langchain/core/tools";
import fs, { promises } from "node:fs";
import path from "node:path";
import { baseFileSchema } from "./base_file_schema";
import type { FileMetadata } from "@shared/types/v2/Message";

export const readFileSchema = baseFileSchema.extend({
	// Additional read-specific properties would go here
});

/**
 * Creates a tool that reads file contents
 */
export const createReadFileTool = (
	workspace: string,
	getFileFromGraph: (
		path: string,
		threadId: string,
	) => Promise<FileMetadata | undefined>,
) => {
	return tool(
		async (input, config) => {
			const threadId = config.configurable?.thread_id as string;

			const cachedFile = await getFileFromGraph(input.filePath, threadId);

			if (cachedFile) {
				return cachedFile.code;
			}

			const filePath = path.isAbsolute(input.filePath)
				? input.filePath
				: path.join(workspace, input.filePath);

			if (!fs.existsSync(filePath)) {
				return "File does not exist (create if required).";
			}

			return (await promises.readFile(filePath)).toString();
		},
		{
			name: "read_file",
			description: "Reads the contents of a specific file.",
			schema: readFileSchema,
		},
	);
};
