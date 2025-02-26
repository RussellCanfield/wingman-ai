import { tool } from "@langchain/core/tools";
import fs, { promises } from "node:fs";
import path from "node:path";
import { baseFileSchema } from "./base_file_schema";

export const readFileSchema = baseFileSchema.extend({
    // Additional read-specific properties would go here
});

/**
 * Creates a tool that reads file contents
 */
export const createReadFileTool = (workspace: string) => {
    return tool(
        async (input) => {
            const filePath = path.isAbsolute(input.filePath) ?
                input.filePath : path.join(workspace, input.filePath);

            if (!fs.existsSync(filePath)) {
                return "File does not exist (create if required)."
            }

            return (await promises.readFile(filePath)).toString();
        },
        {
            name: "read_file",
            description: "Reads the contents of a specific file.",
            schema: readFileSchema
        }
    );
};