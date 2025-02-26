import { tool } from "@langchain/core/tools";
import path from "node:path";
import { z } from "zod";
import { scanDirectory } from "../../utils";

const listDirectorySchema = z.object({
    directory: z.string().describe("The directory")
});

/**
 * Creates a tool that lists contents of a directory
 */
export const createListDirectoryTool = (workspace: string) => {
    return tool(
        async (input) => {
            try {
                const dirPath = path.isAbsolute(input.directory) ?
                    input.directory : path.join(workspace, input.directory);

                const files = await scanDirectory(dirPath, 3);

                return JSON.stringify(files);
            } catch (error) {
                console.error("Error in list_directory tool:", error);
                return `Error: Could not list files in ${input.directory}. ${error instanceof Error ? error.message : ''}`;
            }
        },
        {
            name: "list_directory",
            description: "Lists contents of a directory. Useful to understand the file structure of the project.",
            schema: listDirectorySchema
        }
    );
};