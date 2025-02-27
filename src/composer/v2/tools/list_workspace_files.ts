import { tool } from "@langchain/core/tools";
import path from "node:path";
import { z } from "zod";
import { scanDirectory } from "../../utils";

const listDirectorySchema = z.object({
	directory: z.string().describe("The directory to list files from"),
	depth: z
		.number()
		.optional()
		.describe("How deep to scan the directory (default: 3)"),
});

/**
 * Creates a tool that lists contents of a directory
 */
export const createListDirectoryTool = (workspace: string) => {
	return tool(
		async (input) => {
			try {
				const dirPath = path.isAbsolute(input.directory)
					? input.directory
					: path.join(workspace, input.directory);

				// Use the provided depth or default to 3
				const depth = input.depth !== undefined ? input.depth : 3;

				const files = await scanDirectory(dirPath, depth);

				// Return the files with guidance for the AI
				return JSON.stringify({
					files,
					message: `Directory structure for ${input.directory} with depth ${depth}. To avoid redundant filesystem operations, save this result and reference it in your reasoning when you need information about this directory.`,
				});
			} catch (error) {
				console.error("Error in list_directory tool:", error);
				return `Error: Could not list files in ${input.directory}. ${error instanceof Error ? error.message : ""}`;
			}
		},
		{
			name: "list_directory",
			description:
				"Lists files and directories from the specified path with configurable depth. Returns a structured tree representation of the filesystem hierarchy. To avoid redundant operations, save the results and reference them in your reasoning when exploring the same directory.",
			schema: listDirectorySchema,
		},
	);
};
