import { z } from "zod";

export const baseFileSchema = z.object({
    filePath: z.string().describe("The relative path of the file relative to the workspace"),
});