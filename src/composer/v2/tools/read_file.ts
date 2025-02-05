import { DynamicStructuredTool } from "@langchain/core/tools";
import fs, { promises } from "node:fs";
import path from "node:path";
import { z } from "zod";

const readFileSchema = z.object({
    filePath: z.string().describe("The relative path of the file to read")
});

type ReadFileInput = z.infer<typeof readFileSchema>;

export const createReadFileTool = (workspace: string) => {
    return new DynamicStructuredTool<typeof readFileSchema>({
        name: "read_file",
        description: "Reads the exact contents of a specific file. Use this tool when you need to check: 1) dependency management files (package.json, pnpm-workspace.yaml, etc.), 2) configuration files, or 3) a specific file you already know the path to.",
        schema: readFileSchema,
        async func(input: ReadFileInput) {
            const filePath = path.isAbsolute(input.filePath) ?
                input.filePath : path.join(workspace, input.filePath);

            if (!fs.existsSync(filePath)) {
                return "File does not exist (create if required)."
            }

            return (await promises.readFile(filePath)).toString();
        }
    });
};