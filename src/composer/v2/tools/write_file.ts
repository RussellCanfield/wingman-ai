import { tool } from "@langchain/core/tools";
import { createPatch } from "diff";
import fs, { promises } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { baseFileSchema } from "./base_file_schema";
import { FileMetadata } from "@shared/types/v2/Message";

export const writeFileSchema = baseFileSchema.extend({
    contents: z.string().describe("The contents of the file to write"),
});

/**
 * Generates a diff between existing file content and new code
 */
const generateDiffFromModifiedCode = async (newCode: string, filePath: string, originalCode?: string): Promise<string> => {
    try {
        if (!filePath) {
            throw new Error('File path is required');
        }

        if (typeof newCode !== 'string') {
            throw new Error('New code must be a string');
        }

        const patch = createPatch(
            filePath,
            originalCode ?? "",
            newCode,
            '',
            '',
            { context: 3 }  // Optional: control context lines
        );

        const stats = {
            additions: 0,
            deletions: 0
        };

        // Safer line parsing
        const lines = patch.split('\n');
        for (const line of lines) {
            // Skip diff headers and metadata
            if (line.startsWith('+++') ||
                line.startsWith('---') ||
                line.startsWith('Index:') ||
                line.startsWith('===') ||
                line.startsWith('@@') ||
                line.startsWith('\\')) {
                continue;
            }

            if (line.startsWith('+')) {
                stats.additions++;
            } else if (line.startsWith('-')) {
                stats.deletions++;
            }
        }

        return `+${stats.additions},-${stats.deletions}`;
    } catch (error) {
        console.error('Error generating diff:', error);
        return '+0,-0'; // Safe fallback
    }
};

/**
 * Creates a write file tool with the given workspace
 */
export const createWriteFileTool = (workspace: string) => {
    return tool(
        async (input) => {
            let fileContents = input.contents;
            const filePath = path.join(workspace, input.filePath);
            if (fs.existsSync(filePath)) {
                try {
                    fileContents = await promises.readFile(filePath, { encoding: 'utf-8' });
                } catch (e) {
                    console.warn(`Failed to read file ${filePath}:`, e);
                    // Continue with empty string for new files
                }
            }

            return {
                path: input.filePath,
                code: input.contents,
                original: fileContents ?? "",
                diff: await generateDiffFromModifiedCode(input.contents, input.filePath)
            } satisfies FileMetadata;
        },
        {
            name: "write_file",
            description: "Write a file to the file system, use this tool when you need to create or edit a file. The input expects the full file contents",
            schema: writeFileSchema,
            returnDirect: false
        }
    );
};