import { DynamicStructuredTool } from "@langchain/core/tools";
import { promises } from "node:fs";
import path from "node:path";
import { z } from "zod";

const writeFileSchema = z.object({
    filePath: z.string().describe("The relative path of the file to read"),
    contents: z.string().describe("The contents of the file to write"),
});

type WriteFileInput = z.infer<typeof writeFileSchema>;

export const createWriteFileTool = (workspace: string) => {
    return new DynamicStructuredTool<typeof writeFileSchema>({
        name: "write_file",
        description: "Write a file to the file system, use this tool when you need to create or edit a file. The input expects the full file contents",
        schema: writeFileSchema,
        async func(input: WriteFileInput) {
            try {
                const filePath = path.isAbsolute(input.filePath) ?
                    input.filePath : path.join(workspace, input.filePath);

                await promises.writeFile(filePath, input.contents);

                return `File: ${input.filePath}, saved successfully`;
            } catch (e) {
                return `Failed to write file: ${input.filePath}`;
            }
        }
    });
};